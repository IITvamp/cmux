# /// script
# dependencies = [
#   "morphcloud>=0.1.91",
#   "python-dotenv>=1.0.0",
# ]
# ///

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import atexit
import os
import shlex
import signal
import sys
import tarfile
import tempfile
import textwrap
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Awaitable, Callable, Dict, Iterable, List, Optional

import dotenv

from morphcloud.api import Instance, InstanceStatus, MorphCloudClient, Snapshot

dotenv.load_dotenv()

ACTIVE_INSTANCES: list[Instance] = []
KEEP_INITIAL_INSTANCE = False


@dataclass
class Task:
    name: str
    deps: list[str] = field(default_factory=list)
    factory: Callable[[], Awaitable[None]] = lambda: asyncio.sleep(0)


class TaskGraph:
    def __init__(self, *, concurrency: int = 4) -> None:
        if concurrency < 1:
            raise ValueError("concurrency must be >= 1")
        self._tasks: Dict[str, Task] = {}
        self._concurrency = concurrency

    def add(self, name: str, factory: Callable[[], Awaitable[None]], deps: Iterable[str] | None = None) -> None:
        if name in self._tasks:
            raise ValueError(f"Task '{name}' already registered")
        dep_list = list(deps or [])
        self._tasks[name] = Task(name=name, deps=dep_list, factory=factory)

    async def run(self) -> None:
        pending: set[str] = set(self._tasks.keys())
        completed: set[str] = set()
        running: Dict[str, asyncio.Task[None]] = {}

        def ready_tasks() -> List[str]:
            ready: List[str] = []
            for name in list(pending):
                deps = self._tasks[name].deps
                if all(dep in completed for dep in deps):
                    ready.append(name)
            return sorted(ready)

        while pending or running:
            for name in ready_tasks():
                if len(running) >= self._concurrency:
                    break
                task_coro = self._tasks[name].factory()
                print(f"⏳ starting task: {name}")
                running[name] = asyncio.create_task(task_coro)
                pending.remove(name)

            if not running:
                raise RuntimeError("No runnable tasks left; possible dependency cycle")

            done, _ = await asyncio.wait(running.values(), return_when=asyncio.FIRST_COMPLETED)
            for finished in done:
                task_name = next(name for name, task in running.items() if task is finished)
                try:
                    await finished
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # pragma: no cover - provisioning failure path
                    # Cancel all other tasks and surface the error
                    for other_name, other_task in running.items():
                        if other_task is not finished:
                            other_task.cancel()
                    print(f"❌ task failed: {task_name}", file=sys.stderr)
                    raise RuntimeError(f"Task '{task_name}' failed") from exc
                else:
                    print(f"✅ task complete: {task_name}")
                    completed.add(task_name)
                    del running[task_name]


class RemoteRunner:
    def __init__(self, instance: Instance) -> None:
        self.instance = instance

    async def run(
        self,
        command: str,
        *,
        sudo: bool = False,
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        description: Optional[str] = None,
    ) -> None:
        if description:
            print(f"→ {description}")
        await asyncio.to_thread(
            self._exec_sync,
            command,
            sudo,
            cwd,
            env or {},
            timeout,
        )

    def _exec_sync(
        self,
        command: str,
        sudo: bool,
        cwd: Optional[str],
        env: Dict[str, str],
        timeout: Optional[float],
    ) -> None:
        parts: list[str] = []
        if env:
            exports = " ".join(
                f"export {key}={shlex.quote(value)};" for key, value in env.items()
            )
            parts.append(exports)
        if cwd:
            parts.append(f"cd {shlex.quote(cwd)}")
        parts.append(command)
        joined = " && ".join(part for part in parts if part)
        shell = f"set -euo pipefail; {joined}"
        argv = ["/bin/bash", "-lc", shell]
        if sudo:
            argv = ["sudo", *argv]
        result = self.instance.exec(argv, timeout=timeout)
        if result.exit_code != 0:
            raise RuntimeError(
                textwrap.dedent(
                    f"""
                    Command failed with exit code {result.exit_code}
                    Command: {command}
                    STDOUT:\n{result.stdout}
                    STDERR:\n{result.stderr}
                    """
                ).strip()
            )

    async def upload_repo(
        self,
        local_root: Path,
        remote_root: str,
        *,
        description: str = "Upload repository contents",
    ) -> None:
        print(f"→ {description}")
        await asyncio.to_thread(self._upload_repo_sync, local_root, remote_root)

    def _upload_repo_sync(self, local_root: Path, remote_root: str) -> None:
        ignore_dirs = {
            ".git",
            ".cache",
            "node_modules",
            "logs",
            ".turbo",
            "dist",
            "build",
        }
        ignore_suffixes = {
            ".log",
            ".pyc",
            ".zip",
            ".tar",
            ".tar.gz",
            ".tgz",
        }
        local_root = local_root.resolve()
        with tempfile.TemporaryDirectory(prefix="cmux-upload-") as tmpdir:
            archive_path = Path(tmpdir) / "repo.tar.gz"
            with tarfile.open(archive_path, "w:gz") as tar:
                for path in local_root.rglob("*"):
                    rel = path.relative_to(local_root)
                    if any(part in ignore_dirs for part in rel.parts):
                        continue
                    if path.name in ignore_dirs:
                        continue
                    if path.suffix in ignore_suffixes:
                        continue
                    tar.add(path, arcname=str(rel))
            remote_tmp = f"/tmp/{archive_path.name}"
            self.instance.upload(str(archive_path), remote_tmp, recursive=False)
            cleanup = textwrap.dedent(
                f"""
                mkdir -p {shlex.quote(remote_root)}
                tar -xzf {shlex.quote(remote_tmp)} -C {shlex.quote(remote_root)}
                rm -f {shlex.quote(remote_tmp)}
                """
            ).strip()
            self._exec_sync(cleanup, True, None, {}, 900.0)


def register_instance(instance: Instance) -> None:
    ACTIVE_INSTANCES.append(instance)


def cleanup_instances() -> None:
    if not ACTIVE_INSTANCES:
        return
    print("\nCleaning up instances...")
    for inst in ACTIVE_INSTANCES:
        if KEEP_INITIAL_INSTANCE and inst is ACTIVE_INSTANCES[0]:
            continue
        try:
            if inst.status in {InstanceStatus.READY, InstanceStatus.PENDING, InstanceStatus.ERROR}:
                print(f"  ↳ stopping {inst.id}")
                inst.stop()
        except Exception as exc:  # pragma: no cover - cleanup failure
            print(f"  ↳ failed to stop {inst.id}: {exc}", file=sys.stderr)
    ACTIVE_INSTANCES.clear()


atexit.register(cleanup_instances)


def signal_handler(signum, _frame):  # pragma: no cover - signal path
    print(f"\nReceived signal {signum}; exiting")
    cleanup_instances()
    sys.exit(1)


for _sig in (signal.SIGINT, signal.SIGTERM):
    try:
        signal.signal(_sig, signal_handler)
    except Exception:
        pass


def expose_http_private(instance: Instance, name: str, port: int, *, auth_mode: str | None = None) -> str:
    payload = {"name": name, "port": port}
    if auth_mode is not None:
        payload["auth_mode"] = auth_mode
    response = instance._api._client._http_client.post(  # type: ignore[attr-defined]
        f"/instance/{instance.id}/http",
        json=payload,
    )
    response.raise_for_status()
    instance._refresh()
    service = next((svc for svc in instance.networking.http_services if svc.name == name), None)
    if service is None:
        raise RuntimeError(f"Failed to expose service {name}")
    return service.url


async def verify_openvscode_http(runner: RemoteRunner) -> None:
    script = textwrap.dedent(
        """
        PORT=47893
        LOG=/tmp/openvscode-dry-run.log
        /app/openvscode-server/bin/openvscode-server \
          --host 127.0.0.1 \
          --port "$PORT" \
          --without-connection-token \
          --disable-workspace-trust \
          --disable-telemetry \
          --disable-updates \
          /root >/tmp/openvscode-dry-run.log 2>&1 &
        PID=$!
        trap 'kill $PID >/dev/null 2>&1 || true' EXIT
        for attempt in $(seq 1 30); do
          if curl -fsS "http://127.0.0.1:$PORT/?folder=/root" >/dev/null 2>&1; then
            SUCCESS=1
            break
          fi
          sleep 1
        done
        kill $PID >/dev/null 2>&1 || true
        wait $PID >/dev/null 2>&1 || true
        if [ "${SUCCESS:-0}" -ne 1 ]; then
          echo "OpenVSCode server did not become ready" >&2
          exit 1
        fi
        """
    ).strip()
    await runner.run(script, sudo=True, description="Smoke-test OpenVSCode server availability")


async def verify_vnc_endpoint(runner: RemoteRunner, port: int) -> None:
    script = textwrap.dedent(
        f"""
        if ! curl -fsS --max-time 5 http://127.0.0.1:{port} >/dev/null 2>&1; then
          echo "VNC endpoint on port {port} is not reachable" >&2
          exit 1
        fi
        """
    ).strip()
    await runner.run(script, sudo=False, description=f"Verify VNC endpoint on port {port}")


async def run_sanity_checks(runner: RemoteRunner, *, check_vnc_port: int) -> None:
    commands = [
        ("source $HOME/.cargo/env && cargo --version", False, "Check cargo availability"),
        ("node --version", False, "Check Node.js version"),
        ("bun --version", False, "Check Bun version"),
        ("bunx --version", False, "Check Bunx shim"),
        ("uv --version", False, "Check uv CLI version"),
        ("gh --version", False, "Check GitHub CLI"),
        ("docker --version", False, "Check Docker CLI"),
        ("docker compose version", False, "Check Docker Compose plugin"),
        ("envctl --version", False, "Check envctl availability"),
        ("envd --version", False, "Check envd availability"),
        ("cursor-agent --version", False, "Check Cursor agent"),
    ]
    for command, sudo, description in commands:
        await runner.run(command, sudo=sudo, description=description)
    await verify_openvscode_http(runner)
    await verify_vnc_endpoint(runner, port=check_vnc_port)


async def run_validation_checks(instance: Instance, *, vnc_port: int) -> None:
    runner = RemoteRunner(instance)
    checks = [
        ("source $HOME/.cargo/env && cargo --version", "cargo post-snapshot"),
        ("node --version", "node post-snapshot"),
        ("bun --version", "bun post-snapshot"),
        ("uv --version", "uv post-snapshot"),
        ("docker --version", "docker post-snapshot"),
    ]
    for command, description in checks:
        await runner.run(command, description=description)

    curl_script = textwrap.dedent(
        """
        for attempt in $(seq 1 60); do
          if curl -fsS http://127.0.0.1:39378/?folder=/root/workspace >/dev/null 2>&1; then
            FOUND=1
            break
          fi
          sleep 1
        done
        if [ "${FOUND:-0}" -ne 1 ]; then
          echo "OpenVSCode endpoint did not respond in time" >&2
          exit 1
        fi
        """
    ).strip()
    await runner.run(curl_script, description="Wait for OpenVSCode endpoint to respond")
    await verify_vnc_endpoint(runner, port=vnc_port)


def start_instance(
    client: MorphCloudClient,
    *,
    snapshot_id: str,
    vcpus: int,
    memory: int,
    disk_size: int,
    ttl_seconds: int,
) -> Instance:
    print(
        f"Booting instance from {snapshot_id} with {vcpus} vCPU / {memory} MB RAM / {disk_size} MB disk"
    )
    instance = client.instances.boot(
        snapshot_id,
        vcpus=vcpus,
        memory=memory,
        disk_size=disk_size,
        ttl_seconds=ttl_seconds,
        ttl_action="pause",
        metadata={"app": "cmux-build", "provisioner": "parallel-instance"},
    )
    instance.wait_until_ready(timeout=900)
    register_instance(instance)
    print(f"Instance ready: {instance.id}")
    return instance


async def provision_instance(
    instance: Instance,
    *,
    runner: RemoteRunner,
    repo_root: Path,
    concurrency: int,
    vnc_port: int,
) -> None:
    graph = TaskGraph(concurrency=concurrency)

    graph.add(
        "apt-base",
        lambda: runner.run(
            "DEBIAN_FRONTEND=noninteractive apt-get update && "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
            "ca-certificates curl wget git python3 python3-venv python3-pip make g++ bash nano "
            "net-tools lsof sudo supervisor iptables openssl pigz xz-utils tmux htop ripgrep jq unzip "
            "libnss3 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libxss1 libxtst6 libxcb1 libasound2 "
            "fonts-dejavu-core pkg-config libssl-dev libffi-dev software-properties-common", 
            sudo=True,
            description="Install base system packages",
        ),
    )

    graph.add(
        "github-cli",
        lambda: runner.run(
            "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | "
            "dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && "
            "chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && "
            "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] "
            "https://cli.github.com/packages stable main\" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && "
            "apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*",
            sudo=True,
            description="Install GitHub CLI",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "install-node",
        lambda: runner.run(
            "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && "
            "apt-get install -y nodejs && rm -rf /var/lib/apt/lists/* && "
            "npm install -g node-gyp && corepack enable && corepack prepare pnpm@10.14.0 --activate",
            sudo=True,
            description="Install Node.js 24 and corepack",
        ),
        deps=["github-cli"],
    )

    graph.add(
        "install-rust",
        lambda: runner.run(
            "curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --default-toolchain stable && "
            "source $HOME/.cargo/env && rustup component add rustfmt && "
            "ln -sf $HOME/.cargo/bin/cargo /usr/local/bin/cargo && "
            "ln -sf $HOME/.cargo/bin/rustup /usr/local/bin/rustup",
            sudo=False,
            description="Install Rust toolchain",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "install-uv",
        lambda: runner.run(
            "curl -LsSf https://astral.sh/uv/install.sh | sh && "
            "ln -sf $HOME/.local/bin/uv /usr/local/bin/uv",
            sudo=False,
            description="Install uv CLI",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "install-bun",
        lambda: runner.run(
            "curl -fsSL https://bun.sh/install | bash && "
            "mv $HOME/.bun/bin/bun /usr/local/bin/bun && "
            "ln -sf /usr/local/bin/bun /usr/local/bin/bunx",
            sudo=True,
            description="Install Bun runtime",
        ),
        deps=["install-node"],
    )

    graph.add(
        "bun-globals",
        lambda: runner.run(
            "bun add -g @openai/codex@0.42.0 @anthropic-ai/claude-code@2.0.0 "
            "@google/gemini-cli@0.1.21 opencode-ai@0.6.4 codebuff @devcontainers/cli @sourcegraph/amp",
            sudo=False,
            description="Install global Bun CLIs",
        ),
        deps=["install-bun"],
    )

    graph.add(
        "install-openvscode",
        lambda: runner.run(
            "CODE_RELEASE=${CODE_RELEASE:-$(curl -sX GET \"https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest\" | "
            "awk '/tag_name/{print $4;exit}' FS='[\"\\\"]' | sed 's|^openvscode-server-v||')} && "
            "ARCH=$(dpkg --print-architecture) && "
            "if [ \"$ARCH\" = \"amd64\" ]; then VSCODE_ARCH=x64; elif [ \"$ARCH\" = \"arm64\" ]; then VSCODE_ARCH=arm64; else echo 'Unsupported architecture' >&2; exit 1; fi && "
            "mkdir -p /app/openvscode-server && "
            "URL=\"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${CODE_RELEASE}/openvscode-server-v${CODE_RELEASE}-linux-${VSCODE_ARCH}.tar.gz\" && "
            "(curl -fSL --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tar.gz \"$URL\" || "
            " curl -fSL4 --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tar.gz \"$URL\") && "
            "tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server --strip-components=1 && rm -f /tmp/openvscode-server.tar.gz",
            sudo=True,
            description="Install OpenVSCode server",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "install-cursor",
        lambda: runner.run(
            "curl https://cursor.com/install -fsS | bash && "
            "ln -sf $HOME/.local/bin/cursor-agent /usr/local/bin/cursor-agent",
            sudo=False,
            description="Install Cursor CLI",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "install-docker",
        lambda: runner.run(
            "set -euxo pipefail; "
            "ARCH=$(uname -m); "
            "case $ARCH in x86_64) DARCH=x86_64 ;; aarch64) DARCH=aarch64 ;; *) echo 'Unsupported arch' >&2; exit 1 ;; esac; "
            "wget -O /tmp/docker.tgz \"https://download.docker.com/linux/static/stable/${DARCH}/docker-28.3.2.tgz\" && "
            "tar --extract --file /tmp/docker.tgz --strip-components 1 --directory /usr/local/bin && "
            "rm /tmp/docker.tgz && dockerd --version && docker --version",
            sudo=True,
            description="Install Docker engine binaries",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "docker-plugins",
        lambda: runner.run(
            "set -euxo pipefail; "
            "mkdir -p /usr/local/lib/docker/cli-plugins && "
            "ARCH=$(uname -m); "
            "curl -SL \"https://github.com/docker/compose/releases/download/v2.32.2/docker-compose-linux-${ARCH}\" -o /usr/local/lib/docker/cli-plugins/docker-compose && "
            "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose && "
            "curl -SL \"https://github.com/docker/buildx/releases/download/v0.18.0/buildx-v0.18.0.linux-${ARCH}\" -o /usr/local/lib/docker/cli-plugins/docker-buildx && "
            "chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx",
            sudo=True,
            description="Install Docker CLI plugins",
        ),
        deps=["install-docker"],
    )

    graph.add(
        "iptables-legacy",
        lambda: runner.run(
            "update-alternatives --set iptables /usr/sbin/iptables-legacy",
            sudo=True,
            description="Switch iptables to legacy mode",
        ),
        deps=["install-docker"],
    )

    graph.add(
        "install-env-tools",
        lambda: runner.run(
            "CMUX_ENV_VERSION=0.0.8 && "
            "ARCH=$(uname -m) && "
            "case $ARCH in x86_64) ARCH_NAME=x86_64 ;; aarch64|arm64) ARCH_NAME=aarch64 ;; *) echo 'Unsupported architecture' >&2; exit 1 ;; esac && "
            "curl -fsSL \"https://github.com/lawrencecchen/cmux-env/releases/download/v${CMUX_ENV_VERSION}/cmux-env-${CMUX_ENV_VERSION}-${ARCH_NAME}-unknown-linux-musl.tar.gz\" | tar -xz -C /tmp && "
            "mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${ARCH_NAME}-unknown-linux-musl/envctl /usr/local/bin/envctl && "
            "mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${ARCH_NAME}-unknown-linux-musl/envd /usr/local/bin/envd && "
            "rm -rf /tmp/cmux-env-${CMUX_ENV_VERSION}-${ARCH_NAME}-unknown-linux-musl && "
            "chmod +x /usr/local/bin/envctl /usr/local/bin/envd && envctl --version && envctl install-hook bash && "
            "mkdir -p /run/user/0 && chmod 700 /run/user/0 && "
            "echo 'export XDG_RUNTIME_DIR=/run/user/0' >> /root/.bashrc",
            sudo=True,
            description="Install envctl/envd binaries",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "setup-paths",
        lambda: runner.run(
            "echo 'export PATH=$HOME/.cargo/bin:$HOME/.local/bin:$PATH' >> /root/.bashrc",
            sudo=False,
            description="Extend shell PATH for future shells",
        ),
        deps=["install-rust", "install-uv", "install-env-tools"],
    )

    graph.add(
        "create-directories",
        lambda: runner.run(
            "mkdir -p /workspace /root/workspace /root/lifecycle /builtins",
            sudo=True,
            description="Create workspace directories",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "prepare-workspace",
        lambda: runner.run(
            "mkdir -p /cmux",
            sudo=True,
            description="Ensure /cmux exists",
        ),
        deps=["create-directories"],
    )

    graph.add(
        "upload-repo",
        lambda: runner.upload_repo(repo_root, "/cmux"),
        deps=["prepare-workspace"],
    )

    graph.add(
        "bun-install",
        lambda: runner.run(
            "bun install --frozen-lockfile",
            sudo=False,
            cwd="/cmux",
            description="Install workspace dependencies",
        ),
        deps=["upload-repo", "install-bun"],
    )

    graph.add(
        "builtins-package",
        lambda: runner.run(
            "cat <<'EOF' > /builtins/package.json\n"
            "{\n"
            "  \"name\": \"builtins\",\n"
            "  \"type\": \"module\",\n"
            "  \"version\": \"1.0.0\"\n"
            "}\n"
            "EOF",
            sudo=True,
            description="Write builtins package manifest",
        ),
        deps=["create-directories"],
    )

    graph.add(
        "build-worker",
        lambda: runner.run(
            "bun build ./apps/worker/src/index.ts --target node --outdir ./apps/worker/build --external @cmux/convex --external node:* && "
            "cp -r ./apps/worker/build /builtins/build && "
            "cp ./apps/worker/wait-for-docker.sh /usr/local/bin/wait-for-docker.sh && chmod +x /usr/local/bin/wait-for-docker.sh",
            sudo=True,
            cwd="/cmux",
            description="Build worker bundle",
        ),
        deps=["bun-install", "builtins-package"],
    )

    graph.add(
        "copy-collect-scripts",
        lambda: runner.run(
            "cp ./apps/worker/scripts/collect-relevant-diff.sh /usr/local/bin/cmux-collect-relevant-diff.sh && "
            "cp ./apps/worker/scripts/collect-crown-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh && "
            "chmod +x /usr/local/bin/cmux-collect-relevant-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh",
            sudo=True,
            cwd="/cmux",
            description="Install diff helper scripts",
        ),
        deps=["upload-repo"],
    )

    graph.add(
        "build-extension",
        lambda: runner.run(
            "bun install && bun run package",
            sudo=False,
            cwd="/cmux/packages/vscode-extension",
            description="Build VS Code extension",
        ),
        deps=["bun-install"],
    )

    graph.add(
        "install-extension",
        lambda: runner.run(
            "set -euo pipefail; cd /cmux/packages/vscode-extension; "
            "VSIX=$(ls -1t *.vsix | head -n1); "
            "cp \"$VSIX\" /tmp/\"$VSIX\" && "
            "/app/openvscode-server/bin/openvscode-server --install-extension /tmp/\"$VSIX\" && "
            "rm /tmp/\"$VSIX\"",
            sudo=True,
            description="Install packaged VS Code extension",
        ),
        deps=["build-extension", "install-openvscode"],
    )

    graph.add(
        "install-tmux-config",
        lambda: runner.run(
            "cp /cmux/configs/tmux.conf /etc/tmux.conf",
            sudo=True,
            description="Install tmux configuration",
        ),
        deps=["upload-repo"],
    )

    graph.add(
        "modprobe-wrapper",
        lambda: runner.run(
            textwrap.dedent(
                """
                cat > /usr/local/bin/modprobe <<'EOF'
                #!/bin/sh
                set -eu
                for module; do
                    if [ "${module#-}" = "$module" ]; then
                        ip link show "$module" || true
                        lsmod | grep "$module" || true
                    fi
                done
                export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
                exec modprobe "$@"
                EOF
                chmod +x /usr/local/bin/modprobe
                """
            ).strip(),
            sudo=True,
            description="Install modprobe shim",
        ),
        deps=["apt-base"],
    )

    graph.add(
        "startup-assets",
        lambda: runner.run(
            "cp /cmux/startup.sh /startup.sh && chmod +x /startup.sh && "
            "cp /cmux/prompt-wrapper.sh /usr/local/bin/prompt-wrapper && chmod +x /usr/local/bin/prompt-wrapper",
            sudo=True,
            description="Install startup scripts",
        ),
        deps=["upload-repo"],
    )

    graph.add(
        "vscode-settings",
        lambda: runner.run(
            "mkdir -p /root/.openvscode-server/data/User /root/.openvscode-server/data/User/profiles/default-profile /root/.openvscode-server/data/Machine && "
            "SETTINGS='{""workbench.startupEditor"":""none"",""terminal.integrated.macOptionClickForcesSelection"":true,""terminal.integrated.shell.linux"":""bash"",""terminal.integrated.shellArgs.linux"": [""-l""]}' && "
            "printf '%s' \"$SETTINGS\" > /root/.openvscode-server/data/User/settings.json && "
            "printf '%s' \"$SETTINGS\" > /root/.openvscode-server/data/User/profiles/default-profile/settings.json && "
            "printf '%s' \"$SETTINGS\" > /root/.openvscode-server/data/Machine/settings.json",
            sudo=True,
            description="Seed OpenVSCode settings",
        ),
        deps=["install-openvscode"],
    )

    graph.add(
        "sanity-checks",
        lambda: run_sanity_checks(runner, check_vnc_port=vnc_port),
        deps=[
            "install-extension",
            "build-worker",
            "copy-collect-scripts",
            "docker-plugins",
            "iptables-legacy",
            "install-env-tools",
            "install-cursor",
            "bun-globals",
        ],
    )

    await graph.run()


def expose_services(instance: Instance, extra_ports: Iterable[int]) -> None:
    for port in extra_ports:
        name = f"port-{port}"
        url = expose_http_private(instance, name=name, port=port)
        print(f"Exposed {port} at {url}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Provision Morph instance in parallel")
    parser.add_argument("--base-snapshot", default=os.environ.get("CMUX_BASE_SNAPSHOT", "snapshot_g9klz9c4"))
    parser.add_argument("--vcpus", type=int, default=10)
    parser.add_argument("--memory", type=int, default=32768, help="Memory in MB")
    parser.add_argument("--disk-size", type=int, default=131072, help="Disk size in MB")
    parser.add_argument("--ttl-seconds", type=int, default=6 * 3600)
    parser.add_argument("--max-parallel", type=int, default=4)
    parser.add_argument("--vnc-port", type=int, default=6080)
    parser.add_argument("--keep-initial-instance", action="store_true")
    args = parser.parse_args()

    global KEEP_INITIAL_INSTANCE
    KEEP_INITIAL_INSTANCE = args.keep_initial_instance

    client = MorphCloudClient()
    base_instance = start_instance(
        client,
        snapshot_id=args.base_snapshot,
        vcpus=args.vcpus,
        memory=args.memory,
        disk_size=args.disk_size,
        ttl_seconds=args.ttl_seconds,
    )

    runner = RemoteRunner(base_instance)
    repo_root = Path.cwd()

    try:
        await provision_instance(
            base_instance,
            runner=runner,
            repo_root=repo_root,
            concurrency=args.max_parallel,
            vnc_port=args.vnc_port,
        )
        expose_services(base_instance, [39376, 39377, 39378, args.vnc_port])

        print("Creating snapshot...")
        snapshot_metadata = {
            "source": "cmux",
            "provisioner": "parallel-instance",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        snapshot = base_instance.snapshot(metadata=snapshot_metadata)
        print(f"Snapshot created: {snapshot.id}")

        if not args.keep_initial_instance:
            try:
                base_instance.stop()
                print(f"Stopped initial instance {base_instance.id}")
            except Exception as exc:
                print(f"Failed to stop initial instance: {exc}", file=sys.stderr)
        else:
            print(f"Leaving initial instance {base_instance.id} running per flag")

        print("Starting validation instance...")
        validation_instance = client.instances.start(
            snapshot.id,
            ttl_seconds=args.ttl_seconds,
            ttl_action="pause",
            metadata={"app": "cmux-validate", "source_snapshot": snapshot.id},
        )
        expose_services(validation_instance, [39376, 39377, 39378, args.vnc_port])
        await run_validation_checks(validation_instance, vnc_port=args.vnc_port)

        print("Provisioning complete")
        print(f"New snapshot: {snapshot.id}")
        print(f"Validation instance: {validation_instance.id}")
        services = validation_instance.networking.http_services
        for svc in services:
            print(f"  - {svc.name}: {svc.url}")

    finally:
        if args.keep_initial_instance:
            # Ensure initial instance is not auto-stopped in cleanup
            if ACTIVE_INSTANCES and ACTIVE_INSTANCES[0] is base_instance:
                ACTIVE_INSTANCES.remove(base_instance)


if __name__ == "__main__":
    asyncio.run(main())

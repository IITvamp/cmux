#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shlex
import sys
import textwrap
import typing as t
from dataclasses import dataclass
from pathlib import Path

import dotenv
import httpx
from morphcloud.api import Instance, InstanceExecResponse, MorphCloudClient, Snapshot

dotenv.load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[1]
VSCODE_EXTENSION_PACKAGE = REPO_ROOT / "packages" / "vscode-extension" / "package.json"
DEFAULT_VCPUS = 10
DEFAULT_MEMORY_MB = 32_768
DEFAULT_DISK_MB = 65_536
DEFAULT_TTL_SECONDS = 3_600
DEFAULT_TTL_ACTION = "pause"
BUN_GLOBAL_PACKAGES = [
    "@openai/codex@0.42.0",
    "@anthropic-ai/claude-code@2.0.0",
    "@google/gemini-cli@0.1.21",
    "opencode-ai@0.6.4",
    "codebuff",
    "@devcontainers/cli",
    "@sourcegraph/amp",
]
ENV_RELEASE_VERSION = "0.0.8"
EXPOSE_PORTS = [39376, 39377, 39378, 6080]


@dataclass(frozen=True)
class Task:
    name: str
    dependencies: tuple[str, ...]
    handler: t.Callable[[Instance], t.Awaitable[None]]


def _load_extension_version() -> str:
    try:
        with VSCODE_EXTENSION_PACKAGE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        version = str(data.get("version", "0.0.0"))
        name = data.get("name", "cmux-vscode-extension")
        return f"{name}-{version}.vsix"
    except FileNotFoundError as exc:  # pragma: no cover - configuration issue
        raise RuntimeError(
            "Could not determine VS Code extension version; expected package.json at "
            f"{VSCODE_EXTENSION_PACKAGE}"
        ) from exc


VSIX_FILENAME = _load_extension_version()


async def run_cmd(
    instance: Instance,
    command: str,
    *,
    desc: str | None = None,
    env: dict[str, str] | None = None,
    timeout: float | None = None,
) -> InstanceExecResponse:
    prefix = "set -euo pipefail\n"
    if env:
        exports = "\n".join(f"export {key}={shlex.quote(val)}" for key, val in env.items())
        prefix = f"set -euo pipefail\n{exports}\n"
    script = textwrap.dedent(command).strip()
    full_command = f"{prefix}{script}"
    if desc:
        print(f"→ {desc}")
    result = await instance.aexec(["bash", "-lc", full_command], timeout=timeout)
    if result.exit_code != 0:
        raise RuntimeError(
            f"Command failed ({desc or command}):\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result


async def ensure_docker_cli_plugins(instance: Instance) -> None:
    await run_cmd(
        instance,
        f"""
        mkdir -p /usr/local/lib/docker/cli-plugins
        arch=$(uname -m)
        if [ "$arch" != "x86_64" ]; then
            echo "Unsupported architecture for Docker CLI plugins: $arch" >&2
            exit 1
        fi
        curl -fsSL https://github.com/docker/compose/releases/download/v2.32.2/docker-compose-linux-x86_64 \
            -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
        curl -fsSL https://github.com/docker/buildx/releases/download/v0.18.0/buildx-v0.18.0.linux-amd64 \
            -o /usr/local/lib/docker/cli-plugins/docker-buildx
        chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
        docker compose version
        docker buildx version
        """,
        desc="Install Docker CLI plugins",
    )


async def ensure_docker(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y docker.io docker-compose python3-docker git curl
        rm -rf /var/lib/apt/lists/*
        mkdir -p /etc/docker
        cat <<'JSON' > /etc/docker/daemon.json
        {"features":{"buildkit":true}}
JSON
        echo 'DOCKER_BUILDKIT=1' >> /etc/environment
        systemctl restart docker
        for i in $(seq 1 30); do
            if docker info >/dev/null 2>&1; then
                break
            fi
            sleep 2
            if [ "$i" -eq 30 ]; then
                echo "Docker failed to start" >&2
                exit 1
            fi
        done
        docker --version
        """,
        desc="Install Docker engine",
    )
    await ensure_docker_cli_plugins(instance)
    await run_cmd(
        instance,
        "echo '::1       localhost' >> /etc/hosts",
        desc="Ensure IPv6 localhost mapping",
    )


async def install_system_packages(instance: Instance) -> None:
    packages = [
        "ca-certificates",
        "curl",
        "wget",
        "git",
        "python3",
        "python3-pip",
        "make",
        "g++",
        "bash",
        "unzip",
        "gnupg",
        "nano",
        "net-tools",
        "lsof",
        "sudo",
        "supervisor",
        "iptables",
        "openssl",
        "pigz",
        "xz-utils",
        "tmux",
        "htop",
        "ripgrep",
        "jq",
        "rsync",
    ]
    await run_cmd(
        instance,
        f"""
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y {' '.join(packages)}
        apt-get clean
        rm -rf /var/lib/apt/lists/*
        """,
        desc="Install base system packages",
    )


async def install_github_cli(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
            | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
            > /etc/apt/sources.list.d/github-cli.list
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y gh
        rm -rf /var/lib/apt/lists/*
        gh --version
        """,
        desc="Install GitHub CLI",
    )


async def install_node(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
        export DEBIAN_FRONTEND=noninteractive
        apt-get install -y nodejs
        rm -rf /var/lib/apt/lists/*
        npm install -g node-gyp
        corepack enable
        corepack prepare pnpm@10.14.0 --activate
        node --version
        """,
        desc="Install Node.js 24 and corepack",
    )


async def install_bun(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        curl -fsSL https://bun.sh/install | bash
        mv /root/.bun/bin/bun /usr/local/bin/bun
        ln -sf /usr/local/bin/bun /usr/local/bin/bunx
        bun --version
        bunx --version
        """,
        desc="Install Bun runtime",
    )


async def install_uv(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        curl -fsSL https://astral.sh/uv/install.sh | sh
        if [ -f /root/.local/bin/uv ]; then
            install -m 0755 /root/.local/bin/uv /usr/local/bin/uv
        fi
        uv --version
        """,
        desc="Install uv package manager",
    )


async def install_rust(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
        source /root/.cargo/env
        rustup default stable
        cargo --version
        """,
        desc="Install Rust toolchain",
    )


async def install_openvscode(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        CODE_RELEASE=${CODE_RELEASE:-}
        if [ -z "$CODE_RELEASE" ]; then
            CODE_RELEASE=$(curl -sS https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest \
                | awk '/tag_name/{print $2}' RS=',' | tr -d '"' | sed 's/^openvscode-server-v//')
        fi
        arch=$(dpkg --print-architecture)
        case "$arch" in
            amd64) ARCH=x64 ;;
            arm64) ARCH=arm64 ;;
            *) echo "Unsupported architecture $arch" >&2; exit 1 ;;
        esac
        mkdir -p /app/openvscode-server
        url="https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${CODE_RELEASE}/openvscode-server-v${CODE_RELEASE}-linux-${ARCH}.tar.gz"
        curl -fSL --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 \
            -o /tmp/openvscode-server.tar.gz "$url" \
            || curl -fSL4 --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 \
            -o /tmp/openvscode-server.tar.gz "$url"
        tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server --strip-components=1
        rm -f /tmp/openvscode-server.tar.gz
        """,
        desc="Install OpenVSCode server",
    )


def _vscode_settings_json() -> str:
    settings = {
        "workbench.startupEditor": "none",
        "terminal.integrated.macOptionClickForcesSelection": True,
        "terminal.integrated.shell.linux": "bash",
        "terminal.integrated.shellArgs.linux": ["-l"],
        "terminal.integrated.shellIntegration.enabled": False,
        "git.openDiffOnClick": True,
        "scm.defaultViewMode": "tree",
        "git.showPushSuccessNotification": True,
        "git.autorefresh": True,
        "git.branchCompareWith": "main",
    }
    return json.dumps(settings, separators=(",", ":"))


async def configure_openvscode_settings(instance: Instance) -> None:
    settings_json = _vscode_settings_json()
    await run_cmd(
        instance,
        f"""
        mkdir -p /root/.openvscode-server/data/User
        mkdir -p /root/.openvscode-server/data/User/profiles/default-profile
        mkdir -p /root/.openvscode-server/data/Machine
        printf '%s' {shlex.quote(settings_json)} > /root/.openvscode-server/data/User/settings.json
        printf '%s' {shlex.quote(settings_json)} > /root/.openvscode-server/data/User/profiles/default-profile/settings.json
        printf '%s' {shlex.quote(settings_json)} > /root/.openvscode-server/data/Machine/settings.json
        """,
        desc="Configure OpenVSCode settings",
    )


async def install_env_tools(instance: Instance) -> None:
    await run_cmd(
        instance,
        f"""
        CMUX_ENV_VERSION={ENV_RELEASE_VERSION}
        arch=$(uname -m)
        case "$arch" in
            x86_64) arch_name="x86_64" ;;
            aarch64|arm64) arch_name="aarch64" ;;
            *) echo "Unsupported architecture $arch" >&2; exit 1 ;;
        esac
        tmpdir=$(mktemp -d)
        curl -fsSL "https://github.com/lawrencecchen/cmux-env/releases/download/v${{CMUX_ENV_VERSION}}/cmux-env-${{CMUX_ENV_VERSION}}-${{arch_name}}-unknown-linux-musl.tar.gz" \
            | tar -xz -C "$tmpdir"
        install -m 0755 "$tmpdir"/cmux-env-${{CMUX_ENV_VERSION}}-${{arch_name}}-unknown-linux-musl/envctl /usr/local/bin/envctl
        install -m 0755 "$tmpdir"/cmux-env-${{CMUX_ENV_VERSION}}-${{arch_name}}-unknown-linux-musl/envd /usr/local/bin/envd
        rm -rf "$tmpdir"
        envctl --version
        envctl install-hook bash
        echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.profile
        echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.bash_profile
        mkdir -p /run/user/0
        chmod 700 /run/user/0
        if ! grep -q 'XDG_RUNTIME_DIR' /root/.bashrc; then
            echo 'export XDG_RUNTIME_DIR=/run/user/0' >> /root/.bashrc
        fi
        """,
        desc="Install envctl/envd",
    )


async def install_cursor_cli(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        curl https://cursor.com/install -fsS | bash
        if [ -f /root/.local/bin/cursor-agent ]; then
            install -m 0755 /root/.local/bin/cursor-agent /usr/local/bin/cursor-agent
            cursor-agent --version
        fi
        """,
        desc="Install Cursor CLI",
    )


async def update_iptables(instance: Instance) -> None:
    await run_cmd(
        instance,
        "update-alternatives --set iptables /usr/sbin/iptables-legacy",
        desc="Configure iptables legacy",
    )


async def create_directories(instance: Instance) -> None:
    await run_cmd(
        instance,
        "mkdir -p /workspace /root/workspace /root/lifecycle /builtins /var/log/cmux",
        desc="Create workspace directories",
    )


async def install_supervisor_config(instance: Instance) -> None:
    supervisor_conf = textwrap.dedent(
        """
        mkdir -p /etc/supervisor/conf.d
        cat > /etc/supervisor/conf.d/dockerd.conf <<'CONFIG'
        [program:dockerd]
        command=/usr/local/bin/dockerd
        autostart=true
        autorestart=true
        stderr_logfile=/var/log/dockerd.err.log
        stdout_logfile=/var/log/dockerd.out.log
CONFIG
        """
    )
    await run_cmd(instance, supervisor_conf, desc="Configure supervisor for dockerd")


async def upload_repo(instance: Instance) -> None:
    remote_path = "/root/cmux"
    await run_cmd(
        instance,
        f"rm -rf {remote_path} && mkdir -p {remote_path}",
        desc="Prepare remote repository directory",
    )
    print("→ Uploading repository (this may take a while)...")
    await instance.aupload(str(REPO_ROOT), remote_path, recursive=True)


async def sync_workspace(instance: Instance) -> None:
    await run_cmd(
        instance,
        "rsync -a --delete /root/cmux/ /root/workspace/",
        desc="Sync repository into workspace",
    )


async def bun_install(instance: Instance) -> None:
    await run_cmd(
        instance,
        "cd /root/cmux && bun install --frozen-lockfile",
        desc="Install Bun dependencies",
    )


async def build_worker(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        cd /root/cmux
        bun build ./apps/worker/src/index.ts \
            --target node \
            --outdir ./apps/worker/build \
            --external @cmux/convex \
            --external node:*
        """,
        desc="Build worker bundle",
    )


async def prepare_builtins(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        cd /root/cmux
        mkdir -p /builtins
        cp -r ./apps/worker/build /builtins/build
        cp ./apps/worker/wait-for-docker.sh /usr/local/bin/wait-for-docker.sh
        chmod +x /usr/local/bin/wait-for-docker.sh
        """,
        desc="Stage worker builtins",
    )


async def install_worker_scripts(instance: Instance) -> None:
    await run_cmd(
        instance,
        """
        install -m 0755 /root/cmux/apps/worker/scripts/collect-relevant-diff.sh /usr/local/bin/cmux-collect-relevant-diff.sh
        install -m 0755 /root/cmux/apps/worker/scripts/collect-crown-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh
        """,
        desc="Install worker helper scripts",
    )


async def build_vscode_extension(instance: Instance) -> None:
    await run_cmd(
        instance,
        "cd /root/cmux/packages/vscode-extension && bun run package",
        desc="Build VS Code extension",
    )


async def install_vscode_extension(instance: Instance) -> None:
    vsix_path = f"/root/cmux/packages/vscode-extension/{VSIX_FILENAME}"
    await run_cmd(
        instance,
        f"""
        /app/openvscode-server/bin/openvscode-server --install-extension {vsix_path}
        rm -f {vsix_path}
        """,
        desc="Install custom VS Code extension",
    )


async def install_bun_globals(instance: Instance) -> None:
    await run_cmd(
        instance,
        f"bun add -g {' '.join(BUN_GLOBAL_PACKAGES)}",
        desc="Install Bun global CLIs",
    )


async def install_tmux_conf(instance: Instance) -> None:
    await run_cmd(
        instance,
        "install -m 0644 /root/cmux/configs/tmux.conf /etc/tmux.conf",
        desc="Install tmux configuration",
    )


async def install_prompt_wrapper(instance: Instance) -> None:
    await run_cmd(
        instance,
        "install -m 0755 /root/cmux/prompt-wrapper.sh /usr/local/bin/prompt-wrapper",
        desc="Install prompt wrapper",
    )


async def install_startup_script(instance: Instance) -> None:
    await run_cmd(
        instance,
        "install -m 0755 /root/cmux/startup.sh /startup.sh",
        desc="Install startup script",
    )


async def sanity_checks(instance: Instance, label: str) -> None:
    print(f"→ Running sanity checks on {label} instance {instance.id}")
    await run_cmd(
        instance,
        "if [ -f /root/.cargo/env ]; then source /root/.cargo/env; fi; cargo --version",
        desc="Verify cargo",
    )
    await run_cmd(instance, "node --version", desc="Verify node")
    await run_cmd(instance, "bun --version", desc="Verify bun")
    await run_cmd(instance, "uv --version", desc="Verify uv")
    await run_cmd(instance, "envctl --version", desc="Verify envctl")
    await run_cmd(instance, "envd --version || true", desc="Verify envd")
    await run_cmd(instance, "docker --version", desc="Verify Docker")
    await run_cmd(instance, "docker compose version", desc="Verify docker compose")
    await run_cmd(
        instance,
        """
        /app/openvscode-server/bin/openvscode-server \
            --host 127.0.0.1 \
            --port 39378 \
            --without-connection-token \
            --disable-workspace-trust \
            --disable-telemetry \
            --disable-updates \
            --profile default-profile \
            /root/workspace \
            >/tmp/openvscode.log 2>&1 &
        pid=$!
        trap 'kill $pid 2>/dev/null || true' EXIT
        for _ in $(seq 1 30); do
            if curl -sSf http://127.0.0.1:39378/?folder=/root/workspace >/dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        curl -sSf http://127.0.0.1:39378/?folder=/root/workspace >/dev/null
        kill $pid
        wait $pid || true
        """,
        desc="Check OpenVSCode endpoint",
    )
    await run_cmd(
        instance,
        """
        python3 -m http.server 6080 >/tmp/vnc-check.log 2>&1 &
        pid=$!
        trap 'kill $pid 2>/dev/null || true' EXIT
        for _ in $(seq 1 10); do
            if curl -sSf http://127.0.0.1:6080 >/dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        curl -sSf http://127.0.0.1:6080 >/dev/null
        kill $pid
        wait $pid || true
        """,
        desc="Check VNC endpoint reachability",
    )


async def call_private_port_expansion(instance: Instance, client: MorphCloudClient) -> None:
    try:
        await client._async_http_client.post(
            f"/instance/{instance.id}/http/_private/expose-more-ports",
            json={"count": 32},
        )
        print("→ Requested additional port capacity via private endpoint")
    except httpx.HTTPStatusError as exc:
        print(
            f"⚠️  Private port expansion endpoint returned {exc.response.status_code}: {exc.response.text}"
        )
    except Exception as exc:  # pragma: no cover
        print(f"⚠️  Failed to call private port expansion endpoint: {exc}")


async def expose_ports(instance: Instance) -> None:
    async def expose(port: int) -> None:
        name = f"port-{port}"
        try:
            res = await instance.aexpose_http_service(name, port)
            print(f"→ Exposed {name} at {res}")
        except Exception as exc:
            print(f"⚠️  Failed to expose port {port}: {exc}")

    await asyncio.gather(*(expose(port) for port in EXPOSE_PORTS))


async def execute_task_graph(instance: Instance, tasks: list[Task]) -> None:
    task_map = {task.name: task for task in tasks}
    completed: set[str] = set()
    running: dict[str, asyncio.Task[None]] = {}

    while len(completed) < len(task_map):
        ready = [
            task
            for task in tasks
            if task.name not in completed
            and task.name not in running
            and all(dep in completed for dep in task.dependencies)
        ]
        for task in ready:
            async def _runner(t: Task) -> None:
                print(f"▶️  {t.name}")
                await t.handler(instance)
                print(f"✅ {t.name}")

            running[task.name] = asyncio.create_task(_runner(task), name=task.name)

        if not running:
            missing = {
                task.name: task.dependencies
                for task in tasks
                if task.name not in completed
            }
            raise RuntimeError(f"Deadlock detected in task graph: {missing}")

        done, _ = await asyncio.wait(
            running.values(), return_when=asyncio.FIRST_COMPLETED
        )
        for finished in done:
            name = finished.get_name()
            try:
                await finished
            except Exception:
                for pending in running.values():
                    if pending is not finished:
                        pending.cancel()
                raise
            finally:
                completed.add(name)
                running.pop(name, None)


def build_tasks() -> list[Task]:
    return [
        Task("system-packages", tuple(), install_system_packages),
        Task("github-cli", ("system-packages",), install_github_cli),
        Task("node", ("github-cli",), install_node),
        Task("bun", ("node",), install_bun),
        Task("uv", ("system-packages",), install_uv),
        Task("rust", ("system-packages",), install_rust),
        Task("openvscode", ("system-packages",), install_openvscode),
        Task(
            "openvscode-settings",
            ("openvscode",),
            configure_openvscode_settings,
        ),
        Task("env-tools", ("system-packages",), install_env_tools),
        Task("cursor-cli", ("system-packages",), install_cursor_cli),
        Task("docker", ("node",), ensure_docker),
        Task("iptables", ("docker",), update_iptables),
        Task("directories", ("system-packages",), create_directories),
        Task("supervisor", ("directories",), install_supervisor_config),
        Task("upload", ("directories",), upload_repo),
        Task("sync-workspace", ("upload",), sync_workspace),
        Task("bun-install", ("bun", "upload"), bun_install),
        Task("worker-build", ("bun-install",), build_worker),
        Task("worker-builtins", ("worker-build",), prepare_builtins),
        Task("worker-scripts", ("upload",), install_worker_scripts),
        Task("vscode-extension", ("bun-install",), build_vscode_extension),
        Task(
            "install-vscode-extension",
            ("vscode-extension", "openvscode"),
            install_vscode_extension,
        ),
        Task("bun-globals", ("bun",), install_bun_globals),
        Task("tmux-config", ("upload",), install_tmux_conf),
        Task("prompt-wrapper", ("upload",), install_prompt_wrapper),
        Task("startup-script", ("upload", "worker-builtins"), install_startup_script),
    ]


async def provision(args: argparse.Namespace) -> tuple[Snapshot, str, str]:
    client = MorphCloudClient()
    print(
        f"→ Booting base snapshot {args.base_snapshot} with {args.vcpus} vCPU / "
        f"{args.memory} MB RAM / {args.disk} MB disk"
    )
    instance = await client.snapshots.aboot(
        args.base_snapshot,
        vcpus=args.vcpus,
        memory=args.memory,
        disk_size=args.disk,
        metadata={"role": "cmux-parallel-build"},
        ttl_seconds=args.ttl_seconds,
        ttl_action=args.ttl_action,
    )
    await instance.await_until_ready()
    print(f"→ Instance ready: {instance.id}")

    await call_private_port_expansion(instance, client)
    await expose_ports(instance)
    await execute_task_graph(instance, build_tasks())
    await sanity_checks(instance, label="build")

    snapshot = await instance.asnapshot(metadata={"source": "cmux-parallel"})
    print(f"→ Snapshot created: {snapshot.id}")

    if not args.keep_builder:
        await instance.astop()
        print(f"→ Stopped builder instance {instance.id}")

    print("→ Booting verification instance from new snapshot")
    verify_instance = await client.snapshots.aboot(
        snapshot.id,
        vcpus=args.vcpus,
        memory=args.memory,
        disk_size=args.disk,
        metadata={"role": "cmux-parallel-verify"},
        ttl_seconds=args.ttl_seconds,
        ttl_action=args.ttl_action,
    )
    await verify_instance.await_until_ready()
    print(f"→ Verification instance ready: {verify_instance.id}")

    await call_private_port_expansion(verify_instance, client)
    await expose_ports(verify_instance)
    await sanity_checks(verify_instance, label="verification")

    if not args.keep_verifier:
        await verify_instance.astop()
        print(f"→ Stopped verification instance {verify_instance.id}")

    return snapshot, instance.id, verify_instance.id


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Provision a Morph instance in parallel and snapshot it",
    )
    parser.add_argument("base_snapshot", help="Base snapshot id to boot")
    parser.add_argument("--vcpus", type=int, default=DEFAULT_VCPUS)
    parser.add_argument("--memory", type=int, default=DEFAULT_MEMORY_MB)
    parser.add_argument("--disk", type=int, default=DEFAULT_DISK_MB)
    parser.add_argument("--ttl-seconds", type=int, default=DEFAULT_TTL_SECONDS)
    parser.add_argument(
        "--ttl-action",
        choices=["stop", "pause"],
        default=DEFAULT_TTL_ACTION,
    )
    parser.add_argument(
        "--keep-builder",
        action="store_true",
        help="Keep the initial build instance running after snapshot",
    )
    parser.add_argument(
        "--keep-verifier",
        action="store_true",
        help="Keep the verification instance running",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    snapshot, builder_id, verifier_id = asyncio.run(provision(args))
    print("\n=== Provisioning complete ===")
    print(f"Snapshot ID: {snapshot.id}")
    print(f"Builder Instance ID: {builder_id}")
    print(f"Verification Instance ID: {verifier_id}")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        sys.exit(1)

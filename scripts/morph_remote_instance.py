#!/usr/bin/env python3
"""
Provision a Morph instance from an existing snapshot, perform parallelized
environment setup that mirrors the Dockerfile, validate critical tooling, and
snapshot the configured system.

The flow:
1. Boot an instance from the provided snapshot (default snapshot_i7l4i12s)
2. Expose the standard cmux HTTP services
3. Execute dependency graph tasks concurrently using Morph's async APIs
4. Run in-instance sanity checks (cargo/node/bun/uv/envd/envctl + service curls)
5. Snapshot the configured instance, start a new instance from that snapshot,
   and rerun sanity checks for validation
"""

from __future__ import annotations

import argparse
import asyncio
import atexit
import os
import shlex
import subprocess
import tarfile
import tempfile
import textwrap
import time
import typing as t
from dataclasses import dataclass
from pathlib import Path

import dotenv
from morphcloud.api import ApiError, Instance, InstanceExecResponse, MorphCloudClient, Snapshot
from httpx import HTTPStatusError

from morph_common import (
    ensure_docker as docker_install_script,
    ensure_docker_cli_plugins,
)

Command = t.Union[str, t.Sequence[str]]
TaskFunc = t.Callable[["TaskContext"], t.Awaitable[None]]

dotenv.load_dotenv()


class Console:
    def __init__(self) -> None:
        self.quiet = False

    def info(self, value: str) -> None:
        if not self.quiet:
            print(value)

    def always(self, value: str) -> None:
        print(value)


class TimingsCollector:
    def __init__(self) -> None:
        self._entries: list[tuple[str, float]] = []

    def add(self, label: str, duration: float) -> None:
        self._entries.append((label, duration))

    def summary(self) -> list[str]:
        if not self._entries:
            return []
        lines = [f"{label}: {duration:.2f}s" for label, duration in self._entries]
        total = sum(duration for _, duration in self._entries)
        lines.append(f"total: {total:.2f}s")
        return lines


def _exec_git(repo_root: Path, args: list[str]) -> str | None:
    env = dict(os.environ)
    env.setdefault("LC_ALL", "C")
    git_candidates = [env.get("GIT_EXE"), env.get("GIT_BINARY"), "git"]
    errors: list[str] = []
    for candidate in git_candidates:
        if not candidate:
            continue
        try:
            completed = subprocess.run(
                [candidate, *args],
                cwd=str(repo_root),
                env=env,
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError:
            errors.append(f"{candidate}: not found")
            continue
        if completed.returncode == 0:
            return completed.stdout
        errors.append(
            completed.stderr.strip() or f"{candidate}: exit code {completed.returncode}"
        )
    if errors:
        raise RuntimeError(f"git command {' '.join(args)} failed: {'; '.join(errors)}")
    return None


def list_repo_files(repo_root: Path) -> list[Path]:
    output = _exec_git(
        repo_root,
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    )
    if output is None:
        files: list[Path] = []
        for path in repo_root.rglob("*"):
            if path.is_file() and ".git" not in path.parts:
                files.append(path.relative_to(repo_root))
        return files
    entries = [entry for entry in output.split("\0") if entry]
    return [Path(entry) for entry in entries]


def create_repo_archive(repo_root: Path) -> Path:
    files = list_repo_files(repo_root)
    tmp = tempfile.NamedTemporaryFile(prefix="cmux-repo-", suffix=".tar", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    with tarfile.open(tmp_path, "w") as tar:
        for rel_path in files:
            full_path = repo_root / rel_path
            tar.add(full_path, arcname=str(rel_path))
    return tmp_path


async def _expose_standard_ports(instance: Instance, console: Console) -> None:
    ports = [39376, 39377, 39378, 39379, 39380, 39381]
    console.info("Exposing standard HTTP services...")
    async def _expose(port: int) -> tuple[int, str]:
        url = await instance.aexpose_http_service(name=f"port-{port}", port=port)
        return port, url

    exposed = await asyncio.gather(*(_expose(port) for port in ports))
    for port, url in exposed:
        console.info(f"Exposed port {port} → {url}")


async def _await_instance_ready(instance: Instance, *, console: Console) -> None:
    console.info(f"Waiting for instance {instance.id} to become ready...")
    await instance.await_until_ready()
    console.info(f"Instance {instance.id} is ready")


async def _stop_instance(instance: Instance, console: Console) -> None:
    try:
        console.info(f"Stopping instance {instance.id}...")
        await instance.astop()
        console.info(f"Instance {instance.id} stopped")
    except Exception as exc:  # noqa: BLE001
        console.always(f"Failed to stop instance {instance.id}: {exc}")


def _shell_command(command: Command) -> list[str]:
    if isinstance(command, str):
        script = f"set -euo pipefail\n{command}"
        return ["bash", "-lc", script]
    return list(command)


async def _run_command(
    ctx: "TaskContext",
    label: str,
    command: Command,
    *,
    timeout: float | None = None,
) -> InstanceExecResponse:
    ctx.console.info(f"[{label}] running...")
    exec_cmd = _shell_command(command)
    attempts = 0
    max_attempts = 3
    response: InstanceExecResponse | None = None
    while True:
        attempts += 1
        stdout_lines: list[str] = []
        stderr_lines: list[str] = []
        stdout_buffer = ""
        stderr_buffer = ""

        def _emit(text: str, lines: list[str]) -> None:
            lines.append(text)
            ctx.console.info(f"[{label}] {text}")

        def _process_chunk(chunk: str, buffer: str, lines: list[str]) -> str:
            combined = buffer + chunk
            segments = combined.splitlines(keepends=True)
            remainder = ""
            for segment in segments:
                if segment.endswith(("\n", "\r")):
                    line = segment.rstrip("\r\n")
                    _emit(line, lines)
                else:
                    remainder = segment
            return remainder

        def _handle_stdout(chunk: str) -> None:
            nonlocal stdout_buffer
            stdout_buffer = _process_chunk(chunk, stdout_buffer, stdout_lines)

        def _handle_stderr(chunk: str) -> None:
            nonlocal stderr_buffer
            stderr_buffer = _process_chunk(chunk, stderr_buffer, stderr_lines)

        try:
            response = await ctx.instance.aexec(
                exec_cmd,
                timeout=timeout,
                on_stdout=_handle_stdout,
                on_stderr=_handle_stderr,
            )
            break
        except (ApiError, HTTPStatusError) as exc:
            status_code: int | None
            body: str
            if isinstance(exc, ApiError):
                status_code = exc.status_code
                body = (
                    exc.response_body
                    if isinstance(exc.response_body, str)
                    else ""
                )
            else:
                status_code = (
                    exc.response.status_code if exc.response is not None else None
                )
                try:
                    body = exc.response.text if exc.response is not None else ""
                except Exception:  # noqa: BLE001
                    body = ""
            is_handshake_failure = (
                status_code == 502
                and "ssh: unable to authenticate" in body
            )
            is_transient_502 = status_code == 502 and "/exec" in str(
                getattr(getattr(exc, "request", None), "url", "")
            )
            if attempts < max_attempts and (is_handshake_failure or is_transient_502):
                delay = min(2**attempts, 8)
                ctx.console.info(
                    f"[{label}] retrying after transient SSH exec failure "
                    f"(attempt {attempts}/{max_attempts}) in {delay}s"
                )
                await asyncio.sleep(delay)
                continue
            raise

    assert response is not None
    if stdout_buffer:
        _emit(stdout_buffer.rstrip("\r\n"), stdout_lines)
        stdout_buffer = ""
    if stderr_buffer:
        _emit(stderr_buffer.rstrip("\r\n"), stderr_lines)
        stderr_buffer = ""
    if not stdout_lines and response.stdout:
        buffer = ""
        for chunk in response.stdout.splitlines(keepends=True):
            buffer = _process_chunk(chunk, buffer, stdout_lines)
        if buffer:
            _emit(buffer.rstrip("\r\n"), stdout_lines)
    if not stderr_lines and response.stderr:
        buffer = ""
        for chunk in response.stderr.splitlines(keepends=True):
            buffer = _process_chunk(chunk, buffer, stderr_lines)
        if buffer:
            _emit(buffer.rstrip("\r\n"), stderr_lines)
    exit_code = getattr(response, "exit_code", 0)
    if exit_code not in (0, None):
        raise RuntimeError(f"{label} failed with exit code {exit_code}")
    return response


@dataclass(slots=True)
class TaskContext:
    instance: Instance
    repo_root: Path
    remote_repo_root: str
    remote_repo_tar: str
    console: Console
    timings: TimingsCollector

    async def run(
        self,
        label: str,
        command: Command,
        *,
        timeout: float | None = None,
    ) -> InstanceExecResponse:
        return await _run_command(self, label, command, timeout=timeout)


@dataclass(frozen=True)
class TaskDefinition:
    name: str
    func: TaskFunc
    dependencies: tuple[str, ...]
    description: str | None = None


class TaskRegistry:
    def __init__(self) -> None:
        self._tasks: dict[str, TaskDefinition] = {}

    def task(
        self,
        *,
        name: str,
        deps: t.Iterable[str] = (),
        description: str | None = None,
    ) -> t.Callable[[TaskFunc], TaskFunc]:
        def decorator(func: TaskFunc) -> TaskFunc:
            if name in self._tasks:
                raise ValueError(f"Task '{name}' already registered")
            self._tasks[name] = TaskDefinition(
                name=name,
                func=func,
                dependencies=tuple(deps),
                description=description,
            )
            return func

        return decorator

    @property
    def tasks(self) -> dict[str, TaskDefinition]:
        return dict(self._tasks)


registry = TaskRegistry()


@registry.task(name="ensure-docker", description="Install Docker engine and CLI plugins")
async def task_ensure_docker(ctx: TaskContext) -> None:
    await ctx.run("ensure-docker", docker_install_script())
    await ctx.run("ensure-docker-plugins", ensure_docker_cli_plugins())


@registry.task(
    name="install-base-packages",
    deps=("ensure-docker",),
    description="Install build-essential tooling and utilities",
)
async def task_install_base_packages(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        DEBIAN_FRONTEND=noninteractive apt-get update
        DEBIAN_FRONTEND=noninteractive apt-get install -y \
            build-essential curl wget git jq python3 python3-venv python3-distutils \
            make pkg-config g++ gnupg ca-certificates unzip xz-utils zip bzip2 \
            libssl-dev ruby-full perl software-properties-common
        rm -rf /var/lib/apt/lists/*
        """
    )
    await ctx.run("install-base-packages", cmd)


@registry.task(
    name="install-node-runtime",
    deps=("install-base-packages",),
    description="Install Node.js runtime and pnpm via corepack",
)
async def task_install_node(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        set -eux
        NODE_VERSION="24.9.0"
        arch="$(uname -m)"
        case "${arch}" in
          x86_64) node_arch="x64" ;;
          aarch64|arm64) node_arch="arm64" ;;
          *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;;
        esac
        tmp_dir="$(mktemp -d)"
        trap 'rm -rf "${tmp_dir}"' EXIT
        cd "${tmp_dir}"
        curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
        curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
        grep " node-v${NODE_VERSION}-linux-${node_arch}.tar.xz$" SHASUMS256.txt | sha256sum -c -
        tar -xJf "node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -C /usr/local --strip-components=1
        cd /
        ln -sf /usr/local/bin/node /usr/bin/node
        ln -sf /usr/local/bin/npm /usr/bin/npm
        ln -sf /usr/local/bin/npx /usr/bin/npx
        ln -sf /usr/local/bin/corepack /usr/bin/corepack
        npm install -g node-gyp
        corepack enable
        corepack prepare pnpm@10.14.0 --activate
        """
    )
    await ctx.run("install-node-runtime", cmd)


@registry.task(
    name="install-nvm",
    deps=("install-node-runtime",),
    description="Install nvm for runtime use",
)
async def task_install_nvm(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        set -eux
        export NVM_DIR="/root/.nvm"
        mkdir -p "${NVM_DIR}"
        curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh" | bash
        cat <<'PROFILE' > /etc/profile.d/nvm.sh
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
        PROFILE
        bash -lc 'source /etc/profile.d/nvm.sh && nvm --version'
        """
    )
    await ctx.run("install-nvm", cmd)


@registry.task(
    name="install-bun",
    deps=("install-base-packages",),
    description="Install Bun runtime",
)
async def task_install_bun(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        curl -fsSL https://bun.sh/install | bash
        install -m 0755 /root/.bun/bin/bun /usr/local/bin/bun
        ln -sf /usr/local/bin/bun /usr/local/bin/bunx
        bun --version
        bunx --version
        """
    )
    await ctx.run("install-bun", cmd)


@registry.task(
    name="install-uv-python-rust",
    deps=("install-base-packages",),
    description="Install uv, default Python, and Rust toolchain",
)
async def task_install_uv_python_rust(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        set -eux
        ARCH="$(uname -m)"
        case "${ARCH}" in
          x86_64)
            UV_ASSET_SUFFIX="x86_64-unknown-linux-gnu"
            RUST_HOST_TARGET="x86_64-unknown-linux-gnu"
            ;;
          aarch64|arm64)
            UV_ASSET_SUFFIX="aarch64-unknown-linux-gnu"
            RUST_HOST_TARGET="aarch64-unknown-linux-gnu"
            ;;
          *)
            echo "Unsupported architecture: ${ARCH}" >&2
            exit 1
            ;;
        esac
        UV_VERSION_RAW="$(curl -fsSL https://api.github.com/repos/astral-sh/uv/releases/latest | jq -r '.tag_name')"
        UV_VERSION="$(printf '%s' "${UV_VERSION_RAW}" | tr -d ' \\t\\r\\n')"
        curl -fsSL "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-${UV_ASSET_SUFFIX}.tar.gz" -o /tmp/uv.tar.gz
        tar -xzf /tmp/uv.tar.gz -C /tmp
        install -m 0755 /tmp/uv-${UV_ASSET_SUFFIX}/uv /usr/local/bin/uv
        install -m 0755 /tmp/uv-${UV_ASSET_SUFFIX}/uvx /usr/local/bin/uvx
        rm -rf /tmp/uv.tar.gz /tmp/uv-${UV_ASSET_SUFFIX}
        export PATH="/root/.local/bin:/usr/local/cargo/bin:${PATH}"
        uv python install --default
        PIP_VERSION="$(curl -fsSL https://pypi.org/pypi/pip/json | jq -r '.info.version')"
        python3 -m pip install --break-system-packages --upgrade "pip==${PIP_VERSION}"
        RUST_VERSION_RAW="$(curl -fsSL https://static.rust-lang.org/dist/channel-rust-stable.toml \
          | awk '/\\[pkg.rust\\]/{flag=1;next}/\\[pkg\\./{flag=0}flag && /^version =/ {gsub(/\"/,"",$3); split($3, parts, \" \"); print parts[1]; exit}')"
        RUST_VERSION="$(printf '%s' "${RUST_VERSION_RAW}" | tr -d ' \\t\\r\\n')"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
          sh -s -- -y --no-modify-path --profile minimal --default-toolchain "${RUST_VERSION}"
        source /root/.cargo/env
        rustup component add rustfmt --toolchain "${RUST_VERSION}"
        rustup target add "${RUST_HOST_TARGET}" --toolchain "${RUST_VERSION}"
        rustup default "${RUST_VERSION}"
        """
    )
    await ctx.run("install-uv-python-rust", cmd)


@registry.task(
    name="install-openvscode",
    deps=("install-base-packages",),
    description="Install OpenVSCode server",
)
async def task_install_openvscode(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        set -eux
        CODE_RELEASE="$(curl -fsSL https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest | jq -r '.tag_name' | sed 's|^openvscode-server-v||')"
        arch="$(dpkg --print-architecture)"
        case "${arch}" in
          amd64) ARCH="x64" ;;
          arm64) ARCH="arm64" ;;
          *) echo "Unsupported architecture ${arch}" >&2; exit 1 ;;
        esac
        mkdir -p /app/openvscode-server
        url="https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${CODE_RELEASE}/openvscode-server-v${CODE_RELEASE}-linux-${ARCH}.tar.gz"
        curl -fSL --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tar.gz "${url}" || \
          curl -fSL4 --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tar.gz "${url}"
        tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server --strip-components=1
        rm -f /tmp/openvscode-server.tar.gz
        """
    )
    await ctx.run("install-openvscode", cmd)


@registry.task(
    name="install-cursor-cli",
    deps=("install-base-packages",),
    description="Install Cursor CLI",
)
async def task_install_cursor(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        curl https://cursor.com/install -fsS | bash
        /root/.local/bin/cursor-agent --version
        """
    )
    await ctx.run("install-cursor-cli", cmd)


@registry.task(
    name="install-global-cli",
    deps=("install-bun",),
    description="Install global agent CLIs with bun",
)
async def task_install_global_cli(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        bun add -g @openai/codex@0.42.0 @anthropic-ai/claude-code@2.0.0 \
          @google/gemini-cli@0.1.21 opencode-ai@0.6.4 codebuff \
          @devcontainers/cli @sourcegraph/amp
        """
    )
    await ctx.run("install-global-cli", cmd)


@registry.task(
    name="upload-repo",
    deps=("install-base-packages",),
    description="Upload repository to the instance",
)
async def task_upload_repo(ctx: TaskContext) -> None:
    archive = await asyncio.to_thread(create_repo_archive, ctx.repo_root)
    try:
        await ctx.instance.aupload(str(archive), ctx.remote_repo_tar)
        extract_cmd = textwrap.dedent(
            f"""
            rm -rf {shlex.quote(ctx.remote_repo_root)}
            mkdir -p {shlex.quote(ctx.remote_repo_root)}
            tar -xf {shlex.quote(ctx.remote_repo_tar)} -C {shlex.quote(ctx.remote_repo_root)}
            rm -f {shlex.quote(ctx.remote_repo_tar)}
            """
        )
        await ctx.run("extract-repo", extract_cmd)
    finally:
        archive.unlink(missing_ok=True)


@registry.task(
    name="install-repo-dependencies",
    deps=("upload-repo", "install-bun"),
    description="Install workspace dependencies via bun",
)
async def task_install_repo_dependencies(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        f"""
        export PATH="/usr/local/bin:$PATH"
        cd {shlex.quote(ctx.remote_repo_root)}
        bun install --frozen-lockfile
        """
    )
    await ctx.run("install-repo-dependencies", cmd)


@registry.task(
    name="install-gh-cli",
    deps=("upload-repo", "install-base-packages"),
    description="Install GitHub CLI using repo enabler",
)
async def task_install_gh_cli(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        f"""
        set -eux
        install -d /usr/local/share/cmux
        rm -rf /usr/local/share/cmux/repo-enablers
        cp -a {shlex.quote(ctx.remote_repo_root)}/scripts/repo-enablers /usr/local/share/cmux/repo-enablers
        find /usr/local/share/cmux/repo-enablers -type f -name '*.sh' -exec chmod +x {{}} +
        /usr/local/share/cmux/repo-enablers/deb/github-cli.sh
        DEBIAN_FRONTEND=noninteractive apt-get update
        DEBIAN_FRONTEND=noninteractive apt-get install -y gh
        rm -rf /var/lib/apt/lists/*
        """
    )
    await ctx.run("install-gh-cli", cmd)


@registry.task(
    name="install-systemd-units",
    deps=("upload-repo", "install-openvscode"),
    description="Install cmux systemd units and helpers",
)
async def task_install_systemd_units(ctx: TaskContext) -> None:
    repo = shlex.quote(ctx.remote_repo_root)
    cmd = textwrap.dedent(
        f"""
        install -d /usr/local/lib/cmux
        install -Dm0644 {repo}/configs/systemd/cmux.target /usr/lib/systemd/system/cmux.target
        install -Dm0644 {repo}/configs/systemd/cmux-openvscode.service /usr/lib/systemd/system/cmux-openvscode.service
        install -Dm0644 {repo}/configs/systemd/cmux-worker.service /usr/lib/systemd/system/cmux-worker.service
        install -Dm0644 {repo}/configs/systemd/cmux-dockerd.service /usr/lib/systemd/system/cmux-dockerd.service
        install -Dm0644 {repo}/configs/systemd/cmux-vnc.service /usr/lib/systemd/system/cmux-vnc.service
        install -Dm0755 {repo}/configs/systemd/bin/configure-openvscode /usr/local/lib/cmux/configure-openvscode
        install -Dm0755 {repo}/configs/systemd/bin/cmux-rootfs-exec /usr/local/lib/cmux/cmux-rootfs-exec
        install -Dm0755 {repo}/configs/systemd/bin/cmux-start-vnc /usr/local/lib/cmux/cmux-start-vnc
        touch /usr/local/lib/cmux/dockerd.flag
        mkdir -p /var/log/cmux
        mkdir -p /etc/systemd/system/multi-user.target.wants
        mkdir -p /etc/systemd/system/cmux.target.wants
        ln -sf /usr/lib/systemd/system/cmux.target /etc/systemd/system/multi-user.target.wants/cmux.target
        ln -sf /usr/lib/systemd/system/cmux-openvscode.service /etc/systemd/system/cmux.target.wants/cmux-openvscode.service
        ln -sf /usr/lib/systemd/system/cmux-worker.service /etc/systemd/system/cmux.target.wants/cmux-worker.service
        ln -sf /usr/lib/systemd/system/cmux-dockerd.service /etc/systemd/system/cmux.target.wants/cmux-dockerd.service
        ln -sf /usr/lib/systemd/system/cmux-vnc.service /etc/systemd/system/cmux.target.wants/cmux-vnc.service
        mkdir -p /opt/app/overlay/upper /opt/app/overlay/work
        printf 'CMUX_ROOTFS=/\\nCMUX_RUNTIME_ROOT=/\\nCMUX_OVERLAY_UPPER=/opt/app/overlay/upper\\nCMUX_OVERLAY_WORK=/opt/app/overlay/work\\n' > /opt/app/app.env
        systemctl daemon-reload
        systemctl enable cmux.target
        systemctl start cmux.target || true
        """
    )
    await ctx.run("install-systemd-units", cmd)


@registry.task(
    name="install-prompt-wrapper",
    deps=("upload-repo",),
    description="Install prompt-wrapper helper",
)
async def task_install_prompt_wrapper(ctx: TaskContext) -> None:
    repo = shlex.quote(ctx.remote_repo_root)
    cmd = textwrap.dedent(
        f"""
        install -m 0755 {repo}/prompt-wrapper.sh /usr/local/bin/prompt-wrapper
        """
    )
    await ctx.run("install-prompt-wrapper", cmd)


@registry.task(
    name="install-tmux-conf",
    deps=("upload-repo",),
    description="Install tmux configuration",
)
async def task_install_tmux_conf(ctx: TaskContext) -> None:
    repo = shlex.quote(ctx.remote_repo_root)
    cmd = textwrap.dedent(
        f"""
        install -Dm0644 {repo}/configs/tmux.conf /etc/tmux.conf
        """
    )
    await ctx.run("install-tmux-conf", cmd)


@registry.task(
    name="install-collect-scripts",
    deps=("upload-repo",),
    description="Install worker helper scripts",
)
async def task_install_collect_scripts(ctx: TaskContext) -> None:
    repo = shlex.quote(ctx.remote_repo_root)
    cmd = textwrap.dedent(
        f"""
        install -Dm0755 {repo}/apps/worker/scripts/collect-relevant-diff.sh /usr/local/bin/cmux-collect-relevant-diff.sh
        install -Dm0755 {repo}/apps/worker/scripts/collect-crown-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh
        """
    )
    await ctx.run("install-collect-scripts", cmd)


@registry.task(
    name="build-rust-binaries",
    deps=("upload-repo", "install-uv-python-rust"),
    description="Build envd/envctl and cmux-proxy via cargo install",
)
async def task_build_rust_binaries(ctx: TaskContext) -> None:
    repo = shlex.quote(ctx.remote_repo_root)
    cmd = textwrap.dedent(
        f"""
        export PATH="/usr/local/cargo/bin:$PATH"
        cd {repo}
        cargo install --path crates/cmux-env --locked --force
        cargo install --path crates/cmux-proxy --locked --force
        """
    )
    await ctx.run("build-rust-binaries", cmd, timeout=60 * 30)


@registry.task(
    name="link-rust-binaries",
    deps=("build-rust-binaries",),
    description="Symlink built Rust binaries into /usr/local/bin",
)
async def task_link_rust_binaries(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        install -m 0755 /usr/local/cargo/bin/envd /usr/local/bin/envd
        install -m 0755 /usr/local/cargo/bin/envctl /usr/local/bin/envctl
        install -m 0755 /usr/local/cargo/bin/cmux-proxy /usr/local/bin/cmux-proxy
        """
    )
    await ctx.run("link-rust-binaries", cmd)


@registry.task(
    name="configure-envctl",
    deps=("link-rust-binaries",),
    description="Configure envctl defaults",
)
async def task_configure_envctl(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        envctl --version
        envctl install-hook bash
        echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.profile
        echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.bash_profile
        mkdir -p /run/user/0
        chmod 700 /run/user/0
        echo 'export XDG_RUNTIME_DIR=/run/user/0' >> /root/.bashrc
        """
    )
    await ctx.run("configure-envctl", cmd)


async def run_task_graph(registry: TaskRegistry, ctx: TaskContext) -> None:
    remaining = registry.tasks
    completed: set[str] = set()
    while remaining:
        ready = [
            name
            for name, task in remaining.items()
            if all(dep in completed for dep in task.dependencies)
        ]
        if not ready:
            unresolved = ", ".join(remaining)
            raise RuntimeError(f"Dependency cycle detected: {unresolved}")
        tasks_to_run = [remaining[name] for name in ready]
        for task in tasks_to_run:
            ctx.console.info(f"→ starting task {task.name}")
        start = time.perf_counter()
        await asyncio.gather(
            *(
                _run_task_with_timing(ctx, task)
                for task in tasks_to_run
            )
        )
        duration = time.perf_counter() - start
        ctx.timings.add(f"layer:{'+'.join(ready)}", duration)
        for task in tasks_to_run:
            completed.add(task.name)
            remaining.pop(task.name, None)


async def _run_task_with_timing(ctx: TaskContext, task: TaskDefinition) -> None:
    start = time.perf_counter()
    await task.func(ctx)
    ctx.timings.add(f"task:{task.name}", time.perf_counter() - start)


async def run_sanity_checks(
    ctx: TaskContext,
    *,
    label: str,
) -> None:
    checks: list[tuple[str, Command]] = [
        (f"{label}-cargo", "PATH=/usr/local/cargo/bin:$PATH cargo --version"),
        (f"{label}-node", "node --version"),
        (f"{label}-bun", "bun --version"),
        (f"{label}-bunx", "bunx --version"),
        (f"{label}-uv", "uv --version"),
        (f"{label}-uvx", "uvx --version"),
        (f"{label}-envd", "command -v envd && envd --help >/dev/null"),
        (f"{label}-envctl", "envctl --version"),
        (
            f"{label}-curl-vscode",
            textwrap.dedent(
                """
                for attempt in $(seq 1 10); do
                  if curl -fsS -o /dev/null http://127.0.0.1:39378/; then
                    exit 0
                  fi
                  sleep 2
                done
                echo "VS Code endpoint not reachable" >&2
                exit 1
                """
            ),
        ),
        (
            f"{label}-curl-vnc",
            textwrap.dedent(
                """
                for attempt in $(seq 1 10); do
                  if curl -fsS -o /dev/null http://127.0.0.1:39380/vnc.html; then
                    exit 0
                  fi
                  sleep 2
                done
                echo "VNC endpoint not reachable" >&2
                exit 1
                """
            ),
        ),
        (
            f"{label}-curl-devtools",
            textwrap.dedent(
                """
                for attempt in $(seq 1 10); do
                  if curl -fsS -o /dev/null http://127.0.0.1:39381/json/version; then
                    exit 0
                  fi
                  sleep 2
                done
                echo "DevTools endpoint not reachable" >&2
                exit 1
                """
            ),
        ),
    ]
    for check_label, command in checks:
        await ctx.run(check_label, command)


async def snapshot_instance(
    instance: Instance,
    *,
    console: Console,
) -> Snapshot:
    console.info(f"Snapshotting instance {instance.id}...")
    snapshot = await instance.asnapshot()
    console.info(f"Created snapshot {snapshot.id}")
    return snapshot


async def start_instance_from_snapshot(
    client: MorphCloudClient,
    snapshot_id: str,
    *,
    vcpus: int,
    memory: int,
    disk_size: int,
    ttl_seconds: int,
    ttl_action: str,
    console: Console,
) -> Instance:
    console.info(
        f"Booting new instance from snapshot {snapshot_id} "
        f"(vcpus={vcpus}, memory={memory}, disk={disk_size})"
    )
    instance = await client.instances.aboot(
        snapshot_id,
        vcpus=vcpus,
        memory=memory,
        disk_size=disk_size,
        ttl_seconds=ttl_seconds,
        ttl_action=ttl_action,
    )
    await _await_instance_ready(instance, console=console)
    await _expose_standard_ports(instance, console)
    return instance


async def provision_and_snapshot(args: argparse.Namespace) -> None:
    console = Console()
    timings = TimingsCollector()
    client = MorphCloudClient()
    started_instances: list[Instance] = []

    async def _cleanup() -> None:
        while started_instances:
            inst = started_instances.pop()
            await _stop_instance(inst, console)

    async def _atexit_cleanup() -> None:
        await _cleanup()

    def _sync_cleanup() -> None:
        asyncio.run(_atexit_cleanup())

    atexit.register(_sync_cleanup)

    instance = await client.instances.aboot(
        args.snapshot_id,
        vcpus=args.vcpus,
        memory=args.memory,
        disk_size=args.disk_size,
        ttl_seconds=args.ttl_seconds,
        ttl_action=args.ttl_action,
    )
    started_instances.append(instance)
    await _await_instance_ready(instance, console=console)
    await _expose_standard_ports(instance, console)

    ctx = TaskContext(
        instance=instance,
        repo_root=Path(args.repo_root).resolve(),
        remote_repo_root="/cmux",
        remote_repo_tar="/tmp/cmux-repo.tar",
        console=console,
        timings=timings,
    )

    await run_task_graph(registry, ctx)
    await run_sanity_checks(ctx, label="primary")

    snapshot = await snapshot_instance(instance, console=console)

    new_instance = await start_instance_from_snapshot(
        client,
        snapshot.id,
        vcpus=args.vcpus,
        memory=args.memory,
        disk_size=args.disk_size,
        ttl_seconds=args.ttl_seconds,
        ttl_action=args.ttl_action,
        console=console,
    )
    started_instances.append(new_instance)

    new_ctx = TaskContext(
        instance=new_instance,
        repo_root=Path(args.repo_root).resolve(),
        remote_repo_root="/cmux",
        remote_repo_tar="/tmp/cmux-repo.tar",
        console=console,
        timings=timings,
    )
    await run_sanity_checks(new_ctx, label="post-snapshot")

    console.always(f"Provisioning complete. Snapshot id: {snapshot.id}")
    console.always(f"Primary instance: {instance.id}")
    console.always(f"Validation instance: {new_instance.id}")

    summary = timings.summary()
    if summary:
        console.always("\nTiming Summary")
        for line in summary:
            console.always(line)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Provision Morph instance with parallel setup"
    )
    parser.add_argument(
        "--snapshot-id",
        default="snapshot_i7l4i12s",
        help="Base snapshot id to boot from",
    )
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Repository root to upload (default: current directory)",
    )
    parser.add_argument("--vcpus", type=int, default=10, help="vCPU count for instance")
    parser.add_argument(
        "--memory",
        type=int,
        default=32_768,
        help="Memory (MiB) for instance",
    )
    parser.add_argument(
        "--disk-size",
        type=int,
        default=262_144,
        help="Disk size (MiB) for instance",
    )
    parser.add_argument(
        "--ttl-seconds",
        type=int,
        default=3600,
        help="TTL seconds for created instances",
    )
    parser.add_argument(
        "--ttl-action",
        default="pause",
        choices=("pause", "stop"),
        help="Action when TTL expires",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(provision_and_snapshot(args))


if __name__ == "__main__":
    main()

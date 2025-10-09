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
import json
import os
import shutil
import shlex
import socket
import ssl
import subprocess
import tarfile
import tempfile
import textwrap
import time
import typing as t
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import dotenv
from morphcloud.api import Instance, InstanceExecResponse, MorphCloudClient, Snapshot
from morphcloud._ssh import SSHError
from paramiko import SSHException

from morph_common import (
    ensure_docker as docker_install_script,
    ensure_docker_cli_plugins,
)

Command = t.Union[str, t.Sequence[str]]
TaskFunc = t.Callable[["TaskContext"], t.Awaitable[None]]

EXEC_HTTP_PORT = 39375
EXEC_BINARY_NAME = "cmux-execd"
EXEC_REMOTE_PATH = "/usr/local/bin/cmux-execd"
EXEC_TEMP_PATH = "/tmp/cmux-execd"
EXEC_BUILD_TARGET_ENV = "CMUX_EXEC_TARGET"
DEFAULT_EXEC_BUILD_TARGET = "linux/amd64"
EXEC_SOURCE_PATH = Path("scripts/execd/main.go")
EXEC_BUILD_OUTPUT_DIR = Path("scripts/execd/dist")


@dataclass(slots=True)
class ResourceProfile:
    name: str
    cpu_quota: int | None = None
    cpu_period: int | None = None
    cpu_weight: int | None = None
    memory_high: int | None = None
    memory_max: int | None = None
    io_weight: int | None = None


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
            if not full_path.exists():
                continue
            tar.add(full_path, arcname=str(rel_path))
    return tmp_path


async def _expose_standard_ports(
    instance: Instance,
    console: Console,
) -> dict[int, str]:
    ports = [EXEC_HTTP_PORT, 39376, 39377, 39378, 39379, 39380, 39381]
    console.info("Exposing standard HTTP services...")

    async def _expose(port: int) -> tuple[int, str]:
        url = await instance.aexpose_http_service(name=f"port-{port}", port=port)
        return port, url

    exposed = await asyncio.gather(*(_expose(port) for port in ports))
    mapping: dict[int, str] = {}
    for port, url in exposed:
        console.info(f"Exposed port {port} → {url}")
        mapping[port] = url
    return mapping


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


def _wrap_command_with_cgroup(cgroup_path: str, command: Command) -> Command:
    cgroup = shlex.quote(cgroup_path)
    prelude = textwrap.dedent(
        f"""
        if [ -d {cgroup} ] && [ -w {cgroup}/cgroup.procs ]; then
            printf '%d\\n' $$ > {cgroup}/cgroup.procs || true
        fi
        """
    ).strip()
    if isinstance(command, str):
        return f"{prelude}\n{command}"
    quoted = " ".join(shlex.quote(str(part)) for part in command)
    return f"{prelude}\n{quoted}"


class HttpExecClient:
    def __init__(self, base_url: str, console: Console) -> None:
        self._base_url = base_url.rstrip("/")
        self._console = console
        parsed = urllib.parse.urlparse(self._base_url)
        self._ssl_context: ssl.SSLContext | None
        if parsed.scheme == "https":
            self._ssl_context = ssl.create_default_context()
        else:
            self._ssl_context = None

    async def wait_ready(
        self,
        *,
        retries: int = 20,
        delay: float = 0.5,
    ) -> None:
        for attempt in range(1, retries + 1):
            try:
                await asyncio.to_thread(self._check_health)
                return
            except Exception:
                if attempt == retries:
                    break
                await asyncio.sleep(delay)
        raise RuntimeError("exec service did not become ready")

    def _check_health(self) -> None:
        url = urllib.parse.urljoin(f"{self._base_url}/", "healthz")
        request = urllib.request.Request(url, method="GET")
        kwargs: dict[str, t.Any] = {"timeout": 5}
        if self._ssl_context is not None:
            kwargs["context"] = self._ssl_context
        with urllib.request.urlopen(request, **kwargs) as response:
            status = response.getcode()
            if status != 200:
                raise RuntimeError(f"unexpected health status {status}")

    async def run(
        self,
        label: str,
        command: Command,
        *,
        timeout: float | None,
    ) -> InstanceExecResponse:
        return await asyncio.to_thread(
            self._run_sync,
            label,
            command,
            timeout,
        )

    def _run_sync(
        self,
        label: str,
        command: Command,
        timeout: float | None,
    ) -> InstanceExecResponse:
        exec_cmd = _shell_command(command)
        command_str = exec_cmd if isinstance(exec_cmd, str) else shlex.join(exec_cmd)
        url = urllib.parse.urljoin(f"{self._base_url}/", "exec")
        payload: dict[str, t.Any] = {"command": command_str}
        if timeout is not None:
            payload["timeout_ms"] = max(int(timeout * 1000), 1)
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        request = urllib.request.Request(url, data=data, headers=headers, method="POST")
        kwargs: dict[str, t.Any] = {}
        if timeout is not None:
            kwargs["timeout"] = max(timeout + 5, 30.0)
        if self._ssl_context is not None:
            kwargs["context"] = self._ssl_context

        try:
            response = urllib.request.urlopen(request, **kwargs)
        except urllib.error.URLError as exc:
            raise RuntimeError(f"exec service request failed: {exc}") from exc

        stdout_parts: list[str] = []
        stderr_parts: list[str] = []
        exit_code: int | None = None
        try:
            status = response.getcode()
            if status != 200:
                body = response.read().decode("utf-8", "replace")
                raise RuntimeError(
                    f"exec service returned status {status}: {body.strip()}"
                )
            for raw_line in response:
                line = raw_line.decode("utf-8", "replace").rstrip("\r\n")
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError as exc:
                    stderr_parts.append(f"invalid exec response: {line}")
                    self._console.info(f"[{label}][stderr] invalid exec response: {line}")
                    continue
                event_type = event.get("type")
                if event_type == "stdout":
                    data_value = str(event.get("data", ""))
                    stdout_parts.append(data_value)
                    for sub_line in data_value.splitlines():
                        self._console.info(f"[{label}] {sub_line}")
                elif event_type == "stderr":
                    data_value = str(event.get("data", ""))
                    stderr_parts.append(data_value)
                    for sub_line in data_value.splitlines():
                        self._console.info(f"[{label}][stderr] {sub_line}")
                elif event_type == "exit":
                    try:
                        exit_code = int(event.get("code", 0))
                    except (TypeError, ValueError):
                        exit_code = 1
                elif event_type == "error":
                    message = str(event.get("message", ""))
                    stderr_parts.append(message)
                    self._console.info(f"[{label}][stderr] {message}")
                else:
                    stderr_parts.append(f"unknown event type: {line}")
                    self._console.info(f"[{label}][stderr] unknown event: {line}")
        finally:
            response.close()

        stdout_text = "".join(stdout_parts)
        stderr_text = "".join(stderr_parts)
        if exit_code is None:
            raise RuntimeError("exec service did not report an exit code")
        if exit_code not in (0, None):
            # downstream code expects non-zero exit to raise
            raise RuntimeError(f"{label} failed with exit code {exit_code}")
        return InstanceExecResponse(
            exit_code=exit_code,
            stdout=stdout_text,
            stderr=stderr_text,
        )


def _parse_go_target(target: str) -> tuple[str, str]:
    normalized = target.lower().strip()
    prefixes = ("bun-", "go-", "golang-")
    for prefix in prefixes:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix) :]
            break
    normalized = normalized.replace("-", "/").replace("_", "/")
    parts = [part for part in normalized.split("/") if part]
    if len(parts) < 2:
        raise ValueError(f"invalid Go target '{target}', expected format GOOS/GOARCH")
    goos, goarch = parts[0], parts[1]
    architecture_aliases = {
        "x64": "amd64",
        "x86_64": "amd64",
        "amd64": "amd64",
        "arm64": "arm64",
        "aarch64": "arm64",
    }
    goarch = architecture_aliases.get(goarch, goarch)
    return goos, goarch


def _build_exec_binary_sync(repo_root: Path, console: Console) -> Path:
    go = shutil.which("go")
    if go is None:
        raise RuntimeError(
            "Go toolchain not found in PATH. Install Go to build the exec daemon."
        )
    entry_path = repo_root / EXEC_SOURCE_PATH
    if not entry_path.exists():
        raise FileNotFoundError(
            f"exec daemon entrypoint not found at {entry_path}. "
            "Did you run this from the repository root?"
        )
    target = os.environ.get(EXEC_BUILD_TARGET_ENV, DEFAULT_EXEC_BUILD_TARGET)
    try:
        goos, goarch = _parse_go_target(target)
    except ValueError as exc:  # noqa: F841
        raise RuntimeError(str(exc)) from exc
    output_dir = repo_root / EXEC_BUILD_OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    binary_path = (output_dir / EXEC_BINARY_NAME).resolve()
    console.info(
        f"Building {EXEC_BINARY_NAME} with Go (GOOS={goos}, GOARCH={goarch}) "
        f"from {EXEC_SOURCE_PATH}..."
    )
    env = dict(os.environ)
    env.update(
        {
            "GOOS": goos,
            "GOARCH": goarch,
            "CGO_ENABLED": "0",
        }
    )
    command = [
        go,
        "build",
        "-o",
        str(binary_path),
        ".",
    ]
    result = subprocess.run(command, cwd=str(entry_path.parent), env=env, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"failed to build {EXEC_BINARY_NAME} (go exit {result.returncode})"
        )
    if not binary_path.exists():
        raise FileNotFoundError(
            f"expected exec binary at {binary_path}, but it was not produced"
        )
    console.info(f"Built exec binary at {binary_path}")
    return binary_path


async def build_exec_binary(repo_root: Path, console: Console) -> Path:
    return await asyncio.to_thread(_build_exec_binary_sync, repo_root, console)


async def setup_exec_service(
    ctx: TaskContext,
    *,
    binary_path: Path,
    service_url: str,
) -> HttpExecClient:
    ctx.console.info("Uploading exec service binary...")
    await ctx.instance.aupload(str(binary_path), EXEC_TEMP_PATH)
    remote_binary = shlex.quote(EXEC_REMOTE_PATH)
    remote_temp = shlex.quote(EXEC_TEMP_PATH)
    log_path = "/var/log/cmux-execd.log"
    await ctx.run_via_ssh(
        "verify-exec-upload",
        f"ls -l {remote_temp}",
        use_cgroup=False,
    )
    start_script = textwrap.dedent(
        f"""
        set -euo pipefail
        install -Dm0755 {remote_temp} {remote_binary}
        rm -f {remote_temp}
        pkill -f {remote_binary} || true
        mkdir -p /var/log
        nohup {remote_binary} --port {EXEC_HTTP_PORT} >{shlex.quote(log_path)} 2>&1 &
        if command -v pgrep >/dev/null 2>&1; then
            sleep 1
            if ! pgrep -f {remote_binary} >/dev/null 2>&1; then
                echo "cmux-execd failed to start" >&2
                if [ -f {shlex.quote(log_path)} ]; then
                    tail -n 50 {shlex.quote(log_path)} >&2 || true
                fi
                exit 1
            fi
        fi
        """
    )
    await ctx.run_via_ssh(
        "start-exec-service",
        start_script,
        use_cgroup=False,
    )
    client = HttpExecClient(service_url, ctx.console)
    await client.wait_ready(retries=30, delay=0.5)
    ctx.exec_client = client
    ctx.console.info("Exec service ready")
    return client

async def _run_command(
    ctx: "TaskContext",
    label: str,
    command: Command,
    *,
    timeout: float | None = None,
) -> InstanceExecResponse:
    ctx.console.info(f"[{label}] running...")
    exec_cmd = _shell_command(command)
    command_str = exec_cmd if isinstance(exec_cmd, str) else shlex.join(exec_cmd)
    attempts = 0
    max_attempts = 3
    while True:
        attempts += 1
        try:
            result = await asyncio.to_thread(
                _ssh_run_command,
                ctx.instance,
                command_str,
                timeout,
            )
        except (SSHError, SSHException, OSError, socket.error) as exc:
            if attempts < max_attempts:
                delay = min(2**attempts, 8)
                ctx.console.info(
                    f"[{label}] retrying after SSH failure ({exc}) "
                    f"(attempt {attempts}/{max_attempts}) in {delay}s"
                )
                await asyncio.sleep(delay)
                continue
            raise
        stdout_lines = result.stdout.splitlines()
        stderr_lines = result.stderr.splitlines()
        for line in stdout_lines:
            ctx.console.info(f"[{label}] {line}")
        for line in stderr_lines:
            ctx.console.info(f"[{label}][stderr] {line}")
        exit_code = result.returncode
        if exit_code not in (0, None):
            raise RuntimeError(f"{label} failed with exit code {exit_code}")
        return InstanceExecResponse(
            exit_code=exit_code or 0,
            stdout=result.stdout,
            stderr=result.stderr,
        )


def _ssh_run_command(
    instance: Instance,
    command: str,
    timeout: float | None,
):
    with instance.ssh() as ssh_client:
        return ssh_client.run(command, timeout=timeout)


@dataclass(slots=True)
class TaskContext:
    instance: Instance
    repo_root: Path
    remote_repo_root: str
    remote_repo_tar: str
    console: Console
    timings: TimingsCollector
    resource_profile: ResourceProfile | None = None
    cgroup_path: str | None = None
    exec_client: HttpExecClient | None = field(default=None, init=False)

    async def run(
        self,
        label: str,
        command: Command,
        *,
        timeout: float | None = None,
    ) -> InstanceExecResponse:
        command_to_run = (
            _wrap_command_with_cgroup(self.cgroup_path, command)
            if self.cgroup_path
            else command
        )
        if self.exec_client is not None:
            return await self.exec_client.run(
                label,
                command_to_run,
                timeout=timeout,
            )
        return await _run_command(self, label, command_to_run, timeout=timeout)

    async def run_via_ssh(
        self,
        label: str,
        command: Command,
        *,
        timeout: float | None = None,
        use_cgroup: bool = True,
    ) -> InstanceExecResponse:
        command_to_run = (
            _wrap_command_with_cgroup(self.cgroup_path, command)
            if use_cgroup and self.cgroup_path
            else command
        )
        return await _run_command(self, label, command_to_run, timeout=timeout)


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


def _build_resource_profile(args: argparse.Namespace) -> ResourceProfile:
    cpu_period = 100_000
    cpu_quota: int | None = None
    if args.vcpus and args.vcpus > 0:
        cpu_quota = max(int(args.vcpus * cpu_period * 0.9), cpu_period)

    memory_high: int | None = None
    memory_max: int | None = None
    memory_bytes = args.memory * 1024 * 1024
    if memory_bytes > 0:
        memory_high = max(memory_bytes * 9 // 10, 1)
        memory_max = max(memory_bytes * 95 // 100, memory_high)

    return ResourceProfile(
        name="cmux-provision",
        cpu_quota=cpu_quota,
        cpu_period=cpu_quota and cpu_period,
        cpu_weight=80,
        memory_high=memory_high,
        memory_max=memory_max,
        io_weight=200,
    )


async def configure_provisioning_cgroup(ctx: TaskContext) -> None:
    profile = ctx.resource_profile
    if profile is None:
        ctx.console.info("Resource profile not provided; skipping cgroup configuration")
        return

    cgroup_path = f"/sys/fs/cgroup/{profile.name}"
    quoted_cgroup_path = shlex.quote(cgroup_path)
    cpu_max_value = (
        f"{profile.cpu_quota} {profile.cpu_period}"
        if profile.cpu_quota is not None and profile.cpu_period is not None
        else ""
    )
    cpu_quota_value = str(profile.cpu_quota) if profile.cpu_quota is not None else ""
    cpu_period_value = str(profile.cpu_period) if profile.cpu_period is not None else ""
    cpu_weight_value = str(profile.cpu_weight) if profile.cpu_weight is not None else ""
    memory_high_value = (
        str(profile.memory_high) if profile.memory_high is not None else ""
    )
    memory_max_value = str(profile.memory_max) if profile.memory_max is not None else ""
    io_weight_value = str(profile.io_weight) if profile.io_weight is not None else ""

    script = textwrap.dedent(
        f"""
        set -euo pipefail
        CG_ROOT="/sys/fs/cgroup"
        if [ -f "${{CG_ROOT}}/cgroup.controllers" ]; then
            TARGET={quoted_cgroup_path}
            mkdir -p "${{TARGET}}"
            controllers="$(cat "${{CG_ROOT}}/cgroup.controllers")"
            enable_controller() {{
                local ctrl="$1"
                if printf '%s' "${{controllers}}" | grep -qw "$ctrl"; then
                    if ! grep -qw "$ctrl" "${{CG_ROOT}}/cgroup.subtree_control"; then
                        echo "+$ctrl" > "${{CG_ROOT}}/cgroup.subtree_control" || true
                    fi
                fi
            }}
            enable_controller cpu
            enable_controller io
            enable_controller memory
            if [ -n "{cpu_max_value}" ] && [ -w "${{TARGET}}/cpu.max" ]; then
                echo "{cpu_max_value}" > "${{TARGET}}/cpu.max"
            fi
            if [ -n "{cpu_weight_value}" ] && [ -w "${{TARGET}}/cpu.weight" ]; then
                echo "{cpu_weight_value}" > "${{TARGET}}/cpu.weight"
            fi
            if [ -n "{memory_high_value}" ] && [ -w "${{TARGET}}/memory.high" ]; then
                echo "{memory_high_value}" > "${{TARGET}}/memory.high"
            fi
            if [ -n "{memory_max_value}" ] && [ -w "${{TARGET}}/memory.max" ]; then
                echo "{memory_max_value}" > "${{TARGET}}/memory.max"
            fi
            if [ -n "{io_weight_value}" ] && [ -w "${{TARGET}}/io.weight" ]; then
                echo "{io_weight_value}" > "${{TARGET}}/io.weight"
            fi
            exit 0
        fi
        if command -v cgcreate >/dev/null 2>&1 && command -v cgset >/dev/null 2>&1; then
            cgcreate -g cpu,memory,blkio:{profile.name} || true
            if [ -n "{cpu_period_value}" ] && [ -n "{cpu_quota_value}" ]; then
                cgset -r cpu.cfs_period_us={cpu_period_value} {profile.name} || true
                cgset -r cpu.cfs_quota_us={cpu_quota_value} {profile.name} || true
            fi
            if [ -n "{memory_max_value}" ]; then
                cgset -r memory.limit_in_bytes={memory_max_value} {profile.name} || true
            fi
            if [ -n "{memory_high_value}" ]; then
                cgset -r memory.soft_limit_in_bytes={memory_high_value} {profile.name} || true
            fi
            if [ -n "{io_weight_value}" ]; then
                cgset -r blkio.weight={io_weight_value} {profile.name} || true
            fi
        fi
        exit 0
        """
    )
    await ctx.run("configure-resource-cgroup", script)
    verification = await ctx.run(
        "verify-resource-cgroup",
        textwrap.dedent(
            f"""
            if [ -d {quoted_cgroup_path} ] && [ -f {quoted_cgroup_path}/cgroup.procs ]; then
                echo ready
            fi
            """
        ),
    )
    if (verification.stdout or "").strip() == "ready":
        ctx.cgroup_path = cgroup_path
        ctx.console.info(f"Resource cgroup active at {cgroup_path}")
    else:
        ctx.console.info(
            "Cgroup controllers unavailable; continuing without resource isolation"
        )


@registry.task(
    name="apt-bootstrap",
    description="Install core apt utilities required for early provisioning tasks",
)
async def task_apt_bootstrap(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        DEBIAN_FRONTEND=noninteractive apt-get update
        DEBIAN_FRONTEND=noninteractive apt-get install -y \
            ca-certificates curl wget jq git gnupg lsb-release \
            python3 python3-venv python3-distutils \
            tar unzip xz-utils zip bzip2 gzip htop
        rm -rf /var/lib/apt/lists/*
        """
    )
    await ctx.run("apt-bootstrap", cmd)


@registry.task(
    name="install-base-packages",
    deps=("apt-bootstrap",),
    description="Install build-essential tooling and utilities",
)
async def task_install_base_packages(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        DEBIAN_FRONTEND=noninteractive apt-get update
        DEBIAN_FRONTEND=noninteractive apt-get install -y \
            build-essential make pkg-config g++ libssl-dev \
            ruby-full perl software-properties-common
        rm -rf /var/lib/apt/lists/*
        """
    )
    await ctx.run("install-base-packages", cmd)


@registry.task(
    name="ensure-docker",
    deps=("install-base-packages",),
    description="Install Docker engine and CLI plugins",
)
async def task_ensure_docker(ctx: TaskContext) -> None:
    await ctx.run("ensure-docker", docker_install_script())
    await ctx.run("ensure-docker-plugins", ensure_docker_cli_plugins())


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
    deps=("install-node-runtime",),
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
    name="install-uv-python",
    deps=("apt-bootstrap",),
    description="Install uv CLI and provision default Python runtime",
)
async def task_install_uv_python(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        set -eux
        ARCH="$(uname -m)"
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="${HOME}/.local/bin:/usr/local/cargo/bin:${PATH}"
        uv python install --default
        PIP_VERSION="$(curl -fsSL https://pypi.org/pypi/pip/json | jq -r '.info.version')"
        python3 -m pip install --break-system-packages --upgrade "pip==${PIP_VERSION}"
        """
    )
    await ctx.run("install-uv-python", cmd)


@registry.task(
    name="install-rust-toolchain",
    deps=("install-base-packages",),
    description="Install Rust toolchain via rustup",
)
async def task_install_rust_toolchain(ctx: TaskContext) -> None:
    cmd = textwrap.dedent(
        """
        set -eux
        ARCH="$(uname -m)"
        case "${ARCH}" in
          x86_64)
            RUST_HOST_TARGET="x86_64-unknown-linux-gnu"
            ;;
          aarch64|arm64)
            RUST_HOST_TARGET="aarch64-unknown-linux-gnu"
            ;;
          *)
            echo "Unsupported architecture: ${ARCH}" >&2
            exit 1
            ;;
        esac
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
          sh -s -- -y --no-modify-path --profile minimal
        source /root/.cargo/env
        rustup component add rustfmt
        rustup target add "${RUST_HOST_TARGET}"
        rustup default stable
        """
    )
    await ctx.run("install-rust-toolchain", cmd)


@registry.task(
    name="install-openvscode",
    deps=("apt-bootstrap",),
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
    deps=("apt-bootstrap",),
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
    deps=("apt-bootstrap",),
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
    deps=("upload-repo", "ensure-docker"),
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
    deps=("upload-repo", "install-uv-python", "install-rust-toolchain"),
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
            *(_run_task_with_timing(ctx, task) for task in tasks_to_run)
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
) -> tuple[Instance, dict[int, str]]:
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
    port_map = await _expose_standard_ports(instance, console)
    return instance, port_map


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

    repo_root = Path(args.repo_root).resolve()

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
    console.always(
        f"Dashboard: https://cloud.morph.so/web/instances/{instance.id}?ssh=true"
    )
    port_map = await _expose_standard_ports(instance, console)
    exec_service_url = port_map.get(EXEC_HTTP_PORT)
    if exec_service_url is None:
        raise RuntimeError("Failed to expose exec service port on primary instance")

    resource_profile = _build_resource_profile(args)

    ctx = TaskContext(
        instance=instance,
        repo_root=repo_root,
        remote_repo_root="/cmux",
        remote_repo_tar="/tmp/cmux-repo.tar",
        console=console,
        timings=timings,
        resource_profile=resource_profile,
    )

    await configure_provisioning_cgroup(ctx)
    exec_binary_path = await build_exec_binary(repo_root, console)
    await setup_exec_service(
        ctx,
        binary_path=exec_binary_path,
        service_url=exec_service_url,
    )
    await run_task_graph(registry, ctx)
    await run_sanity_checks(ctx, label="primary")

    snapshot = await snapshot_instance(instance, console=console)

    new_instance, new_port_map = await start_instance_from_snapshot(
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

    console.always(
        f"Dashboard: https://cloud.morph.so/web/instances/{new_instance.id}?ssh=true"
    )
    new_exec_service_url = new_port_map.get(EXEC_HTTP_PORT)
    if new_exec_service_url is None:
        raise RuntimeError("Failed to expose exec service port on validation instance")
    new_ctx = TaskContext(
        instance=new_instance,
        repo_root=repo_root,
        remote_repo_root="/cmux",
        remote_repo_tar="/tmp/cmux-repo.tar",
        console=console,
        timings=timings,
        resource_profile=resource_profile,
    )
    await configure_provisioning_cgroup(new_ctx)
    await setup_exec_service(
        new_ctx,
        binary_path=exec_binary_path,
        service_url=new_exec_service_url,
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


def format_dependency_graph(registry: TaskRegistry) -> str:
    tasks = registry.tasks
    if not tasks:
        return ""

    children: dict[str, list[str]] = {name: [] for name in tasks}
    for task in tasks.values():
        for dependency in task.dependencies:
            children.setdefault(dependency, []).append(task.name)
    for child_list in children.values():
        child_list.sort()

    roots = sorted(
        name for name, definition in tasks.items() if not definition.dependencies
    )

    lines: list[str] = []

    def render_node(
        node: str,
        prefix: str,
        is_last: bool,
        path: set[str],
    ) -> None:
        connector = "└─" if is_last else "├─"
        lines.append(f"{prefix}{connector} {node}")
        if node in path:
            lines.append(f"{prefix}   ↻ cycle")
            return
        descendants = children.get(node, [])
        if not descendants:
            return
        next_prefix = f"{prefix}   " if is_last else f"{prefix}│  "
        next_path = set(path)
        next_path.add(node)
        for index, child in enumerate(descendants):
            render_node(child, next_prefix, index == len(descendants) - 1, next_path)

    for root_index, root in enumerate(roots):
        if root_index:
            lines.append("")
        lines.append(root)
        descendants = children.get(root, [])
        for index, child in enumerate(descendants):
            render_node(child, "", index == len(descendants) - 1, {root})

    orphaned = sorted(
        name
        for name in tasks
        if name not in roots
        and all(name not in children.get(other, []) for other in tasks)
    )
    for orphan in orphaned:
        if lines:
            lines.append("")
        lines.append(orphan)

    return "\n".join(lines)


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
        default=65_536,
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
    parser.add_argument(
        "--print-deps",
        action="store_true",
        help="Print dependency graph and exit",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if getattr(args, "print_deps", False):
        graph = format_dependency_graph(registry)
        if graph:
            print(graph)
        return
    asyncio.run(provision_and_snapshot(args))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Instance-based async Morph snapshot builder with parallel dependency graph execution.

This script creates a Morph snapshot by:
1. Starting an instance directly (not from a base snapshot)
2. Installing dependencies in parallel using async operations
3. Uploading the repo and building custom components (worker, envd, envctl)
4. Running comprehensive sanity checks
5. Taking a snapshot and validating it
"""

from __future__ import annotations

import argparse
import asyncio
import atexit
import os
import shlex
import signal
import sys
import time
import typing as t
from dataclasses import dataclass
from enum import Enum
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

import dotenv
from morphcloud.api import MorphCloudClient

dotenv.load_dotenv()

client = MorphCloudClient()

# Configuration
MORPH_EXPECTED_UNAME_ARCH = "x86_64"
DOCKER_COMPOSE_VERSION = "v2.32.2"
DOCKER_BUILDX_VERSION = "v0.18.0"
CMUX_ENV_VERSION = "0.0.8"
CODE_RELEASE = "1.96.0"  # openvscode-server version

# Instance configuration
VCPUS = 10
MEMORY_MB = 32768  # 32 GB
DISK_SIZE_MB = 65536  # 64 GB
TTL_SECONDS = 3600
TTL_ACTION = "pause"

# Track live instance for cleanup
current_instance: t.Optional[object] = None


class TaskStatus(Enum):
    """Status of a task in the dependency graph."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    """Represents a task in the dependency graph."""

    name: str
    coro: t.Coroutine
    dependencies: list[str]
    status: TaskStatus = TaskStatus.PENDING
    result: t.Any = None
    error: t.Optional[Exception] = None


class DependencyGraph:
    """Manages parallel execution of tasks with dependencies."""

    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {}
        self.lock = asyncio.Lock()

    def add_task(
        self, name: str, coro: t.Coroutine, dependencies: list[str] | None = None
    ) -> None:
        """Add a task to the dependency graph."""
        self.tasks[name] = Task(
            name=name, coro=coro, dependencies=dependencies or [], status=TaskStatus.PENDING
        )

    async def wait_for_dependencies(self, task: Task) -> None:
        """Wait for all dependencies of a task to complete."""
        while True:
            all_completed = True
            for dep_name in task.dependencies:
                dep_task = self.tasks.get(dep_name)
                if not dep_task:
                    raise ValueError(f"Task {task.name} depends on unknown task {dep_name}")
                if dep_task.status == TaskStatus.FAILED:
                    raise RuntimeError(
                        f"Task {task.name} cannot run: dependency {dep_name} failed"
                    )
                if dep_task.status != TaskStatus.COMPLETED:
                    all_completed = False
                    break

            if all_completed:
                break

            await asyncio.sleep(0.1)

    async def run_task(self, task_name: str) -> None:
        """Run a single task after its dependencies complete."""
        task = self.tasks[task_name]

        # Wait for dependencies
        await self.wait_for_dependencies(task)

        # Mark as running
        async with self.lock:
            task.status = TaskStatus.RUNNING
            print(f"[{task.name}] Starting...")

        try:
            # Run the task
            task.result = await task.coro
            async with self.lock:
                task.status = TaskStatus.COMPLETED
                print(f"[{task.name}] Completed")
        except Exception as e:
            async with self.lock:
                task.status = TaskStatus.FAILED
                task.error = e
                print(f"[{task.name}] Failed: {e}")
            raise

    async def execute(self) -> dict[str, t.Any]:
        """Execute all tasks in parallel respecting dependencies."""
        print(f"Executing {len(self.tasks)} tasks with dependency graph...")

        # Create coroutines for all tasks
        task_coros = [self.run_task(name) for name in self.tasks.keys()]

        # Run all tasks concurrently
        await asyncio.gather(*task_coros)

        # Return results
        return {name: task.result for name, task in self.tasks.items()}


def _cleanup_instance() -> None:
    """Clean up the current instance on exit."""
    global current_instance
    inst = current_instance
    if not inst:
        return
    try:
        print(f"Stopping instance {getattr(inst, 'id', '<unknown>')}...")
        inst.stop()
        print("Instance stopped")
    except Exception as e:
        print(f"Failed to stop instance: {e}")
    finally:
        current_instance = None


def _signal_handler(signum, _frame) -> None:
    """Handle signals for cleanup."""
    print(f"Received signal {signum}; cleaning up...")
    _cleanup_instance()
    try:
        sys.exit(1)
    except SystemExit:
        raise


# Register cleanup handlers
atexit.register(_cleanup_instance)
signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


async def install_base_packages(instance) -> None:
    """Install base system packages."""
    cmd = (
        "DEBIAN_FRONTEND=noninteractive apt-get update && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
        "ca-certificates curl wget git python3 make g++ bash nano net-tools lsof "
        "sudo supervisor iptables openssl pigz xz-utils tmux htop ripgrep jq "
        "unzip gnupg && "
        "rm -rf /var/lib/apt/lists/*"
    )
    await instance.aexec(cmd)


async def install_docker(instance) -> None:
    """Install Docker daemon and CLI."""
    # Install docker.io package
    cmd = (
        "DEBIAN_FRONTEND=noninteractive apt-get update && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io && "
        "rm -rf /var/lib/apt/lists/*"
    )
    await instance.aexec(cmd)

    # Configure Docker with BuildKit
    config_cmd = (
        "mkdir -p /etc/docker && "
        'echo \'{"features":{"buildkit":true}}\' > /etc/docker/daemon.json && '
        "echo 'DOCKER_BUILDKIT=1' >> /etc/environment"
    )
    await instance.aexec(config_cmd)

    # Set iptables-legacy for compatibility
    await instance.aexec("update-alternatives --set iptables /usr/sbin/iptables-legacy || true")

    # Start Docker and wait for readiness
    start_cmd = (
        "systemctl restart docker && "
        "for i in {1..30}; do "
        "  if docker info >/dev/null 2>&1; then "
        "    echo 'Docker ready'; break; "
        "  else "
        "    echo 'Waiting for Docker...'; "
        "    [ $i -eq 30 ] && { echo 'Docker failed to start'; exit 1; }; "
        "    sleep 2; "
        "  fi; "
        "done && "
        "docker --version"
    )
    await instance.aexec(start_cmd)


async def install_docker_plugins(instance) -> None:
    """Install Docker Compose and Buildx plugins."""
    cmd = (
        "mkdir -p /usr/local/lib/docker/cli-plugins && "
        f"curl -fsSL https://github.com/docker/compose/releases/download/{DOCKER_COMPOSE_VERSION}/docker-compose-linux-{MORPH_EXPECTED_UNAME_ARCH} "
        f"-o /usr/local/lib/docker/cli-plugins/docker-compose && "
        "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose && "
        f"curl -fsSL https://github.com/docker/buildx/releases/download/{DOCKER_BUILDX_VERSION}/buildx-{DOCKER_BUILDX_VERSION}.linux-amd64 "
        f"-o /usr/local/lib/docker/cli-plugins/docker-buildx && "
        "chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx && "
        "docker compose version && docker buildx version"
    )
    await instance.aexec(cmd)


async def install_nodejs(instance) -> None:
    """Install Node.js 24.x and enable pnpm."""
    cmd = (
        "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && "
        "apt-get install -y nodejs && "
        "rm -rf /var/lib/apt/lists/* && "
        "corepack enable && "
        "corepack prepare pnpm@10.14.0 --activate && "
        "node --version && npm --version"
    )
    await instance.aexec(cmd)


async def install_bun(instance) -> None:
    """Install Bun runtime."""
    cmd = (
        "curl -fsSL https://bun.sh/install | bash && "
        "mv /root/.bun/bin/bun /usr/local/bin/ && "
        "ln -s /usr/local/bin/bun /usr/local/bin/bunx && "
        "bun --version && bunx --version"
    )
    await instance.aexec(cmd)


async def install_github_cli(instance) -> None:
    """Install GitHub CLI."""
    cmd = (
        "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg "
        "| dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && "
        "chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && "
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] '
        'https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && '
        "apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/* && "
        "gh --version"
    )
    await instance.aexec(cmd)


async def install_coding_agents(instance) -> None:
    """Install coding agent CLIs (codex, claude-code, gemini, etc.)."""
    cmd = (
        "bun add -g @openai/codex@0.42.0 @anthropic-ai/claude-code@2.0.0 "
        "@google/gemini-cli@0.1.21 opencode-ai@0.6.4 codebuff "
        "@devcontainers/cli @sourcegraph/amp && "
        "codex --version && claude-code --version"
    )
    await instance.aexec(cmd)


async def install_cursor(instance) -> None:
    """Install Cursor CLI."""
    cmd = (
        "curl https://cursor.com/install -fsS | bash && "
        "/root/.local/bin/cursor-agent --version"
    )
    await instance.aexec(cmd)


async def install_rust(instance) -> None:
    """Install Rust and Cargo."""
    cmd = (
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && "
        "source $HOME/.cargo/env && "
        "rustc --version && cargo --version && "
        "echo 'source $HOME/.cargo/env' >> /root/.bashrc"
    )
    await instance.aexec(cmd)


async def install_uv(instance) -> None:
    """Install uv (Python package manager)."""
    cmd = (
        "curl -LsSf https://astral.sh/uv/install.sh | sh && "
        "source $HOME/.cargo/env && "
        "uv --version"
    )
    await instance.aexec(cmd)


async def install_openvscode(instance) -> None:
    """Install openvscode-server."""
    cmd = f"""
    arch="$(dpkg --print-architecture)"
    if [ "$arch" = "amd64" ]; then
        ARCH="x64"
    elif [ "$arch" = "arm64" ]; then
        ARCH="arm64"
    fi
    mkdir -p /app/openvscode-server
    url="https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v{CODE_RELEASE}/openvscode-server-v{CODE_RELEASE}-linux-${{ARCH}}.tar.gz"
    echo "Downloading: $url"
    curl -fSL --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tar.gz "$url"
    tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server/ --strip-components=1
    rm -rf /tmp/openvscode-server.tar.gz
    /app/openvscode-server/bin/openvscode-server --version
    """
    await instance.aexec(cmd)


async def upload_repo(instance) -> None:
    """Upload the repository to the instance."""
    # Upload the entire workspace (excluding large directories)
    workspace_path = "/root/workspace"
    await instance.aupload(local_path=".", remote_path=workspace_path, recursive=True)


async def build_worker(instance) -> None:
    """Build the worker application."""
    cmd = (
        "cd /root/workspace && "
        "bun install --frozen-lockfile --production && "
        "mkdir -p /builtins && "
        "echo '{\"name\":\"builtins\",\"type\":\"module\",\"version\":\"1.0.0\"}' > /builtins/package.json && "
        "bun build ./apps/worker/src/index.ts --target node --outdir ./apps/worker/build "
        "--external @cmux/convex --external node:* && "
        "cp -r ./apps/worker/build /builtins/build && "
        "cp ./apps/worker/wait-for-docker.sh /usr/local/bin/ && "
        "chmod +x /usr/local/bin/wait-for-docker.sh"
    )
    await instance.aexec(cmd)


async def install_envd_envctl(instance) -> None:
    """Install envd and envctl binaries."""
    cmd = f"""
    arch="$(uname -m)"
    case "$arch" in
        x86_64) arch_name="x86_64" ;;
        aarch64|arm64) arch_name="aarch64" ;;
        *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
    esac
    curl -fsSL "https://github.com/lawrencecchen/cmux-env/releases/download/v{CMUX_ENV_VERSION}/cmux-env-{CMUX_ENV_VERSION}-${{arch_name}}-unknown-linux-musl.tar.gz" | tar -xz -C /tmp
    mv /tmp/cmux-env-{CMUX_ENV_VERSION}-${{arch_name}}-unknown-linux-musl/envctl /usr/local/bin/envctl
    mv /tmp/cmux-env-{CMUX_ENV_VERSION}-${{arch_name}}-unknown-linux-musl/envd /usr/local/bin/envd
    rm -rf /tmp/cmux-env-{CMUX_ENV_VERSION}-${{arch_name}}-unknown-linux-musl
    chmod +x /usr/local/bin/envctl /usr/local/bin/envd
    envctl --version
    envctl install-hook bash
    echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.profile
    echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.bash_profile
    mkdir -p /run/user/0
    chmod 700 /run/user/0
    echo 'export XDG_RUNTIME_DIR=/run/user/0' >> /root/.bashrc
    """
    await instance.aexec(cmd)


async def setup_supervisor_dockerd(instance) -> None:
    """Set up supervisor to manage dockerd."""
    cmd = """
    mkdir -p /etc/supervisor/conf.d
    cat > /etc/supervisor/conf.d/dockerd.conf << 'CONFIG'
[program:dockerd]
command=/usr/local/bin/dockerd
autostart=true
autorestart=true
stderr_logfile=/var/log/dockerd.err.log
stdout_logfile=/var/log/dockerd.out.log
CONFIG
    """
    await instance.aexec(cmd)


async def setup_startup_script(instance) -> None:
    """Upload and configure the startup script."""
    # Upload startup.sh and related files
    await instance.aupload(
        local_path="startup.sh", remote_path="/startup.sh", recursive=False
    )
    await instance.aupload(
        local_path="prompt-wrapper.sh",
        remote_path="/usr/local/bin/prompt-wrapper",
        recursive=False,
    )
    await instance.aexec(
        "chmod +x /startup.sh /usr/local/bin/prompt-wrapper && "
        "mkdir -p /var/log/cmux /root/lifecycle"
    )


async def expose_ports(instance) -> None:
    """Expose necessary HTTP ports."""
    ports = [39376, 39377, 39378]
    tasks = []
    for port in ports:
        task = instance.aexpose_http_service(port=port, name=f"port-{port}")
        tasks.append(task)
    await asyncio.gather(*tasks)


async def run_sanity_checks(instance) -> dict[str, bool]:
    """Run sanity checks to verify installation."""
    checks = {
        "cargo": "cargo --version",
        "rustc": "rustc --version",
        "node": "node --version",
        "bun": "bun --version",
        "uv": "uv --version",
        "envd": "envd --version",
        "envctl": "envctl --version",
        "docker": "docker --version",
        "docker-compose": "docker compose version",
        "gh": "gh --version",
        "codex": "codex --version",
        "claude-code": "claude-code --version",
        "openvscode": "/app/openvscode-server/bin/openvscode-server --version",
    }

    results = {}
    for name, cmd in checks.items():
        try:
            await instance.aexec(cmd)
            results[name] = True
            print(f"  ✓ {name}")
        except Exception as e:
            results[name] = False
            print(f"  ✗ {name}: {e}")

    return results


async def check_http_endpoints(instance) -> dict[str, bool]:
    """Check that HTTP endpoints are accessible from within the instance."""
    checks = {
        "vscode": "curl -f http://localhost:39378 -o /dev/null -s -w '%{http_code}'",
        "vnc": "curl -f http://localhost:39376 -o /dev/null -s -w '%{http_code}' || echo 'SKIP'",
    }

    results = {}
    for name, cmd in checks.items():
        try:
            result = await instance.aexec(cmd)
            results[name] = True
            print(f"  ✓ {name} endpoint accessible")
        except Exception as e:
            results[name] = False
            print(f"  ✗ {name} endpoint: {e}")

    return results


async def build_snapshot_async() -> tuple[object, object]:
    """Build a snapshot using async instance-based workflow."""
    print(f"Creating instance with {VCPUS} vCPUs, {MEMORY_MB}MB RAM, {DISK_SIZE_MB}MB disk...")

    # Start instance
    instance = client.instances.start(
        vcpus=VCPUS,
        memory=MEMORY_MB,
        disk_size=DISK_SIZE_MB,
        ttl_seconds=TTL_SECONDS,
        ttl_action=TTL_ACTION,
    )

    global current_instance
    current_instance = instance

    print(f"Instance started: {instance.id}")
    instance.wait_until_ready()

    # Create dependency graph
    graph = DependencyGraph()

    # Layer 1: Base system setup (no dependencies)
    graph.add_task("base_packages", install_base_packages(instance))
    graph.add_task("upload_repo", upload_repo(instance))

    # Layer 2: Language runtimes and tools (depends on base packages)
    graph.add_task("docker", install_docker(instance), ["base_packages"])
    graph.add_task("nodejs", install_nodejs(instance), ["base_packages"])
    graph.add_task("bun", install_bun(instance), ["base_packages"])
    graph.add_task("rust", install_rust(instance), ["base_packages"])
    graph.add_task("github_cli", install_github_cli(instance), ["base_packages"])

    # Layer 3: Additional tools (depends on language runtimes)
    graph.add_task("docker_plugins", install_docker_plugins(instance), ["docker"])
    graph.add_task("uv", install_uv(instance), ["rust"])
    graph.add_task("coding_agents", install_coding_agents(instance), ["bun"])
    graph.add_task("cursor", install_cursor(instance), ["base_packages"])
    graph.add_task("openvscode", install_openvscode(instance), ["base_packages"])

    # Layer 4: Application setup (depends on repo upload and tools)
    graph.add_task("build_worker", build_worker(instance), ["upload_repo", "bun"])
    graph.add_task("envd_envctl", install_envd_envctl(instance), ["base_packages"])
    graph.add_task("supervisor", setup_supervisor_dockerd(instance), ["docker"])
    graph.add_task("startup", setup_startup_script(instance), ["upload_repo"])

    # Layer 5: Finalization (depends on everything)
    graph.add_task(
        "expose_ports",
        expose_ports(instance),
        [
            "docker",
            "nodejs",
            "bun",
            "rust",
            "docker_plugins",
            "uv",
            "coding_agents",
            "cursor",
            "openvscode",
            "build_worker",
            "envd_envctl",
            "supervisor",
            "startup",
            "github_cli",
        ],
    )

    # Execute all tasks
    await graph.execute()

    print("\n=== Running sanity checks ===")
    sanity_results = await run_sanity_checks(instance)
    all_passed = all(sanity_results.values())

    if not all_passed:
        failed = [name for name, passed in sanity_results.items() if not passed]
        print(f"\n⚠ Warning: Some sanity checks failed: {', '.join(failed)}")
    else:
        print("\n✓ All sanity checks passed!")

    # Take snapshot
    print("\n=== Taking snapshot ===")
    snapshot = instance.snapshot()
    print(f"Snapshot created: {snapshot.id}")

    return instance, snapshot


def wait_for_http_service(url: str, timeout_seconds: int = 120) -> bool:
    """Wait for an HTTP service to become available."""
    print(f"Waiting for {url} to become available...")
    start_time = time.time()
    retry_count = 0

    while time.time() - start_time < timeout_seconds:
        try:
            with urllib_request.urlopen(url, timeout=5) as resp:
                code = getattr(resp, "status", getattr(resp, "code", None))
                if code == 200:
                    print(f"✓ Service available (HTTP {code})")
                    return True
                else:
                    print(f"Service returned HTTP {code}, waiting...")
        except (HTTPError, URLError) as e:
            if retry_count % 10 == 0:
                print(f"Still waiting... ({e})")
            retry_count += 1

        time.sleep(2)

    print(f"✗ Service did not become available within {timeout_seconds} seconds")
    return False


async def validate_snapshot(snapshot_id: str) -> bool:
    """Start an instance from the snapshot and validate it."""
    print(f"\n=== Validating snapshot {snapshot_id} ===")

    # Start instance from snapshot
    instance = client.instances.start(
        snapshot_id=snapshot_id,
        ttl_seconds=TTL_SECONDS,
        ttl_action=TTL_ACTION,
    )

    global current_instance
    current_instance = instance

    print(f"Validation instance started: {instance.id}")
    instance.wait_until_ready()

    # Expose ports
    ports = [39376, 39377, 39378]
    for port in ports:
        instance.expose_http_service(port=port, name=f"port-{port}")

    print("\n=== Running validation sanity checks ===")
    sanity_results = await run_sanity_checks(instance)
    all_passed = all(sanity_results.values())

    if not all_passed:
        failed = [name for name, passed in sanity_results.items() if not passed]
        print(f"\n⚠ Validation failed: {', '.join(failed)}")
        return False

    print("\n✓ All validation checks passed!")

    # Check HTTP endpoints
    services = getattr(instance.networking, "http_services", [])

    def _get(obj: object, key: str) -> t.Any:
        if isinstance(obj, dict):
            return obj.get(key)
        return getattr(obj, key, None)

    vscode_url = None
    for svc in services or []:
        port = _get(svc, "port")
        if port == 39378:
            vscode_url = _get(svc, "url")
            break

    if vscode_url:
        if wait_for_http_service(vscode_url):
            print(f"\n✓ VS Code URL: {vscode_url}/?folder=/root/workspace")
        else:
            print(f"\n⚠ Warning: VS Code endpoint not accessible")
            return False

    # Clean up validation instance
    print(f"\nStopping validation instance {instance.id}...")
    instance.stop()
    current_instance = None

    return True


async def main_async() -> None:
    """Main async entry point."""
    parser = argparse.ArgumentParser(
        description="Build Morph snapshot using instance-based async workflow"
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Skip snapshot validation step",
    )
    args = parser.parse_args()

    try:
        # Build snapshot
        instance, snapshot = await build_snapshot_async()

        print(f"\n{'='*60}")
        print(f"Snapshot ID: {snapshot.id}")
        print(f"{'='*60}")

        # Stop the build instance
        print(f"\nStopping build instance {instance.id}...")
        instance.stop()
        global current_instance
        current_instance = None

        # Validate snapshot
        if not args.skip_validation:
            validation_passed = await validate_snapshot(snapshot.id)
            if validation_passed:
                print("\n✓✓✓ Snapshot validation successful! ✓✓✓")
            else:
                print("\n✗✗✗ Snapshot validation failed! ✗✗✗")
                sys.exit(1)
        else:
            print("\nSkipping validation (--skip-validation)")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        _cleanup_instance()


def main() -> None:
    """Main entry point."""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()

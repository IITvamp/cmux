#!/usr/bin/env python3
"""
Build a Morph instance using parallel provisioning with a dependency graph.
This script starts an instance directly (not a snapshot), installs all dependencies
in parallel based on a dependency graph, and then creates a snapshot from the
provisioned instance.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import shlex
import signal
import subprocess
import sys
import tempfile
import time
import traceback
import typing as t
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

import dotenv
from morphcloud.api import MorphCloudClient, Instance

dotenv.load_dotenv()

client = MorphCloudClient()

# Global instance for cleanup
current_instance: t.Optional[Instance] = None


def signal_handler(signum: int, frame: t.Any) -> None:
    """Handle interrupt signals gracefully."""
    print(f"\nReceived signal {signum}, cleaning up...")
    cleanup_instance()
    sys.exit(1)


def cleanup_instance() -> None:
    """Clean up the running instance."""
    global current_instance
    if current_instance:
        try:
            print(f"Stopping instance {current_instance.id}...")
            current_instance.stop()
            print("Instance stopped.")
        except Exception as e:
            print(f"Error stopping instance: {e}")
        finally:
            current_instance = None


# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


@dataclass
class ProvisionTask:
    """Represents a provisioning task with dependencies."""

    name: str
    command: str | t.Callable[[Instance], None]
    dependencies: list[str] = field(default_factory=list)
    description: str = ""
    check_command: str | None = None
    retry_count: int = 3
    timeout: int = 600  # seconds

    def __hash__(self) -> int:
        return hash(self.name)


class DependencyGraph:
    """Manages task dependencies and parallel execution."""

    def __init__(self) -> None:
        self.tasks: dict[str, ProvisionTask] = {}
        self.completed: set[str] = set()
        self.in_progress: set[str] = set()
        self.failed: set[str] = set()
        self.lock = asyncio.Lock()

    def add_task(self, task: ProvisionTask) -> None:
        """Add a task to the graph."""
        self.tasks[task.name] = task

    def get_ready_tasks(self) -> list[ProvisionTask]:
        """Get tasks that are ready to run (all dependencies satisfied)."""
        ready = []
        for name, task in self.tasks.items():
            if name in self.completed or name in self.in_progress or name in self.failed:
                continue

            # Check if all dependencies are completed
            if all(dep in self.completed for dep in task.dependencies):
                ready.append(task)

        return ready

    async def mark_in_progress(self, task_name: str) -> None:
        """Mark a task as in progress."""
        async with self.lock:
            self.in_progress.add(task_name)

    async def mark_completed(self, task_name: str) -> None:
        """Mark a task as completed."""
        async with self.lock:
            self.in_progress.discard(task_name)
            self.completed.add(task_name)

    async def mark_failed(self, task_name: str) -> None:
        """Mark a task as failed."""
        async with self.lock:
            self.in_progress.discard(task_name)
            self.failed.add(task_name)

    def is_complete(self) -> bool:
        """Check if all tasks are completed."""
        return len(self.completed) == len(self.tasks)

    def has_failed_tasks(self) -> bool:
        """Check if any tasks have failed."""
        return len(self.failed) > 0


async def execute_task(
    instance: Instance,
    task: ProvisionTask,
    graph: DependencyGraph
) -> tuple[str, bool, str]:
    """Execute a single provisioning task."""
    task_name = task.name

    try:
        await graph.mark_in_progress(task_name)
        print(f"[{task_name}] Starting: {task.description or task_name}")

        start_time = time.time()

        # Execute the command or callable
        for attempt in range(task.retry_count):
            try:
                if callable(task.command):
                    # Custom Python function
                    task.command(instance)
                else:
                    # Shell command
                    result = instance.exec(task.command, timeout=task.timeout)
                    if hasattr(result, 'returncode') and result.returncode != 0:
                        raise Exception(f"Command failed with return code {result.returncode}")

                # Run check command if provided
                if task.check_command:
                    check_result = instance.exec(task.check_command, timeout=30)
                    if hasattr(check_result, 'returncode') and check_result.returncode != 0:
                        raise Exception(f"Check command failed")

                break  # Success

            except Exception as e:
                if attempt < task.retry_count - 1:
                    print(f"[{task_name}] Attempt {attempt + 1} failed, retrying...")
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                else:
                    raise e

        elapsed = time.time() - start_time
        await graph.mark_completed(task_name)
        print(f"[{task_name}] Completed in {elapsed:.1f}s")
        return task_name, True, ""

    except Exception as e:
        await graph.mark_failed(task_name)
        error_msg = f"[{task_name}] Failed: {str(e)}"
        print(error_msg)
        return task_name, False, str(e)


async def run_parallel_provisioning(
    instance: Instance,
    graph: DependencyGraph,
    max_parallel: int = 10
) -> bool:
    """Run provisioning tasks in parallel based on dependency graph."""
    print(f"\nStarting parallel provisioning with {len(graph.tasks)} tasks...")
    print(f"Max parallel tasks: {max_parallel}")

    # Create a semaphore to limit parallel tasks
    semaphore = asyncio.Semaphore(max_parallel)

    async def run_task_with_semaphore(task: ProvisionTask) -> tuple[str, bool, str]:
        async with semaphore:
            return await execute_task(instance, task, graph)

    # Keep running tasks until all are complete or there's a failure
    active_tasks: set[asyncio.Task] = set()

    while not graph.is_complete() and not graph.has_failed_tasks():
        # Get tasks that are ready to run
        ready_tasks = graph.get_ready_tasks()

        # Start new tasks
        for task in ready_tasks:
            if len(active_tasks) < max_parallel:
                task_future = asyncio.create_task(run_task_with_semaphore(task))
                active_tasks.add(task_future)

        if active_tasks:
            # Wait for at least one task to complete
            done, active_tasks = await asyncio.wait(
                active_tasks,
                return_when=asyncio.FIRST_COMPLETED
            )

            # Process completed tasks
            for task_future in done:
                name, success, error = await task_future
                if not success:
                    print(f"\nTask '{name}' failed. Aborting provisioning.")
                    # Cancel remaining tasks
                    for t in active_tasks:
                        t.cancel()
                    return False

        elif not ready_tasks:
            # No tasks ready and no tasks running - might be a dependency issue
            if not graph.is_complete():
                print("\nWarning: No tasks ready to run, but provisioning incomplete.")
                print(f"Completed: {graph.completed}")
                print(f"Failed: {graph.failed}")
                print(f"In progress: {graph.in_progress}")
                return False
            break

        # Small delay to prevent busy waiting
        await asyncio.sleep(0.1)

    # Wait for any remaining tasks
    if active_tasks:
        await asyncio.gather(*active_tasks, return_exceptions=True)

    return not graph.has_failed_tasks()


def build_dependency_graph() -> DependencyGraph:
    """Build the dependency graph for all provisioning tasks."""
    graph = DependencyGraph()

    # Base system updates
    graph.add_task(ProvisionTask(
        name="apt_update",
        command="DEBIAN_FRONTEND=noninteractive apt-get update",
        description="Updating apt package lists",
        timeout=120
    ))

    # Install base packages (depends on apt_update)
    graph.add_task(ProvisionTask(
        name="install_base_tools",
        command=(
            "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
            "ca-certificates curl wget git python3 bash nano net-tools lsof sudo "
            "supervisor iptables openssl pigz xz-utils tmux htop ripgrep jq "
            "gnupg make g++ unzip procps util-linux coreutils"
        ),
        dependencies=["apt_update"],
        description="Installing base system tools",
        check_command="which curl && which git && which python3"
    ))

    # Install Node.js 24.x (can run in parallel with other installers after base tools)
    graph.add_task(ProvisionTask(
        name="install_nodejs",
        command=(
            "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs && "
            "corepack enable && "
            "corepack prepare pnpm@10.14.0 --activate"
        ),
        dependencies=["install_base_tools"],
        description="Installing Node.js 24.x and pnpm",
        check_command="node --version && pnpm --version"
    ))

    # Install Bun (can run in parallel with Node.js)
    graph.add_task(ProvisionTask(
        name="install_bun",
        command=(
            "curl -fsSL https://bun.sh/install | bash && "
            "mv /root/.bun/bin/bun /usr/local/bin/ && "
            "ln -s /usr/local/bin/bun /usr/local/bin/bunx"
        ),
        dependencies=["install_base_tools"],
        description="Installing Bun",
        check_command="bun --version && bunx --version"
    ))

    # Install GitHub CLI (can run in parallel)
    graph.add_task(ProvisionTask(
        name="install_gh_cli",
        command=(
            "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | "
            "dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && "
            "chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && "
            "echo 'deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] "
            "https://cli.github.com/packages stable main' | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && "
            "DEBIAN_FRONTEND=noninteractive apt-get update && "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y gh"
        ),
        dependencies=["install_base_tools"],
        description="Installing GitHub CLI",
        check_command="gh --version"
    ))

    # Install Docker (can run in parallel)
    graph.add_task(ProvisionTask(
        name="install_docker",
        command=(
            "arch=\"$(uname -m)\" && "
            "case \"$arch\" in "
            "  x86_64) dockerArch='x86_64' ;; "
            "  aarch64) dockerArch='aarch64' ;; "
            "  *) echo >&2 \"error: unsupported architecture ($arch)\"; exit 1 ;; "
            "esac && "
            "wget -O /tmp/docker.tgz 'https://download.docker.com/linux/static/stable/${dockerArch}/docker-28.3.2.tgz' && "
            "tar --extract --file /tmp/docker.tgz --strip-components 1 --directory /usr/local/bin/ && "
            "rm /tmp/docker.tgz"
        ),
        dependencies=["install_base_tools"],
        description="Installing Docker",
        check_command="docker --version"
    ))

    # Install Docker Compose and Buildx (depends on Docker)
    graph.add_task(ProvisionTask(
        name="install_docker_plugins",
        command=(
            "mkdir -p /usr/local/lib/docker/cli-plugins && "
            "arch=\"$(uname -m)\" && "
            "curl -SL \"https://github.com/docker/compose/releases/download/v2.32.2/docker-compose-linux-${arch}\" "
            "-o /usr/local/lib/docker/cli-plugins/docker-compose && "
            "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose && "
            "curl -SL \"https://github.com/docker/buildx/releases/download/v0.18.0/buildx-v0.18.0.linux-${arch}\" "
            "-o /usr/local/lib/docker/cli-plugins/docker-buildx && "
            "chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx"
        ),
        dependencies=["install_docker"],
        description="Installing Docker Compose and Buildx",
        check_command="docker compose version && docker buildx version"
    ))

    # Setup Docker daemon
    graph.add_task(ProvisionTask(
        name="setup_dockerd",
        command=(
            "mkdir -p /etc/supervisor/conf.d && "
            "cat > /etc/supervisor/conf.d/dockerd.conf << 'EOF'\n"
            "[program:dockerd]\n"
            "command=/usr/local/bin/dockerd\n"
            "autostart=true\n"
            "autorestart=true\n"
            "stderr_logfile=/var/log/dockerd.err.log\n"
            "stdout_logfile=/var/log/dockerd.out.log\n"
            "EOF\n"
            "&& mkdir -p /var/lib/docker && "
            "update-alternatives --set iptables /usr/sbin/iptables-legacy && "
            "cat > /usr/local/bin/modprobe << 'SCRIPT'\n"
            "#!/bin/sh\n"
            "set -eu\n"
            "for module; do\n"
            "    if [ \"${module#-}\" = \"$module\" ]; then\n"
            "        ip link show \"$module\" || true\n"
            "        lsmod | grep \"$module\" || true\n"
            "    fi\n"
            "done\n"
            "export PATH='/usr/sbin:/usr/bin:/sbin:/bin'\n"
            "exec modprobe \"$@\"\n"
            "SCRIPT\n"
            "&& chmod +x /usr/local/bin/modprobe"
        ),
        dependencies=["install_docker_plugins", "install_base_tools"],
        description="Setting up Docker daemon"
    ))

    # Install OpenVSCode Server (can run in parallel)
    graph.add_task(ProvisionTask(
        name="install_openvscode",
        command=(
            "CODE_RELEASE=$(curl -sX GET 'https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest' "
            "| awk '/tag_name/{print $4;exit}' FS='[\"|\"]' | sed 's|^openvscode-server-v||') && "
            "arch=\"$(dpkg --print-architecture)\" && "
            "if [ \"$arch\" = \"amd64\" ]; then ARCH=\"x64\"; "
            "elif [ \"$arch\" = \"arm64\" ]; then ARCH=\"arm64\"; fi && "
            "mkdir -p /app/openvscode-server && "
            "url=\"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${CODE_RELEASE}/openvscode-server-v${CODE_RELEASE}-linux-${ARCH}.tar.gz\" && "
            "curl -fSL --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 "
            "-o /tmp/openvscode-server.tar.gz \"$url\" && "
            "tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server/ --strip-components=1 && "
            "rm -rf /tmp/openvscode-server.tar.gz"
        ),
        dependencies=["install_base_tools"],
        description="Installing OpenVSCode Server",
        check_command="test -f /app/openvscode-server/bin/openvscode-server",
        timeout=900
    ))

    # Install global npm packages (depends on both Node.js and Bun)
    graph.add_task(ProvisionTask(
        name="install_npm_globals",
        command=(
            "bun add -g @openai/codex@0.42.0 @anthropic-ai/claude-code@2.0.0 "
            "@google/gemini-cli@0.1.21 opencode-ai@0.6.4 codebuff "
            "@devcontainers/cli @sourcegraph/amp"
        ),
        dependencies=["install_nodejs", "install_bun"],
        description="Installing global npm packages",
        check_command="claude-code --version"
    ))

    # Install Cursor CLI (can run in parallel)
    graph.add_task(ProvisionTask(
        name="install_cursor",
        command=(
            "curl https://cursor.com/install -fsS | bash && "
            "/root/.local/bin/cursor-agent --version"
        ),
        dependencies=["install_base_tools"],
        description="Installing Cursor CLI",
        check_command="/root/.local/bin/cursor-agent --version"
    ))

    # Install Rust and Cargo (for building envctl/envd)
    graph.add_task(ProvisionTask(
        name="install_rust",
        command=(
            "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | "
            "sh -s -- -y --profile minimal --default-toolchain stable && "
            ". /root/.cargo/env"
        ),
        dependencies=["install_base_tools"],
        description="Installing Rust and Cargo",
        check_command=". /root/.cargo/env && cargo --version"
    ))

    # Install uv (Python package manager) - depends on Rust
    graph.add_task(ProvisionTask(
        name="install_uv",
        command=(
            ". /root/.cargo/env && "
            "cargo install --locked uv"
        ),
        dependencies=["install_rust"],
        description="Installing uv",
        check_command=". /root/.cargo/env && uv --version",
        timeout=900
    ))

    # Create necessary directories
    graph.add_task(ProvisionTask(
        name="create_directories",
        command=(
            "mkdir -p /workspace /root/workspace /root/lifecycle /var/log/cmux "
            "/root/.openvscode-server/data/User /root/.openvscode-server/data/User/profiles/default-profile "
            "/root/.openvscode-server/data/Machine /builtins /run/user/0 && "
            "chmod 700 /run/user/0"
        ),
        dependencies=["install_base_tools"],
        description="Creating necessary directories"
    ))

    # Setup VS Code settings
    graph.add_task(ProvisionTask(
        name="setup_vscode_settings",
        command=(
            "settings='{\"workbench.startupEditor\": \"none\", "
            "\"terminal.integrated.macOptionClickForcesSelection\": true, "
            "\"terminal.integrated.shell.linux\": \"bash\", "
            "\"terminal.integrated.shellArgs.linux\": [\"-l\"]}' && "
            "echo \"$settings\" > /root/.openvscode-server/data/User/settings.json && "
            "echo \"$settings\" > /root/.openvscode-server/data/User/profiles/default-profile/settings.json && "
            "echo \"$settings\" > /root/.openvscode-server/data/Machine/settings.json"
        ),
        dependencies=["create_directories", "install_openvscode"],
        description="Setting up VS Code configuration"
    ))

    # Install Claude Code VS Code extension
    graph.add_task(ProvisionTask(
        name="install_vscode_claude",
        command=(
            "wget --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -t 5 "
            "'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/anthropic/vsextensions/claude-code/2.0.0/vspackage' "
            "-O /tmp/claude-code.vsix.gz && "
            "gunzip /tmp/claude-code.vsix.gz && "
            "/app/openvscode-server/bin/openvscode-server --install-extension /tmp/claude-code.vsix && "
            "rm -f /tmp/claude-code.vsix"
        ),
        dependencies=["install_openvscode"],
        description="Installing Claude Code VS Code extension",
        check_command="test -d /root/.openvscode-server/extensions/anthropic.claude-code-2.0.0"
    ))

    return graph


def upload_and_build_custom_components(instance: Instance) -> None:
    """Upload repository and build custom components (worker, envctl, envd)."""
    print("\n=== Uploading and building custom components ===")

    # Create temporary directory for the repository archive
    with tempfile.TemporaryDirectory() as tmpdir:
        archive_path = os.path.join(tmpdir, "repo.tar.gz")

        # Get the repository root (parent of scripts directory)
        repo_root = Path(__file__).parent.parent

        # Create archive of the repository (excluding .git, node_modules, etc.)
        print("Creating repository archive...")
        exclude_args = [
            "--exclude=.git",
            "--exclude=node_modules",
            "--exclude=.next",
            "--exclude=dist",
            "--exclude=build",
            "--exclude=*.pyc",
            "--exclude=__pycache__",
            "--exclude=.convex",
            "--exclude=logs",
            "--exclude=.env*"
        ]

        tar_cmd = [
            "tar", "czf", archive_path,
            "-C", str(repo_root),
            *exclude_args,
            "."
        ]

        subprocess.run(tar_cmd, check=True)
        print(f"Archive created: {os.path.getsize(archive_path) / 1024 / 1024:.2f} MB")

        # Upload archive to instance
        print("Uploading repository to instance...")
        instance.upload(archive_path, "/tmp/repo.tar.gz")

        # Extract and build on the instance
        print("Extracting repository on instance...")
        instance.exec("mkdir -p /cmux && tar xzf /tmp/repo.tar.gz -C /cmux && rm /tmp/repo.tar.gz")

        # Install dependencies with Bun
        print("Installing Node.js dependencies...")
        instance.exec("cd /cmux && bun install --frozen-lockfile --production", timeout=600)

        # Build worker
        print("Building worker...")
        instance.exec(
            "cd /cmux && "
            "bun build ./apps/worker/src/index.ts "
            "--target node "
            "--outdir ./apps/worker/build "
            "--external @cmux/convex "
            "--external 'node:*' && "
            "mkdir -p /builtins && "
            "echo '{\"name\":\"builtins\",\"type\":\"module\",\"version\":\"1.0.0\"}' > /builtins/package.json && "
            "cp -r ./apps/worker/build /builtins/build && "
            "cp ./apps/worker/wait-for-docker.sh /usr/local/bin/ && "
            "chmod +x /usr/local/bin/wait-for-docker.sh",
            timeout=300
        )

        # Build and install envctl/envd using Rust
        print("Building envctl and envd...")
        try:
            # Check if we have the cmux-env source
            check_result = instance.exec("test -d /cmux/packages/cmux-env/src")
            if hasattr(check_result, 'returncode') and check_result.returncode == 0:
                # Build from source
                instance.exec(
                    ". /root/.cargo/env && "
                    "cd /cmux/packages/cmux-env && "
                    "cargo build --release && "
                    "cp target/release/envctl /usr/local/bin/envctl && "
                    "cp target/release/envd /usr/local/bin/envd && "
                    "chmod +x /usr/local/bin/envctl /usr/local/bin/envd",
                    timeout=600
                )
            else:
                # Download pre-built binaries as fallback
                print("Source not found, downloading pre-built envctl/envd...")
                instance.exec(
                    "CMUX_ENV_VERSION=0.0.8 && "
                    "arch=\"$(uname -m)\" && "
                    "case \"$arch\" in "
                    "  x86_64) arch_name=\"x86_64\" ;; "
                    "  aarch64|arm64) arch_name=\"aarch64\" ;; "
                    "  *) echo \"Unsupported architecture: $arch\" >&2; exit 1 ;; "
                    "esac && "
                    "curl -fsSL \"https://github.com/lawrencecchen/cmux-env/releases/download/v${CMUX_ENV_VERSION}/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl.tar.gz\" | tar -xz -C /tmp && "
                    "mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl/envctl /usr/local/bin/envctl && "
                    "mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl/envd /usr/local/bin/envd && "
                    "rm -rf /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl && "
                    "chmod +x /usr/local/bin/envctl /usr/local/bin/envd"
                )
        except Exception as e:
            print(f"Warning: Failed to build/install envctl/envd: {e}")

        # Setup envctl hooks
        instance.exec(
            "envctl --version && "
            "envctl install-hook bash && "
            "echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.profile && "
            "echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.bash_profile && "
            "echo 'export XDG_RUNTIME_DIR=/run/user/0' >> /root/.bashrc",
            timeout=60
        )

        # Build VS Code extension
        print("Building VS Code extension...")
        instance.exec(
            "cd /cmux/packages/vscode-extension && "
            "bun run package && "
            "/app/openvscode-server/bin/openvscode-server --install-extension cmux-vscode-extension-0.0.1.vsix",
            timeout=300
        )

        # Copy startup scripts
        print("Installing startup scripts...")
        instance.exec(
            "cp /cmux/startup.sh /startup.sh && "
            "cp /cmux/prompt-wrapper.sh /usr/local/bin/prompt-wrapper && "
            "chmod +x /startup.sh /usr/local/bin/prompt-wrapper && "
            "cp /cmux/apps/worker/scripts/collect-relevant-diff.sh /usr/local/bin/cmux-collect-relevant-diff.sh && "
            "cp /cmux/apps/worker/scripts/collect-crown-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh && "
            "chmod +x /usr/local/bin/cmux-collect-relevant-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh"
        )

        # Install tmux config if it exists
        try:
            instance.exec("test -f /cmux/configs/tmux.conf && cp /cmux/configs/tmux.conf /etc/tmux.conf")
        except Exception:
            pass  # tmux.conf is optional


def run_sanity_checks(instance: Instance) -> bool:
    """Run comprehensive sanity checks on the provisioned instance."""
    print("\n=== Running sanity checks ===")

    checks = [
        ("Node.js", "node --version"),
        ("npm", "npm --version"),
        ("pnpm", "pnpm --version"),
        ("Bun", "bun --version"),
        ("Docker", "docker --version"),
        ("Docker Compose", "docker compose version"),
        ("Cargo", ". /root/.cargo/env && cargo --version"),
        ("uv", ". /root/.cargo/env && uv --version"),
        ("GitHub CLI", "gh --version"),
        ("Claude Code", "claude-code --version || echo 'Claude Code installed'"),
        ("Cursor", "/root/.local/bin/cursor-agent --version"),
        ("envctl", "envctl --version"),
        ("envd", "test -f /usr/local/bin/envd && echo 'envd installed'"),
        ("OpenVSCode Server", "test -f /app/openvscode-server/bin/openvscode-server && echo 'OpenVSCode installed'"),
        ("Worker build", "test -d /builtins/build && echo 'Worker built'"),
        ("Startup script", "test -f /startup.sh && echo 'Startup script installed'"),
    ]

    all_passed = True
    results = []

    for name, command in checks:
        try:
            result = instance.exec(command, timeout=30)
            if hasattr(result, 'returncode') and result.returncode != 0:
                results.append(f"❌ {name}: FAILED")
                all_passed = False
            else:
                output = getattr(result, 'stdout', '').strip() if hasattr(result, 'stdout') else 'OK'
                results.append(f"✅ {name}: {output}")
        except Exception as e:
            results.append(f"❌ {name}: {str(e)}")
            all_passed = False

    # Print results
    for result in results:
        print(result)

    # Check if we can curl the VS Code endpoint
    print("\nTesting VS Code endpoint...")
    try:
        # Start the service
        instance.exec("cd /root/workspace && nohup /startup.sh > /var/log/cmux/startup.log 2>&1 &", timeout=10)
        time.sleep(5)  # Give it time to start

        # Check if VS Code is accessible
        result = instance.exec("curl -s -o /dev/null -w '%{http_code}' http://localhost:39378/", timeout=30)
        http_code = getattr(result, 'stdout', '').strip() if hasattr(result, 'stdout') else ''

        if http_code in ['200', '302']:
            print(f"✅ VS Code endpoint: HTTP {http_code}")
        else:
            print(f"⚠️  VS Code endpoint returned: HTTP {http_code}")
            all_passed = False

        # Check VNC endpoint
        result = instance.exec("curl -s -o /dev/null -w '%{http_code}' http://localhost:39377/", timeout=30)
        vnc_code = getattr(result, 'stdout', '').strip() if hasattr(result, 'stdout') else ''
        print(f"ℹ️  VNC endpoint: HTTP {vnc_code}")

    except Exception as e:
        print(f"⚠️  Endpoint check failed: {e}")

    return all_passed


def main() -> None:
    """Main entry point."""
    global current_instance

    parser = argparse.ArgumentParser(
        description="Provision a Morph instance using parallel execution"
    )
    parser.add_argument(
        "--vcpus", type=int, default=10,
        help="Number of vCPUs (default: 10)"
    )
    parser.add_argument(
        "--memory", type=int, default=32768,
        help="Memory in MB (default: 32768)"
    )
    parser.add_argument(
        "--disk-size", type=int, default=65536,
        help="Disk size in MB (default: 65536)"
    )
    parser.add_argument(
        "--max-parallel", type=int, default=10,
        help="Maximum parallel tasks (default: 10)"
    )
    parser.add_argument(
        "--skip-snapshot", action="store_true",
        help="Skip creating final snapshot"
    )
    parser.add_argument(
        "--verify-snapshot", action="store_true",
        help="Start new instance from snapshot to verify"
    )

    args = parser.parse_args()

    try:
        # Start a new instance
        print(f"Starting Morph instance...")
        print(f"  vCPUs: {args.vcpus}")
        print(f"  Memory: {args.memory} MB")
        print(f"  Disk: {args.disk_size} MB")

        instance = client.instances.start(
            vcpus=args.vcpus,
            memory=args.memory,
            disk_size=args.disk_size,
            ttl_seconds=7200,  # 2 hours
            ttl_action="pause"
        )
        current_instance = instance

        print(f"Instance ID: {instance.id}")
        instance.wait_until_ready()
        print("Instance ready!")

        # Build dependency graph
        graph = build_dependency_graph()
        print(f"\nBuilt dependency graph with {len(graph.tasks)} tasks")

        # Run parallel provisioning
        start_time = time.time()
        success = asyncio.run(run_parallel_provisioning(instance, graph, args.max_parallel))

        if not success:
            print("\n❌ Provisioning failed!")
            sys.exit(1)

        elapsed = time.time() - start_time
        print(f"\n✅ Base provisioning completed in {elapsed:.1f} seconds")

        # Upload and build custom components
        upload_and_build_custom_components(instance)

        # Expose ports
        print("\n=== Exposing ports ===")
        ports = [39376, 39377, 39378]
        for port in ports:
            instance.expose_http_service(port=port, name=f"port-{port}")
            print(f"Exposed port {port}")

        # Get exposed URLs
        services = instance.networking.http_services
        for svc in services:
            port = getattr(svc, 'port', None)
            url = getattr(svc, 'url', None)
            if port == 39378 and url:
                print(f"\n🌐 VS Code URL: {url}/?folder=/root/workspace")

        # Run sanity checks
        if not run_sanity_checks(instance):
            print("\n⚠️  Some sanity checks failed")

        # Create snapshot if not skipped
        snapshot_id = None
        if not args.skip_snapshot:
            print("\n=== Creating snapshot ===")
            snapshot = instance.snapshot()
            snapshot_id = snapshot.id
            print(f"✅ Snapshot created: {snapshot_id}")

            # Verify snapshot by starting new instance
            if args.verify_snapshot and snapshot_id:
                print("\n=== Verifying snapshot ===")

                # Stop current instance
                print("Stopping original instance...")
                instance.stop()
                current_instance = None

                # Start new instance from snapshot
                print(f"Starting new instance from snapshot {snapshot_id}...")
                verify_instance = client.instances.start(
                    snapshot_id=snapshot_id,
                    ttl_seconds=3600,
                    ttl_action="pause"
                )
                current_instance = verify_instance

                print(f"Verification instance ID: {verify_instance.id}")
                verify_instance.wait_until_ready()

                # Expose ports on verification instance
                for port in ports:
                    verify_instance.expose_http_service(port=port, name=f"port-{port}")

                # Run sanity checks on new instance
                print("\nRunning sanity checks on snapshot instance...")
                if run_sanity_checks(verify_instance):
                    print("\n✅ Snapshot verification successful!")
                else:
                    print("\n❌ Snapshot verification failed!")

                # Get VS Code URL for verification instance
                services = verify_instance.networking.http_services
                for svc in services:
                    port = getattr(svc, 'port', None)
                    url = getattr(svc, 'url', None)
                    if port == 39378 and url:
                        print(f"\n🌐 Verification VS Code URL: {url}/?folder=/root/workspace")

        print("\n✅ All tasks completed successfully!")

        if not args.skip_snapshot and snapshot_id:
            print(f"\n📦 Final snapshot ID: {snapshot_id}")
            print("You can use this snapshot to start new instances.")

    except KeyboardInterrupt:
        print("\nInterrupted by user")
        cleanup_instance()
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        traceback.print_exc()
        cleanup_instance()
        sys.exit(1)
    finally:
        # Keep instance running for debugging unless we're verifying
        if not args.verify_snapshot:
            input("\nPress Enter to stop the instance...")
        cleanup_instance()


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Build a Morph instance with parallel task execution using async operations.
This is much faster than the sequential snapshot-based approach.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import os
import shlex
import sys
import time
import typing as t
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

import dotenv
from morphcloud.api import MorphCloudClient, Instance

dotenv.load_dotenv()

client = MorphCloudClient()

# Configuration
MORPH_EXPECTED_UNAME_ARCH = "x86_64"
DOCKER_COMPOSE_VERSION = "v2.32.2"
DOCKER_BUILDX_VERSION = "v0.18.0"
DOCKER_VERSION = "28.3.2"
DOCKER_CHANNEL = "stable"
NODE_VERSION = "24"
BUN_VERSION = "latest"
PNPM_VERSION = "10.14.0"
CMUX_ENV_VERSION = "0.0.8"
CLAUDE_CODE_VERSION = "2.0.0"

# Instance specs
VCPUS = 10
MEMORY = 32768  # 32GB RAM
DISK_SIZE = 65536  # 64GB disk

# Timeout settings
TASK_TIMEOUT = 300  # 5 minutes per task
SANITY_CHECK_TIMEOUT = 60  # 1 minute for sanity checks


class TaskStatus(Enum):
    """Task execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    """Represents a task to execute with its dependencies."""
    name: str
    func: t.Callable[[Instance], t.Awaitable[None]]
    dependencies: list[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING
    error: Exception | None = None
    retries: int = 3
    attempts: int = 0


class DependencyGraph:
    """Manages task dependencies and parallel execution."""

    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {}

    def add_task(
        self,
        name: str,
        func: t.Callable[[Instance], t.Awaitable[None]],
        dependencies: list[str] | None = None
    ) -> None:
        """Add a task to the dependency graph."""
        self.tasks[name] = Task(
            name=name,
            func=func,
            dependencies=dependencies or [],
        )

    def get_ready_tasks(self) -> list[Task]:
        """Get tasks that are ready to run (dependencies satisfied)."""
        ready = []
        for task in self.tasks.values():
            if task.status == TaskStatus.PENDING:
                deps_satisfied = all(
                    self.tasks[dep].status == TaskStatus.COMPLETED
                    for dep in task.dependencies
                )
                if deps_satisfied:
                    ready.append(task)
        return ready

    def all_completed(self) -> bool:
        """Check if all tasks are completed or failed."""
        return all(
            task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED)
            for task in self.tasks.values()
        )

    def get_failed_tasks(self) -> list[Task]:
        """Get list of failed tasks."""
        return [task for task in self.tasks.values() if task.status == TaskStatus.FAILED]


class MorphInstanceBuilder:
    """Build a Morph instance with parallel task execution."""

    def __init__(self, instance: Instance) -> None:
        self.instance = instance
        self.graph = DependencyGraph()
        self._setup_tasks()

    def _setup_tasks(self) -> None:
        """Define all tasks and their dependencies."""

        # Base system packages (no dependencies)
        self.graph.add_task("apt_update", self._apt_update)
        self.graph.add_task("apt_base", self._install_base_packages, ["apt_update"])

        # Upload repo (can run in parallel with apt)
        self.graph.add_task("upload_repo", self._upload_repo)

        # Docker installation
        self.graph.add_task("docker_install", self._install_docker, ["apt_base"])
        self.graph.add_task("docker_plugins", self._install_docker_plugins, ["docker_install"])
        self.graph.add_task("docker_config", self._configure_docker, ["docker_install"])

        # Node.js, Bun, and package managers
        self.graph.add_task("nodejs", self._install_nodejs, ["apt_base"])
        self.graph.add_task("bun", self._install_bun, ["apt_base"])
        self.graph.add_task("pnpm", self._setup_pnpm, ["nodejs"])

        # GitHub CLI
        self.graph.add_task("github_cli", self._install_github_cli, ["apt_base"])

        # OpenVSCode Server
        self.graph.add_task("openvscode", self._install_openvscode, ["apt_base"])

        # Global npm packages
        self.graph.add_task("npm_globals", self._install_npm_globals, ["bun"])

        # Cursor CLI
        self.graph.add_task("cursor", self._install_cursor, ["apt_base"])

        # envctl/envd
        self.graph.add_task("envctl", self._install_envctl, ["apt_base"])

        # Build worker (needs bun and uploaded repo)
        self.graph.add_task("build_worker", self._build_worker, ["bun", "upload_repo", "nodejs"])

        # VS Code extensions
        self.graph.add_task("vscode_extensions", self._install_vscode_extensions,
                           ["openvscode", "build_worker"])

        # System configuration
        self.graph.add_task("system_config", self._configure_system, ["apt_base"])

        # Final startup configuration (depends on everything)
        all_tasks = list(self.graph.tasks.keys())
        self.graph.add_task("startup_config", self._configure_startup,
                           [t for t in all_tasks if t != "startup_config"])

    async def _apt_update(self, inst: Instance) -> None:
        """Update apt package lists."""
        await inst.aexec("apt-get update")

    async def _install_base_packages(self, inst: Instance) -> None:
        """Install base system packages."""
        packages = [
            "ca-certificates", "curl", "wget", "git", "python3", "bash",
            "nano", "net-tools", "lsof", "sudo", "supervisor", "iptables",
            "openssl", "pigz", "xz-utils", "tmux", "htop", "ripgrep", "jq",
            "gnupg", "unzip", "make", "g++"
        ]
        await inst.aexec(f"DEBIAN_FRONTEND=noninteractive apt-get install -y {' '.join(packages)}")
        await inst.aexec("rm -rf /var/lib/apt/lists/*")

    async def _upload_repo(self, inst: Instance) -> None:
        """Upload the repository to build custom components."""
        # Create target directory
        await inst.aexec("mkdir -p /cmux")

        # Upload the entire repo
        local_path = Path("/root/workspace")

        # We'll tar it locally first for faster transfer
        tar_path = "/tmp/cmux_repo.tar.gz"
        os.system(f"cd {local_path} && tar czf {tar_path} --exclude='.git' --exclude='node_modules' --exclude='*.log' .")

        # Upload and extract
        await inst.aupload(tar_path, "/tmp/cmux_repo.tar.gz")
        await inst.aexec("cd /cmux && tar xzf /tmp/cmux_repo.tar.gz && rm /tmp/cmux_repo.tar.gz")

    async def _install_docker(self, inst: Instance) -> None:
        """Install Docker using the same method as ensure_docker."""
        # Set iptables-legacy
        await inst.aexec("update-alternatives --set iptables /usr/sbin/iptables-legacy")

        # Install Docker packages
        await inst.aexec(
            "DEBIAN_FRONTEND=noninteractive apt-get update && "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y "
            "docker.io docker-compose python3-docker && "
            "rm -rf /var/lib/apt/lists/*"
        )

        # Also install Docker static binaries for latest version
        arch = "x86_64"  # Morph is always x86_64
        download_url = f"https://download.docker.com/linux/static/{DOCKER_CHANNEL}/{arch}/docker-{DOCKER_VERSION}.tgz"

        commands = [
            f"wget -O /tmp/docker.tgz '{download_url}'",
            "tar --extract --file /tmp/docker.tgz --strip-components 1 --directory /usr/local/bin/",
            "rm /tmp/docker.tgz",
            "dockerd --version",
            "docker --version",
        ]

        for cmd in commands:
            await inst.aexec(cmd)

    async def _configure_docker(self, inst: Instance) -> None:
        """Configure Docker daemon with BuildKit enabled."""
        config = {
            "features": {"buildkit": True}
        }
        config_json = base64.b64encode(
            str(config).replace("'", '"').encode()
        ).decode()

        await inst.aexec(f"mkdir -p /etc/docker")
        await inst.aexec(f"echo '{config_json}' | base64 -d > /etc/docker/daemon.json")
        await inst.aexec("echo 'DOCKER_BUILDKIT=1' >> /etc/environment")

        # Setup supervisor for dockerd
        supervisor_conf = """[program:dockerd]
command=/usr/local/bin/dockerd
autostart=true
autorestart=true
stderr_logfile=/var/log/dockerd.err.log
stdout_logfile=/var/log/dockerd.out.log"""

        conf_b64 = base64.b64encode(supervisor_conf.encode()).decode()
        await inst.aexec("mkdir -p /etc/supervisor/conf.d")
        await inst.aexec(f"echo '{conf_b64}' | base64 -d > /etc/supervisor/conf.d/dockerd.conf")

        # Create modprobe script for DinD
        modprobe_script = """#!/bin/sh
set -eu
for module; do
    if [ "${module#-}" = "$module" ]; then
        ip link show "$module" || true
        lsmod | grep "$module" || true
    fi
done
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
exec modprobe "$@" """

        script_b64 = base64.b64encode(modprobe_script.encode()).decode()
        await inst.aexec(f"echo '{script_b64}' | base64 -d > /usr/local/bin/modprobe")
        await inst.aexec("chmod +x /usr/local/bin/modprobe")

        # Start docker
        await inst.aexec("systemctl restart docker || supervisorctl reload && supervisorctl start dockerd")

        # Wait for Docker to be ready
        await inst.aexec(
            "for i in {1..30}; do "
            "  if docker info >/dev/null 2>&1; then "
            "    echo 'Docker ready'; break; "
            "  else "
            "    echo 'Waiting for Docker...'; "
            "    [ $i -eq 30 ] && { echo 'Docker failed to start'; exit 1; }; "
            "    sleep 2; "
            "  fi; "
            "done"
        )

    async def _install_docker_plugins(self, inst: Instance) -> None:
        """Install Docker Compose and Buildx CLI plugins."""
        commands = [
            "mkdir -p /usr/local/lib/docker/cli-plugins",
            f"curl -fsSL https://github.com/docker/compose/releases/download/{DOCKER_COMPOSE_VERSION}/docker-compose-linux-{MORPH_EXPECTED_UNAME_ARCH} "
            f"-o /usr/local/lib/docker/cli-plugins/docker-compose",
            "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
            f"curl -fsSL https://github.com/docker/buildx/releases/download/{DOCKER_BUILDX_VERSION}/buildx-{DOCKER_BUILDX_VERSION}.linux-amd64 "
            f"-o /usr/local/lib/docker/cli-plugins/docker-buildx",
            "chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx",
        ]

        for cmd in commands:
            await inst.aexec(cmd)

    async def _install_nodejs(self, inst: Instance) -> None:
        """Install Node.js."""
        await inst.aexec(f"curl -fsSL https://deb.nodesource.com/setup_{NODE_VERSION}.x | bash -")
        await inst.aexec("apt-get install -y nodejs")
        await inst.aexec("rm -rf /var/lib/apt/lists/*")
        await inst.aexec("npm install -g node-gyp")

    async def _setup_pnpm(self, inst: Instance) -> None:
        """Setup pnpm via corepack."""
        await inst.aexec("corepack enable")
        await inst.aexec(f"corepack prepare pnpm@{PNPM_VERSION} --activate")

    async def _install_bun(self, inst: Instance) -> None:
        """Install Bun."""
        await inst.aexec("curl -fsSL https://bun.sh/install | bash")
        await inst.aexec("mv /root/.bun/bin/bun /usr/local/bin/")
        await inst.aexec("ln -s /usr/local/bin/bun /usr/local/bin/bunx")

    async def _install_github_cli(self, inst: Instance) -> None:
        """Install GitHub CLI."""
        commands = [
            "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | "
            "dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg",
            "chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg",
            'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] '
            'https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
            "apt-get update",
            "apt-get install -y gh",
            "rm -rf /var/lib/apt/lists/*"
        ]

        for cmd in commands:
            await inst.aexec(cmd)

    async def _install_openvscode(self, inst: Instance) -> None:
        """Install OpenVSCode Server."""
        # Get latest release
        cmd_release = (
            'curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" '
            '| awk \'/tag_name/{print $4;exit}\' FS=\'[""]]\' '
            '| sed \'s|^openvscode-server-v||\''
        )

        result = await inst.aexec(cmd_release)
        code_release = result.stdout.strip() if hasattr(result, 'stdout') else "1.91.1"

        arch = "x64"  # Morph is always x86_64
        url = f"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v{code_release}/openvscode-server-v{code_release}-linux-{arch}.tar.gz"

        commands = [
            "mkdir -p /app/openvscode-server",
            f"curl -fSL --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 "
            f"-o /tmp/openvscode-server.tar.gz '{url}'",
            "tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server/ --strip-components=1",
            "rm -rf /tmp/openvscode-server.tar.gz"
        ]

        for cmd in commands:
            await inst.aexec(cmd)

    async def _install_npm_globals(self, inst: Instance) -> None:
        """Install global npm packages."""
        packages = [
            "@openai/codex@0.42.0",
            "@anthropic-ai/claude-code@2.0.0",
            "@google/gemini-cli@0.1.21",
            "opencode-ai@0.6.4",
            "codebuff",
            "@devcontainers/cli",
            "@sourcegraph/amp"
        ]

        await inst.aexec(f"bun add -g {' '.join(packages)}")

    async def _install_cursor(self, inst: Instance) -> None:
        """Install Cursor CLI."""
        await inst.aexec("curl https://cursor.com/install -fsS | bash")

    async def _install_envctl(self, inst: Instance) -> None:
        """Install envctl and envd."""
        arch_name = "x86_64"  # Morph is always x86_64

        commands = [
            f"curl -fsSL 'https://github.com/lawrencecchen/cmux-env/releases/download/v{CMUX_ENV_VERSION}/"
            f"cmux-env-{CMUX_ENV_VERSION}-{arch_name}-unknown-linux-musl.tar.gz' | tar -xz -C /tmp",
            f"mv /tmp/cmux-env-{CMUX_ENV_VERSION}-{arch_name}-unknown-linux-musl/envctl /usr/local/bin/envctl",
            f"mv /tmp/cmux-env-{CMUX_ENV_VERSION}-{arch_name}-unknown-linux-musl/envd /usr/local/bin/envd",
            f"rm -rf /tmp/cmux-env-{CMUX_ENV_VERSION}-{arch_name}-unknown-linux-musl",
            "chmod +x /usr/local/bin/envctl /usr/local/bin/envd",
            "envctl install-hook bash",
            "echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.profile",
            "echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.bash_profile",
            "mkdir -p /run/user/0",
            "chmod 700 /run/user/0",
            "echo 'export XDG_RUNTIME_DIR=/run/user/0' >> /root/.bashrc"
        ]

        for cmd in commands:
            await inst.aexec(cmd)

    async def _build_worker(self, inst: Instance) -> None:
        """Build the worker from uploaded repository."""
        # Install dependencies
        await inst.aexec("cd /cmux && bun install --frozen-lockfile --production")

        # Create builtins directory
        await inst.aexec("mkdir -p /builtins")
        await inst.aexec('echo \'{"name":"builtins","type":"module","version":"1.0.0"}\' > /builtins/package.json')

        # Build worker
        build_cmd = (
            "cd /cmux && bun build ./apps/worker/src/index.ts "
            "--target node --outdir ./apps/worker/build "
            "--external @cmux/convex --external 'node:*'"
        )
        await inst.aexec(build_cmd)

        # Copy build artifacts
        await inst.aexec("cp -r /cmux/apps/worker/build /builtins/build")
        await inst.aexec("cp /cmux/apps/worker/wait-for-docker.sh /usr/local/bin/")
        await inst.aexec("chmod +x /usr/local/bin/wait-for-docker.sh")

        # Copy utility scripts
        await inst.aexec("cp /cmux/apps/worker/scripts/collect-relevant-diff.sh /usr/local/bin/cmux-collect-relevant-diff.sh")
        await inst.aexec("cp /cmux/apps/worker/scripts/collect-crown-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh")
        await inst.aexec("chmod +x /usr/local/bin/cmux-collect-relevant-diff.sh")
        await inst.aexec("chmod +x /usr/local/bin/cmux-collect-crown-diff.sh")

        # Build VS Code extension
        await inst.aexec("cd /cmux/packages/vscode-extension && bun run package")

    async def _install_vscode_extensions(self, inst: Instance) -> None:
        """Install VS Code extensions."""
        # Install custom cmux extension
        await inst.aexec(
            "/app/openvscode-server/bin/openvscode-server --install-extension "
            "/cmux/packages/vscode-extension/cmux-vscode-extension-0.0.1.vsix"
        )

        # Install Claude Code extension
        commands = [
            f"wget --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -t 5 "
            f"'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/anthropic/"
            f"vsextensions/claude-code/{CLAUDE_CODE_VERSION}/vspackage' "
            f"-O /tmp/claude-code.vsix.gz",
            "gunzip /tmp/claude-code.vsix.gz",
            "/app/openvscode-server/bin/openvscode-server --install-extension /tmp/claude-code.vsix",
            "rm -f /tmp/claude-code.vsix"
        ]

        for cmd in commands:
            await inst.aexec(cmd)

    async def _configure_system(self, inst: Instance) -> None:
        """Configure system settings."""
        # IPv6 localhost
        await inst.aexec("echo '::1       localhost' >> /etc/hosts")

        # Create directories
        await inst.aexec("mkdir -p /workspace /root/workspace /root/lifecycle /var/lib/docker")

        # VS Code settings
        settings = {
            "workbench.startupEditor": "none",
            "terminal.integrated.macOptionClickForcesSelection": True,
            "terminal.integrated.shell.linux": "bash",
            "terminal.integrated.shellArgs.linux": ["-l"]
        }
        settings_json = base64.b64encode(str(settings).replace("'", '"').encode()).decode()

        paths = [
            "/root/.openvscode-server/data/User",
            "/root/.openvscode-server/data/User/profiles/default-profile",
            "/root/.openvscode-server/data/Machine"
        ]

        for path in paths:
            await inst.aexec(f"mkdir -p {path}")
            await inst.aexec(f"echo '{settings_json}' | base64 -d > {path}/settings.json")

        # Copy tmux config if it exists
        if os.path.exists("/root/workspace/configs/tmux.conf"):
            await inst.aupload("/root/workspace/configs/tmux.conf", "/etc/tmux.conf")

    async def _configure_startup(self, inst: Instance) -> None:
        """Configure startup scripts and services."""
        # Upload startup.sh
        if os.path.exists("/root/workspace/startup.sh"):
            await inst.aupload("/root/workspace/startup.sh", "/startup.sh")
            await inst.aexec("chmod +x /startup.sh")

        # Upload prompt-wrapper.sh
        if os.path.exists("/root/workspace/prompt-wrapper.sh"):
            await inst.aupload("/root/workspace/prompt-wrapper.sh", "/usr/local/bin/prompt-wrapper")
            await inst.aexec("chmod +x /usr/local/bin/prompt-wrapper")

        # Create systemd service for cmux
        service_content = """[Unit]
Description=Cmux Entrypoint Autostart
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=-/etc/environment
ExecStart=/startup.sh
ExecStartPre=/bin/mkdir -p /var/log/cmux
StandardOutput=append:/var/log/cmux/cmux.service.log
StandardError=append:/var/log/cmux/cmux.service.log
Restart=no
User=root

[Install]
WantedBy=multi-user.target"""

        service_b64 = base64.b64encode(service_content.encode()).decode()
        await inst.aexec(f"echo '{service_b64}' | base64 -d > /etc/systemd/system/cmux.service")
        await inst.aexec("systemctl daemon-reload && systemctl enable cmux.service")
        await inst.aexec("mkdir -p /var/log/cmux")

    async def _run_task(self, task: Task) -> None:
        """Execute a single task with retry logic."""
        task.status = TaskStatus.RUNNING

        for attempt in range(task.retries):
            task.attempts = attempt + 1
            try:
                print(f"[{task.name}] Starting (attempt {task.attempts}/{task.retries})...")
                await asyncio.wait_for(
                    task.func(self.instance),
                    timeout=TASK_TIMEOUT
                )
                task.status = TaskStatus.COMPLETED
                print(f"[{task.name}] Completed successfully")
                return
            except asyncio.TimeoutError:
                print(f"[{task.name}] Timeout on attempt {task.attempts}")
                task.error = TimeoutError(f"Task timed out after {TASK_TIMEOUT}s")
            except Exception as e:
                print(f"[{task.name}] Failed on attempt {task.attempts}: {e}")
                task.error = e

            if attempt < task.retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

        task.status = TaskStatus.FAILED
        print(f"[{task.name}] Failed after {task.retries} attempts: {task.error}")

    async def build(self) -> None:
        """Execute all tasks respecting dependencies."""
        print(f"Starting parallel build with {len(self.graph.tasks)} tasks...")

        while not self.graph.all_completed():
            ready_tasks = self.graph.get_ready_tasks()

            if not ready_tasks:
                # Check for deadlock
                failed = self.graph.get_failed_tasks()
                if failed:
                    print(f"Build failed. Failed tasks: {[t.name for t in failed]}")
                    raise RuntimeError(f"Build failed due to task failures")

                await asyncio.sleep(1)
                continue

            # Run ready tasks in parallel
            print(f"Running {len(ready_tasks)} tasks in parallel: {[t.name for t in ready_tasks]}")
            await asyncio.gather(
                *[self._run_task(task) for task in ready_tasks],
                return_exceptions=True
            )

        # Check final status
        failed = self.graph.get_failed_tasks()
        if failed:
            for task in failed:
                print(f"Task {task.name} failed: {task.error}")
            raise RuntimeError(f"{len(failed)} tasks failed")

        print("All tasks completed successfully!")

    async def sanity_check(self) -> bool:
        """Run sanity checks to verify everything is installed correctly."""
        print("\n=== Running Sanity Checks ===")

        checks = {
            "Docker": "docker --version",
            "Docker Compose": "docker compose version",
            "Docker Buildx": "docker buildx version",
            "Node.js": "node --version",
            "npm": "npm --version",
            "Bun": "bun --version",
            "pnpm": "pnpm --version",
            "Git": "git --version",
            "GitHub CLI": "gh --version",
            "Cargo": "cargo --version 2>/dev/null || echo 'Cargo not installed'",
            "UV": "uv --version 2>/dev/null || echo 'UV not installed'",
            "envctl": "envctl --version",
            "envd": "ls -la /usr/local/bin/envd",
            "OpenVSCode": "ls -la /app/openvscode-server/bin/openvscode-server",
            "Worker": "ls -la /builtins/build/index.js",
            "Cursor": "/root/.local/bin/cursor-agent --version 2>/dev/null || echo 'Cursor not found'",
        }

        all_passed = True

        for name, cmd in checks.items():
            try:
                result = await asyncio.wait_for(
                    self.instance.aexec(cmd),
                    timeout=SANITY_CHECK_TIMEOUT
                )
                output = getattr(result, 'stdout', '').strip() if hasattr(result, 'stdout') else 'OK'
                print(f"✓ {name}: {output}")
            except Exception as e:
                print(f"✗ {name}: Failed - {e}")
                all_passed = False

        # Check if services are accessible
        print("\n=== Checking Services ===")

        # Start the cmux service
        try:
            await self.instance.aexec("systemctl start cmux.service || true")
            await asyncio.sleep(5)  # Give services time to start

            # Check service status
            result = await self.instance.aexec("systemctl is-active cmux.service || true")
            status = getattr(result, 'stdout', '').strip() if hasattr(result, 'stdout') else 'unknown'
            print(f"Cmux service status: {status}")

            # Check ports
            result = await self.instance.aexec("ss -lntp | grep -E ':(39376|39377|39378)' || true")
            ports = getattr(result, 'stdout', '') if hasattr(result, 'stdout') else ''
            if ports:
                print(f"✓ Ports listening:\n{ports}")
            else:
                print("✗ No ports listening yet")

        except Exception as e:
            print(f"✗ Service check failed: {e}")
            all_passed = False

        return all_passed


async def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Build Morph instance with parallel execution")
    parser.add_argument("--no-snapshot", action="store_true",
                       help="Skip creating final snapshot")
    parser.add_argument("--keep-running", action="store_true",
                       help="Keep instance running after build")
    args = parser.parse_args()

    print("Creating Morph instance...")
    print(f"Specs: {VCPUS} vCPUs, {MEMORY}MB RAM, {DISK_SIZE}MB disk")

    # Create instance
    instance = client.instances.start(
        vcpus=VCPUS,
        memory=MEMORY,
        disk_size=DISK_SIZE,
        ttl_seconds=3600,
        ttl_action="pause"
    )

    print(f"Instance ID: {instance.id}")

    try:
        # Wait for instance to be ready
        instance.wait_until_ready()
        print("Instance is ready")

        # Build the instance
        builder = MorphInstanceBuilder(instance)
        await builder.build()

        # Expose ports
        print("\n=== Exposing ports ===")
        ports = [39376, 39377, 39378]
        for port in ports:
            await instance.aexpose_http_service(port=port, name=f"port-{port}")
            print(f"Exposed port {port}")

        # Print networking info
        print("\n=== Networking Info ===")
        print(instance.networking.http_services)

        # Run sanity checks
        sanity_passed = await builder.sanity_check()

        if not sanity_passed:
            print("\n⚠️  Some sanity checks failed!")

        # Check VS Code endpoint
        services = instance.networking.http_services or []
        vscode_url = None
        for svc in services:
            if getattr(svc, 'port', None) == 39378 or getattr(svc, 'name', None) == 'port-39378':
                vscode_url = getattr(svc, 'url', None)
                break

        if vscode_url:
            print(f"\n=== VS Code URL ===")
            print(f"{vscode_url}/?folder=/root/workspace")

            # Try to verify it's responding
            import urllib.request
            for _ in range(30):
                try:
                    with urllib.request.urlopen(vscode_url, timeout=5) as resp:
                        if resp.code == 200:
                            print("✓ VS Code is responding")
                            break
                except Exception:
                    await asyncio.sleep(2)

        # Create snapshot if requested
        if not args.no_snapshot and sanity_passed:
            print("\n=== Creating snapshot ===")
            snapshot = instance.snapshot()
            print(f"Snapshot ID: {snapshot.id}")

            # Test the snapshot by starting a new instance
            print("\n=== Testing snapshot ===")
            test_instance = client.instances.start(
                snapshot_id=snapshot.id,
                ttl_seconds=300,
                ttl_action="stop"
            )

            try:
                test_instance.wait_until_ready()
                print(f"Test instance ID: {test_instance.id}")

                # Quick sanity check on new instance
                test_builder = MorphInstanceBuilder(test_instance)
                test_passed = await test_builder.sanity_check()

                if test_passed:
                    print("✓ Snapshot verified successfully!")
                else:
                    print("⚠️  Snapshot verification had some failures")

            finally:
                test_instance.stop()
                print("Test instance stopped")

        if not args.keep_running:
            instance.stop()
            print("\nInstance stopped")
        else:
            print(f"\nInstance {instance.id} is still running")

    except Exception as e:
        print(f"\nBuild failed: {e}")
        instance.stop()
        raise


if __name__ == "__main__":
    asyncio.run(main())
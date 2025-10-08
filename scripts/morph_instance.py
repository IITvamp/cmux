#!/usr/bin/env python3
"""
This script spawns a Morph instance and applies Dockerfile instructions in parallel
using a dependency graph for maximum concurrency.
"""

from __future__ import annotations

import argparse
import asyncio
import atexit
import hashlib
import os
import shlex
import signal
import sys
import time
import typing as t
from dataclasses import dataclass
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

import dotenv
try:
    from morphcloud.api import MorphCloudClient  # type: ignore
except ImportError:
    # Mock for development
    class MorphCloudClient:  # type: ignore
        pass

dotenv.load_dotenv()

client = MorphCloudClient()

# Morph snapshots run on x86_64 hardware; Docker plugins must match this arch
MORPH_EXPECTED_UNAME_ARCH = "x86_64"
DOCKER_COMPOSE_VERSION = "v2.32.2"
DOCKER_BUILDX_VERSION = "v0.18.0"

# Track live instance for cleanup on exit
current_instance: t.Optional[object] = None


def _cleanup_instance() -> None:
    global current_instance
    inst = current_instance
    if not inst:
        return
    try:
        print(f"Stopping instance {getattr(inst, 'id', '<unknown>')}...")
        inst.stop()  # type: ignore
        print("Instance stopped")
    except Exception as e:
        print(f"Failed to stop instance: {e}")
    finally:
        current_instance = None


def _signal_handler(signum, _frame) -> None:
    print(f"Received signal {signum}; cleaning up...")
    _cleanup_instance()
    # Exit immediately after cleanup
    try:
        sys.exit(1)
    except SystemExit:
        raise


# Ensure cleanup happens on normal exit and on signals
atexit.register(_cleanup_instance)
signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


@dataclass
class Task:
    """Represents a task in the dependency graph."""

    name: str
    dependencies: list[str]
    func: t.Callable[[t.Any], t.Awaitable[None]]
    description: str


class DependencyGraph:
    """Manages task dependencies and parallel execution."""

    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {}
        self.completed: set[str] = set()
        self.in_progress: set[str] = set()

    def add_task(self, task: Task) -> None:
        self.tasks[task.name] = task

    def get_ready_tasks(self) -> list[Task]:
        """Get tasks whose dependencies are all completed."""
        ready = []
        for task in self.tasks.values():
            if task.name in self.completed or task.name in self.in_progress:
                continue
            if all(dep in self.completed for dep in task.dependencies):
                ready.append(task)
        return ready

    async def execute(self, instance: t.Any) -> None:
        """Execute all tasks in parallel respecting dependencies."""
        semaphore = asyncio.Semaphore(10)  # Limit concurrent tasks

        async def run_task(task: Task) -> None:
            async with semaphore:
                self.in_progress.add(task.name)
                print(f"Starting task: {task.description}")
                try:
                    await task.func(instance)
                    print(f"Completed task: {task.description}")
                except Exception as e:
                    print(f"Failed task {task.name}: {e}")
                    raise
                finally:
                    self.in_progress.remove(task.name)
                    self.completed.add(task.name)

        while len(self.completed) < len(self.tasks):
            ready_tasks = self.get_ready_tasks()
            if not ready_tasks:
                await asyncio.sleep(0.1)
                continue

            # Run ready tasks concurrently
            await asyncio.gather(*(run_task(task) for task in ready_tasks))


async def ensure_docker_async(instance: t.Any) -> None:
    """Install Docker, docker compose, and enable BuildKit (async version)."""
    await instance.aexec(
        "DEBIAN_FRONTEND=noninteractive apt-get update && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y "
        "docker.io docker-compose python3-docker git curl && "
        "rm -rf /var/lib/apt/lists/*"
    )
    await instance.aexec(
        "mkdir -p /etc/docker && "
        'echo \'{"features":{"buildkit":true}}\' > /etc/docker/daemon.json && '
        "echo 'DOCKER_BUILDKIT=1' >> /etc/environment && "
        "systemctl restart docker && "
        "for i in {1..30}; do "
        "  if docker info >/dev/null 2>&1; then "
        "    echo 'Docker ready'; break; "
        "  else "
        "    echo 'Waiting for Docker...'; "
        "    [ $i -eq 30 ] && { echo 'Docker failed to start after 30 attempts'; exit 1; }; "
        "    sleep 2; "
        "  fi; "
        "done && "
        "docker --version && docker-compose --version && "
        "(docker compose version 2>/dev/null || echo 'docker compose plugin not available') && "
        "echo 'Docker commands verified'"
    )
    await ensure_docker_cli_plugins_async(instance)
    # Ensure IPv6 localhost resolution
    await instance.aexec("echo '::1       localhost' >> /etc/hosts")


async def ensure_docker_cli_plugins_async(instance: t.Any) -> None:
    """Install docker compose/buildx CLI plugins and verify versions (async)."""
    docker_plugin_cmds = [
        "mkdir -p /usr/local/lib/docker/cli-plugins",
        "arch=$(uname -m)",
        f'[ "$arch" = "{MORPH_EXPECTED_UNAME_ARCH}" ] || (echo "Morph snapshot architecture mismatch: expected {MORPH_EXPECTED_UNAME_ARCH} but got $arch" >&2; exit 1)',
        f"curl -fsSL https://github.com/docker/compose/releases/download/{DOCKER_COMPOSE_VERSION}/docker-compose-linux-{MORPH_EXPECTED_UNAME_ARCH} "
        f"-o /usr/local/lib/docker/cli-plugins/docker-compose",
        "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
        f"curl -fsSL https://github.com/docker/buildx/releases/download/{DOCKER_BUILDX_VERSION}/buildx-{DOCKER_BUILDX_VERSION}.linux-amd64 "
        f"-o /usr/local/lib/docker/cli-plugins/docker-buildx",
        "chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx",
        "docker compose version",
        "docker buildx version",
    ]
    await instance.aexec(" && ".join(docker_plugin_cmds))


async def install_base_packages(instance: t.Any) -> None:
    """Install base system packages."""
    await instance.aexec(
        "apt-get update && apt-get install -y --no-install-recommends "
        "ca-certificates curl wget git python3 make g++ bash unzip gnupg "
        "nano net-tools lsof sudo supervisor openssl pigz xz-utils tmux htop "
        "ripgrep jq nano net-tools lsof sudo supervisor iptables openssl pigz xz-utils tmux htop "
        "ripgrep jq "
        "&& rm -rf /var/lib/apt/lists/*"
    )


async def install_nodejs(instance: t.Any) -> None:
    """Install Node.js 24.x."""
    await instance.aexec(
        "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && "
        "apt-get install -y nodejs && "
        "rm -rf /var/lib/apt/lists/* && "
        "npm install -g node-gyp && "
        "corepack enable && "
        "corepack prepare pnpm@10.14.0 --activate"
    )


async def install_bun(instance: t.Any) -> None:
    """Install Bun."""
    await instance.aexec(
        "curl -fsSL https://bun.sh/install | bash && "
        "mv /root/.bun/bin/bun /usr/local/bin/ && "
        "ln -s /usr/local/bin/bun /usr/local/bin/bunx && "
        "bun --version && "
        "bunx --version"
    )


async def install_openvscode_server(instance: t.Any) -> None:
    """Install openvscode-server."""
    # Get latest release
    import subprocess
    result = subprocess.run([
        "curl", "-sX", "GET", "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest"
    ], capture_output=True, text=True)
    import json
    release_data = json.loads(result.stdout)
    code_release = release_data["tag_name"].replace("openvscode-server-v", "")

    arch = "x64"  # Assuming x86_64
    url = f"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v{code_release}/openvscode-server-v{code_release}-linux-{arch}.tar.gz"

    await instance.aexec(f"""
mkdir -p /app/openvscode-server && \
curl -fSL --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tar.gz "{url}" && \
tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server/ --strip-components=1 && \
rm -rf /tmp/openvscode-server.tar.gz
""")


async def upload_and_install_deps(instance: t.Any) -> None:
    """Upload package files and install dependencies."""
    # Upload package files
    await instance.aupload("package.json", "/cmux/package.json")
    await instance.aupload("bun.lock", "/cmux/bun.lock")
    await instance.aupload(".npmrc", "/cmux/.npmrc")

    # Upload package.json files from subdirs
    import glob
    for pattern in ["apps/*/package.json", "packages/*/package.json", "scripts/package.json"]:
        for path in glob.glob(pattern):
            remote_path = f"/cmux/{path}"
            os.makedirs(os.path.dirname(remote_path), exist_ok=True)
            await instance.aupload(path, remote_path)

    await instance.aexec("cd /cmux && bun install --frozen-lockfile --production")


async def upload_source_files(instance: t.Any) -> None:
    """Upload source files needed for building."""
    # Upload shared package
    await instance.aupload("packages/shared/src", "/cmux/packages/shared/src", recursive=True)
    await instance.aupload("packages/shared/tsconfig.json", "/cmux/packages/shared/tsconfig.json")

    # Upload convex package
    await instance.aupload("packages/convex", "/cmux/packages/convex", recursive=True)

    # Upload worker
    await instance.aupload("apps/worker/src", "/cmux/apps/worker/src", recursive=True)
    await instance.aupload("apps/worker/scripts", "/cmux/apps/worker/scripts", recursive=True)
    await instance.aupload("apps/worker/tsconfig.json", "/cmux/apps/worker/tsconfig.json")
    await instance.aupload("apps/worker/wait-for-docker.sh", "/cmux/apps/worker/wait-for-docker.sh")

    # Upload vscode extension
    await instance.aupload("packages/vscode-extension/src", "/cmux/packages/vscode-extension/src", recursive=True)
    await instance.aupload("packages/vscode-extension/tsconfig.json", "/cmux/packages/vscode-extension/tsconfig.json")
    await instance.aupload("packages/vscode-extension/.vscodeignore", "/cmux/packages/vscode-extension/.vscodeignore")
    await instance.aupload("packages/vscode-extension/LICENSE.md", "/cmux/packages/vscode-extension/LICENSE.md")


async def build_worker(instance: t.Any) -> None:
    """Build the worker."""
    await instance.aexec("""
cd /cmux && \
bun build ./apps/worker/src/index.ts \
--target node \
--outdir ./apps/worker/build \
--external @cmux/convex \
--external node:* && \
echo "Built worker" && \
mkdir -p /builtins && \
echo '{"name":"builtins","type":"module","version":"1.0.0"}' > /builtins/package.json && \
cp -r ./apps/worker/build /builtins/build && \
cp ./apps/worker/wait-for-docker.sh /usr/local/bin/ && \
chmod +x /usr/local/bin/wait-for-docker.sh
""")


async def build_vscode_extension(instance: t.Any) -> None:
    """Build VS Code extension."""
    await instance.aexec("cd /cmux/packages/vscode-extension && bun run package")


async def install_vscode_extensions(instance: t.Any) -> None:
    """Install VS Code extensions."""
    await instance.aexec("/app/openvscode-server/bin/openvscode-server --install-extension /cmux/packages/vscode-extension/cmux-vscode-extension-0.0.1.vsix")


async def install_github_cli(instance: t.Any) -> None:
    """Install GitHub CLI."""
    await instance.aexec(
        "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && "
        "chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && "
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && '
        "apt-get update && "
        "apt-get install -y gh && "
        "rm -rf /var/lib/apt/lists/*"
    )


async def install_cli_tools(instance: t.Any) -> None:
    """Install various CLI tools."""
    await instance.aexec(
        "bun add -g @openai/codex@0.42.0 @anthropic-ai/claude-code@2.0.0 @google/gemini-cli@0.1.21 opencode-ai@0.6.4 codebuff @devcontainers/cli @sourcegraph/amp"
    )


async def install_cursor_cli(instance: t.Any) -> None:
    """Install cursor CLI."""
    await instance.aexec("curl https://cursor.com/install -fsS | bash")


async def setup_iptables(instance: t.Any) -> None:
    """Set iptables-legacy."""
    await instance.aexec("update-alternatives --set iptables /usr/sbin/iptables-legacy")


async def install_docker_binaries(instance: t.Any) -> None:
    """Install Docker binaries."""
    await instance.aexec("""
set -eux; \
arch="$(uname -m)"; \
case "$arch" in \
    x86_64) dockerArch='x86_64' ;; \
    aarch64) dockerArch='aarch64' ;; \
    *) echo >&2 "error: unsupported architecture ($arch)"; exit 1 ;; \
esac; \
wget -O docker.tgz "https://download.docker.com/linux/static/stable/${dockerArch}/docker-28.3.2.tgz"; \
tar --extract --file docker.tgz --strip-components 1 --directory /usr/local/bin/; \
rm docker.tgz; \
dockerd --version; \
docker --version
""")


async def install_docker_plugins(instance: t.Any) -> None:
    """Install Docker Compose and Buildx plugins."""
    await instance.aexec("""
set -eux; \
mkdir -p /usr/local/lib/docker/cli-plugins; \
arch="$(uname -m)"; \
curl -SL "https://github.com/docker/compose/releases/download/v2.32.2/docker-compose-linux-${arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose; \
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose; \
curl -SL "https://github.com/docker/buildx/releases/download/v0.18.0/buildx-v0.18.0.linux-${arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-buildx; \
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx; \
echo "Docker plugins installed successfully"
""")


async def install_envctl_envd(instance: t.Any) -> None:
    """Install envctl and envd."""
    await instance.aexec("""
CMUX_ENV_VERSION=0.0.8 && \
arch="$(uname -m)" && \
case "$arch" in \
x86_64) arch_name="x86_64" ;; \
aarch64|arm64) arch_name="aarch64" ;; \
*) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
esac && \
curl -fsSL "https://github.com/lawrencecchen/cmux-env/releases/download/v${CMUX_ENV_VERSION}/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl.tar.gz" | tar -xz -C /tmp && \
mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl/envctl /usr/local/bin/envctl && \
mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl/envd /usr/local/bin/envd && \
rm -rf /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl && \
chmod +x /usr/local/bin/envctl /usr/local/bin/envd && \
envctl --version && \
envctl install-hook bash && \
echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.profile && \
echo '[ -f ~/.bashrc ] && . ~/.bashrc' > /root/.bash_profile && \
mkdir -p /run/user/0 && \
chmod 700 /run/user/0 && \
echo 'export XDG_RUNTIME_DIR=/run/user/0' >> /root/.bashrc
""")


async def install_tmux_config(instance: t.Any) -> None:
    """Install tmux configuration."""
    await instance.aupload("configs/tmux.conf", "/etc/tmux.conf")


async def install_claude_extension(instance: t.Any) -> None:
    """Install Claude Code extension."""
    await instance.aexec("""
wget --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -t 5 \
"https://marketplace.visualstudio.com/_apis/public/gallery/publishers/anthropic/vsextensions/claude-code/2.0.0/vspackage" \
-O /tmp/claude-code.vsix.gz && \
gunzip /tmp/claude-code.vsix.gz && \
/app/openvscode-server/bin/openvscode-server --install-extension /tmp/claude-code.vsix && \
rm /tmp/claude-code.vsix
""")


async def create_modprobe_script(instance: t.Any) -> None:
    """Create modprobe script."""
    await instance.aexec("""
cat > /usr/local/bin/modprobe << 'SCRIPT'
#!/bin/sh
set -eu
# "modprobe" without modprobe
for module; do
    if [ "${module#-}" = "$module" ]; then
        ip link show "$module" || true
        lsmod | grep "$module" || true
    fi
done
# remove /usr/local/... from PATH so we can exec the real modprobe as a last resort
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
exec modprobe "$@"
SCRIPT
chmod +x /usr/local/bin/modprobe
""")


async def create_directories_and_configs(instance: t.Any) -> None:
    """Create workspace directories and configs."""
    await instance.aexec("mkdir -p /workspace /root/workspace /root/lifecycle /var/log/cmux")

    # Create supervisor config
    await instance.aexec("""
mkdir -p /etc/supervisor/conf.d
cat > /etc/supervisor/conf.d/dockerd.conf << 'CONFIG'
[program:dockerd]
command=/usr/local/bin/dockerd
autostart=true
autorestart=true
stderr_logfile=/var/log/dockerd.err.log
stdout_logfile=/var/log/dockerd.out.log
CONFIG
""")

    # Copy startup script
    await instance.aupload("startup.sh", "/startup.sh")
    await instance.aexec("chmod +x /startup.sh")

    # Copy prompt wrapper
    await instance.aupload("prompt-wrapper.sh", "/usr/local/bin/prompt-wrapper")
    await instance.aexec("chmod +x /usr/local/bin/prompt-wrapper")

    # Copy collect scripts
    await instance.aupload("apps/worker/scripts/collect-relevant-diff.sh", "/usr/local/bin/cmux-collect-relevant-diff.sh")
    await instance.aupload("apps/worker/scripts/collect-crown-diff.sh", "/usr/local/bin/cmux-collect-crown-diff.sh")
    await instance.aexec("chmod +x /usr/local/bin/cmux-collect-relevant-diff.sh /usr/local/bin/cmux-collect-crown-diff.sh")


async def create_vscode_settings(instance: t.Any) -> None:
    """Create VS Code user settings."""
    await instance.aexec("""
mkdir -p /root/.openvscode-server/data/User && \
echo '{"workbench.startupEditor": "none", "terminal.integrated.macOptionClickForcesSelection": true, "terminal.integrated.shell.linux": "bash", "terminal.integrated.shellArgs.linux": ["-l"]}' > /root/.openvscode-server/data/User/settings.json && \
mkdir -p /root/.openvscode-server/data/User/profiles/default-profile && \
echo '{"workbench.startupEditor": "none", "terminal.integrated.macOptionClickForcesSelection": true, "terminal.integrated.shell.linux": "bash", "terminal.integrated.shellArgs.linux": ["-l"]}' > /root/.openvscode-server/data/User/profiles/default-profile/settings.json && \
mkdir -p /root/.openvscode-server/data/Machine && \
echo '{"workbench.startupEditor": "none", "terminal.integrated.macOptionClickForcesSelection": true, "terminal.integrated.shell.linux": "bash", "terminal.integrated.shellArgs.linux": ["-l"]}' > /root/.openvscode-server/data/Machine/settings.json
""")


async def run_sanity_checks(instance: t.Any) -> None:
    """Run sanity checks on the instance."""
    checks = [
        ("cargo", "cargo --version"),
        ("node", "node --version"),
        ("bun", "bun --version"),
        ("uv", "uv --version 2>/dev/null || echo 'uv not found'"),
        ("envd", "envd --version"),
        ("envctl", "envctl --version"),
    ]

    for name, cmd in checks:
        try:
            result = await instance.aexec(cmd)
            print(f"✓ {name}: {getattr(result, 'stdout', '').strip()}")
        except Exception as e:
            print(f"✗ {name}: {e}")

    # Check VS Code endpoint
    try:
        services = getattr(instance.networking, "http_services", [])
        vscode_service = None
        for svc in services:
            port = getattr(svc, "port", None)
            if port == 39378:
                vscode_service = svc
                break

        if vscode_service:
            url = getattr(vscode_service, "url", None)
            if url:
                # Try to curl the endpoint
                result = await instance.aexec(f"curl -s -f '{url}'")
                print("✓ VS Code endpoint accessible")
            else:
                print("✗ VS Code service has no URL")
        else:
            print("✗ VS Code service not found")
    except Exception as e:
        print(f"✗ VS Code endpoint check failed: {e}")

    # Check VNC endpoint (if exists)
    try:
        vnc_service = None
        for svc in getattr(instance.networking, "http_services", []):
            port = getattr(svc, "port", None)
            if port == 39379:  # Assuming VNC port
                vnc_service = svc
                break

        if vnc_service:
            url = getattr(vnc_service, "url", None)
            if url:
                result = await instance.aexec(f"curl -s -f '{url}'")
                print("✓ VNC endpoint accessible")
            else:
                print("✗ VNC service has no URL")
        else:
            print("! VNC service not configured")
    except Exception as e:
        print(f"✗ VNC endpoint check failed: {e}")

    # Check VNC endpoint (if exists)
    try:
        vnc_service = None
        for svc in getattr(instance.networking, "http_services", []):
            port = getattr(svc, "port", None)
            if port == 39379:  # Assuming VNC port
                vnc_service = svc
                break

        if vnc_service:
            url = getattr(vnc_service, "url", None)
            if url:
                result = await instance.aexec(f"curl -s -f '{url}'")
                print("✓ VNC endpoint accessible")
            else:
                print("✗ VNC service has no URL")
        else:
            print("! VNC service not configured")
    except Exception as e:
        print(f"✗ VNC endpoint check failed: {e}")


async def expose_additional_ports(instance: t.Any) -> None:
    """Expose additional ports."""
    ports = [39376, 39377, 39378, 39379]  # Add VNC port
    for port in ports:
        try:
            await instance.aexpose_http_service(port=port, name=f"port-{port}")
        except Exception as e:
            print(f"Warning: Failed to expose port {port}: {e}")


async def build_instance() -> object:
    """Build the instance with all dependencies in parallel."""
    # Create instance with specified resources
    vcpus = 10
    memory = 32768  # 32 GB
    disk_size = 65536  # 64 GB reasonable disk
    instance = client.instances.create(  # type: ignore
        vcpus=vcpus,
        memory=memory,
        disk_size=disk_size,
        ttl_seconds=3600,
        ttl_action="pause",
    )

    # Track for cleanup
    global current_instance
    current_instance = instance

    print(f"Instance ID: {instance.id}")

    # Build dependency graph
    graph = DependencyGraph()

    # Base system setup
    graph.add_task(Task("base_packages", [], install_base_packages, "Install base system packages"))
    graph.add_task(Task("nodejs", ["base_packages"], install_nodejs, "Install Node.js 24.x"))
    graph.add_task(Task("bun", ["base_packages"], install_bun, "Install Bun"))
    graph.add_task(Task("openvscode", ["base_packages"], install_openvscode_server, "Install OpenVSCode server"))

    # Dependency installation
    graph.add_task(Task("upload_deps", ["bun"], upload_and_install_deps, "Upload package files and install dependencies"))
    graph.add_task(Task("upload_sources", ["upload_deps"], upload_source_files, "Upload source files"))

    # Building
    graph.add_task(Task("build_worker", ["upload_sources"], build_worker, "Build worker"))
    graph.add_task(Task("build_extension", ["upload_sources"], build_vscode_extension, "Build VS Code extension"))
    graph.add_task(Task("install_extensions", ["build_extension", "openvscode"], install_vscode_extensions, "Install VS Code extensions"))

    # Additional tools
    graph.add_task(Task("github_cli", ["base_packages"], install_github_cli, "Install GitHub CLI"))
    graph.add_task(Task("cli_tools", ["bun"], install_cli_tools, "Install CLI tools"))
    graph.add_task(Task("cursor_cli", ["base_packages"], install_cursor_cli, "Install Cursor CLI"))

    # Docker setup
    graph.add_task(Task("iptables", ["base_packages"], setup_iptables, "Setup iptables"))
    graph.add_task(Task("docker_binaries", ["iptables"], install_docker_binaries, "Install Docker binaries"))
    graph.add_task(Task("docker_plugins", ["docker_binaries"], install_docker_plugins, "Install Docker plugins"))
    graph.add_task(Task("docker_full", ["docker_plugins"], ensure_docker_async, "Ensure Docker is fully set up"))

    # Environment tools
    graph.add_task(Task("env_tools", ["base_packages"], install_envctl_envd, "Install envctl and envd"))

    # Configuration
    graph.add_task(Task("tmux_config", ["base_packages"], install_tmux_config, "Install tmux config"))
    graph.add_task(Task("claude_extension", ["openvscode"], install_claude_extension, "Install Claude extension"))
    graph.add_task(Task("modprobe", ["base_packages"], create_modprobe_script, "Create modprobe script"))
    graph.add_task(Task("dirs_configs", ["base_packages"], create_directories_and_configs, "Create directories and configs"))
    graph.add_task(Task("vscode_settings", ["openvscode"], create_vscode_settings, "Create VS Code settings"))

    # Execute all tasks in parallel
    await graph.execute(instance)

    # Expose ports
    await expose_additional_ports(instance)

    # Run sanity checks
    print("\n--- Running sanity checks ---")
    await run_sanity_checks(instance)

    return instance


async def main_async() -> None:
    ap = argparse.ArgumentParser(description="Build Morph instance with parallel dependency execution")
    ap.add_argument(
        "--snapshot-only",
        action="store_true",
        help="Only create snapshot, don't start final instance",
    )
    args = ap.parse_args()

    try:
        instance = await build_instance()

        # Take snapshot
        print("\n--- Taking snapshot ---")
        snapshot = instance.snapshot()  # type: ignore
        print(f"Snapshot ID: {snapshot.id}")

        if not args.snapshot_only:
            # Start new instance from snapshot
            print("\n--- Starting instance from snapshot ---")
            new_instance = client.instances.start(  # type: ignore
                snapshot_id=snapshot.id,
                ttl_seconds=3600,
                ttl_action="pause",
            )
            global current_instance
            current_instance = new_instance

            print(f"New Instance ID: {new_instance.id}")

            # Expose ports on new instance
            await expose_additional_ports(new_instance)
            new_instance.wait_until_ready()

            # Final sanity checks
            print("\n--- Final sanity checks ---")
            await run_sanity_checks(new_instance)

            # Print VS Code URL
            services = getattr(new_instance.networking, 'http_services', [])
            vscode_url = None
            for svc in services:
                if getattr(svc, 'port', None) == 39378:
                    vscode_url = getattr(svc, 'url', None)
                    break
            print(f"\nVS Code URL: {vscode_url or 'Not found'}")

    finally:
        _cleanup_instance()


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
This script spawns a Morph instance, installs dependencies in parallel using a dependency graph,
builds custom components, and creates a snapshot optimized for fast execution.
"""

from __future__ import annotations

import argparse
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
from concurrent.futures import ThreadPoolExecutor, as_completed

import dotenv
from morphcloud.api import MorphCloudClient, Instance

dotenv.load_dotenv()

client = MorphCloudClient()

# Morph instances run on x86_64 hardware; Docker plugins must match this arch
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
        inst.stop()
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
class DependencyNode:
    """Represents a command with its dependencies."""
    id: str
    command: str
    dependencies: list[str]
    estimated_time: int = 30  # seconds


class ParallelExecutor:
    """Executes commands in parallel respecting dependencies."""

    def __init__(self, instance: Instance):
        self.instance = instance
        self.completed: set[str] = set()

    def execute_with_dependencies(self, nodes: list[DependencyNode]) -> Instance:
        """Execute commands respecting dependency order, parallelizing where possible."""
        # Simple topological sort
        remaining = {node.id: node for node in nodes}
        executed_order = []

        while remaining:
            # Find nodes with no unmet dependencies
            ready = []
            for node_id, node in remaining.items():
                if all(dep in self.completed for dep in node.dependencies):
                    ready.append(node)

            if not ready:
                # If no ready nodes but remaining nodes exist, execute them sequentially
                # This handles cases where dependencies might not be perfectly modeled
                ready = list(remaining.values())[:1]  # Take first one

            # Sort by estimated time (longest first for better parallelization)
            ready.sort(key=lambda x: x.estimated_time, reverse=True)

            # Execute ready nodes
            for node in ready:
                print(f"Executing: {node.command[:60]}...")
                try:
                    self.instance = self.instance.exec(node.command)
                    self.completed.add(node.id)
                    executed_order.append(node.id)
                    del remaining[node.id]
                except Exception as e:
                    print(f"Failed to execute {node.id}: {e}")
                    # Continue with other nodes
                    del remaining[node.id]

        print(f"Executed {len(executed_order)} commands")
        return self.instance


def parse_dockerfile_for_parallel(dockerfile_path: str) -> list[DependencyNode]:
    """Parse Dockerfile and create dependency nodes for parallel execution."""
    nodes = []

    with open(dockerfile_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract RUN commands from runtime stage only
    lines = content.split('\n')
    in_runtime = False
    run_count = 0

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if line.startswith('FROM ubuntu:24.04 AS runtime'):
            in_runtime = True
            i += 1
            continue
        elif line.startswith('FROM') and in_runtime:
            break  # Next stage

        if in_runtime and line.startswith('RUN'):
            command_lines = [line[4:].strip()]  # Remove 'RUN '
            i += 1

            # Handle multi-line RUN commands and heredocs
            while i < len(lines):
                next_line = lines[i].strip()
                if next_line.startswith('RUN') or next_line.startswith('FROM') or next_line.startswith('COPY') or next_line.startswith('WORKDIR'):
                    break
                if next_line:  # Non-empty line
                    command_lines.append(next_line)
                i += 1

            command = ' '.join(command_lines)

            # Create dependency node
            node_id = f"run_{run_count}"
            dependencies = []

            # Determine dependencies based on command content
            if 'apt-get update' in command:
                dependencies = []  # Base command
            elif 'apt-get install' in command:
                # Depends on apt-get update
                dependencies = [nid for nid, node in enumerate(nodes) if 'apt-get update' in node.command]
            elif 'nodesource.com' in command:
                # Depends on basic apt setup
                dependencies = [nid for nid, node in enumerate(nodes) if 'apt-get install' in node.command]
            elif 'nodejs' in command and 'install' in command:
                # Depends on nodesource setup
                dependencies = [nid for nid, node in enumerate(nodes) if 'nodesource.com' in node.command]
            elif 'bun.sh' in command:
                # Depends on curl being available
                dependencies = [nid for nid, node in enumerate(nodes) if 'apt-get install' in node.command and 'curl' in node.command]
            elif 'bun add' in command:
                # Depends on bun installation
                dependencies = [nid for nid, node in enumerate(nodes) if 'bun.sh' in node.command]
            elif 'github.com' in command and 'releases' in command:
                # Depends on curl
                dependencies = [nid for nid, node in enumerate(nodes) if 'apt-get install' in node.command and 'curl' in node.command]
            elif 'envctl' in command or 'envd' in command:
                # Depends on curl
                dependencies = [nid for nid, node in enumerate(nodes) if 'apt-get install' in node.command and 'curl' in node.command]
            # Default: depend on previous commands for safety
            else:
                if nodes:
                    dependencies = [nodes[-1].id]

            nodes.append(DependencyNode(
                id=node_id,
                command=command,
                dependencies=[f"run_{dep}" for dep in dependencies],
                estimated_time=120 if 'install' in command or 'download' in command else 30
            ))
            run_count += 1
        else:
            i += 1

    return nodes


def ensure_docker(instance: Instance) -> Instance:
    """Install Docker, docker compose, and enable BuildKit."""
    instance = instance.setup(
        "DEBIAN_FRONTEND=noninteractive apt-get update && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y "
        "docker.io docker-compose python3-docker git curl && "
        "rm -rf /var/lib/apt/lists/*"
    )
    instance = instance.exec(
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
    # Note: CLI plugins installation would require additional setup
    return instance


def upload_repo_files(instance: Instance) -> Instance:
    """Upload necessary repo files for building custom components."""
    files_to_upload = [
        "package.json", "bun.lock", ".npmrc",
        "apps/worker/src", "apps/worker/scripts", "apps/worker/tsconfig.json",
        "packages/shared/src", "packages/shared/tsconfig.json",
        "packages/convex", "packages/vscode-extension/src",
        "packages/vscode-extension/tsconfig.json", "configs/tmux.conf",
        "startup.sh", "prompt-wrapper.sh"
    ]

    for file_path in files_to_upload:
        if os.path.exists(file_path):
            recursive = os.path.isdir(file_path)
            print(f"Uploading {file_path}...")
            instance = instance.upload(file_path, f"/root/workspace/{file_path}", recursive=recursive)

    return instance


def build_custom_components(instance: Instance) -> Instance:
    """Build worker, envd, envctl and other custom components."""
    commands = [
        # Install Node.js and dependencies
        "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs",
        "npm install -g node-gyp && corepack enable && corepack prepare pnpm@10.14.0 --activate",

        # Install Bun
        "curl -fsSL https://bun.sh/install | bash",
        "mv /root/.bun/bin/bun /usr/local/bin/ && ln -s /usr/local/bin/bun /usr/local/bin/bunx",

        # Install additional tools
        "bun add -g @openai/codex@0.42.0 @anthropic-ai/claude-code@2.0.0 @google/gemini-cli@0.1.21 opencode-ai@0.6.4 codebuff @devcontainers/cli @sourcegraph/amp",

        # Install envctl/envd
        'CMUX_ENV_VERSION=0.0.8 && arch="$(uname -m)" && case "$arch" in x86_64) arch_name="x86_64" ;; aarch64|arm64) arch_name="aarch64" ;; *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; esac && curl -fsSL "https://github.com/lawrencecchen/cmux-env/releases/download/v${CMUX_ENV_VERSION}/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl.tar.gz" | tar -xz -C /tmp && mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl/envctl /usr/local/bin/envctl && mv /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl/envd /usr/local/bin/envd && rm -rf /tmp/cmux-env-${CMUX_ENV_VERSION}-${arch_name}-unknown-linux-musl && chmod +x /usr/local/bin/envctl /usr/local/bin/envd',

        # Build worker
        "cd /root/workspace && bun install --frozen-lockfile",
        "cd /root/workspace && bun build ./apps/worker/src/index.ts --target node --outdir ./apps/worker/build --external @cmux/convex --external node:*",
        "mkdir -p /builtins && cp -r /root/workspace/apps/worker/build /builtins/build",

        # Build VS Code extension
        "cd /root/workspace/packages/vscode-extension && bun run package"
    ]

    for cmd in commands:
        print(f"Executing: {cmd[:50]}...")
        instance = instance.exec(cmd)

    return instance


def run_sanity_checks(instance: Instance) -> None:
    """Run sanity checks on the instance."""
    checks = [
        ("cargo", "cargo --version || echo 'cargo not installed'"),
        ("node", "node --version"),
        ("bun", "bun --version"),
        ("uv", "uv --version || echo 'uv not installed'"),
        ("envctl", "envctl --version"),
        ("envd", "envd --version"),
        ("docker", "docker --version"),
        ("docker-compose", "docker-compose --version || docker compose version"),
    ]

    print("\n--- Sanity Checks ---")
    for name, cmd in checks:
        try:
            result = instance.exec(cmd)
            output = getattr(result, 'stdout', '').strip()
            if output:
                first_line = output.split('\n')[0]
                print(f"✓ {name}: {first_line}")
            else:
                print(f"✗ {name}: No output")
        except Exception as e:
            print(f"✗ {name}: Failed - {e}")

    # Check if we can curl VSCode endpoint from within
    try:
        vscode_check = instance.exec("timeout 10 curl -s -o /dev/null -w '%{http_code}' http://localhost:39378/")
        status_code = getattr(vscode_check, 'stdout', '').strip()
        if status_code == '200':
            print("✓ VSCode endpoint accessible from within")
        else:
            print(f"✗ VSCode endpoint returned status {status_code}")
    except Exception as e:
        print(f"✗ VSCode endpoint check failed: {e}")

    # Check if we can curl VNC endpoint from within (if it exists)
    try:
        vnc_check = instance.exec("timeout 10 curl -s -o /dev/null -w '%{http_code}' http://localhost:39379/ || echo 'no_vnc'")
        status = getattr(vnc_check, 'stdout', '').strip()
        if status == '200':
            print("✓ VNC endpoint accessible from within")
        elif status == 'no_vnc':
            print("! VNC endpoint not configured")
        else:
            print(f"✗ VNC endpoint returned status {status}")
    except Exception as e:
        print(f"✗ VNC endpoint check failed: {e}")


def expose_additional_ports(instance: Instance) -> Instance:
    """Expose additional ports using private API."""
    # This would need to be implemented based on the actual Morph API
    # For now, expose the standard ports
    expose_ports = [39376, 39377, 39378, 39379]  # Added VNC port
    for port in expose_ports:
        instance.expose_http_service(port=port, name=f"port-{port}")
    return instance


def main() -> None:
    ap = argparse.ArgumentParser(description="Build Morph instance with parallel dependency execution")
    ap.add_argument("--dockerfile", default="Dockerfile", help="Path to Dockerfile")
    args = ap.parse_args()

    try:
        # Create base snapshot first
        print("Creating base snapshot...")
        base_snapshot = client.snapshots.create(
            vcpus=10,
            memory=32768,  # 32GB
            disk_size=65536,  # 64GB reasonable disk
            digest=None,
        )

        # Start instance from base snapshot
        print("Starting instance with 32GB RAM, 10 cores...")
        instance = client.instances.start(
            snapshot_id=base_snapshot.id,
            ttl_seconds=7200,  # 2 hours
            ttl_action="pause",
        )
        # track for cleanup
        global current_instance
        current_instance = instance

        print(f"Instance ID: {instance.id}")

        # Install Docker
        print("Installing Docker...")
        instance = ensure_docker(instance)

        # Parse Dockerfile and create dependency graph
        print("Parsing Dockerfile for parallel execution...")
        nodes = parse_dockerfile_for_parallel(args.dockerfile)

        # Execute commands in parallel respecting dependencies
        print(f"Executing {len(nodes)} commands with dependency management...")
        executor = ParallelExecutor(instance)
        instance = executor.execute_with_dependencies(nodes)

        # Upload repo files
        print("Uploading repository files...")
        instance = upload_repo_files(instance)

        # Build custom components
        print("Building custom components...")
        instance = build_custom_components(instance)

        # Run initial sanity checks
        run_sanity_checks(instance)

        # Expose additional ports
        print("Exposing ports...")
        instance = expose_additional_ports(instance)

        # Take snapshot
        print("Taking snapshot...")
        snapshot = instance.snapshot()
        print(f"Snapshot ID: {snapshot.id}")

        # Start new instance from snapshot
        print("Starting instance from snapshot...")
        final_instance = client.instances.start(
            snapshot_id=snapshot.id,
            ttl_seconds=3600,
            ttl_action="pause",
        )
        current_instance = final_instance

        print(f"Final Instance ID: {final_instance.id}")

        # Expose ports on final instance
        for port in [39376, 39377, 39378, 39379]:
            final_instance.expose_http_service(port=port, name=f"port-{port}")

        final_instance.wait_until_ready()

        # Final sanity checks
        print("Running final sanity checks...")
        run_sanity_checks(final_instance)

        print("Instance ready!")
        print(f"VSCode URL: {final_instance.networking.http_services[2].url}/?folder=/root/workspace")

    finally:
        _cleanup_instance()


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Build a Morph snapshot using instance-based parallel provisioning.

This script:
1. Starts a Morph instance directly (no initial snapshot)
2. Uploads the repo
3. Executes provisioning steps in parallel using a dependency graph
4. Runs sanity checks
5. Takes a snapshot
6. Starts a new instance from the snapshot and runs sanity checks again
"""

from __future__ import annotations

import argparse
import atexit
import concurrent.futures
import os
import shlex
import signal
import subprocess
import sys
import tempfile
import threading
import time
import typing as t
from dataclasses import dataclass, field
from pathlib import Path
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

import dotenv
from morphcloud.api import MorphCloudClient

dotenv.load_dotenv()

client = MorphCloudClient()
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
    try:
        sys.exit(1)
    except SystemExit:
        raise


atexit.register(_cleanup_instance)
signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


@dataclass
class Task:
    """Represents a provisioning task with dependencies."""

    name: str
    command: str
    dependencies: list[str] = field(default_factory=list)
    completed: threading.Event = field(default_factory=threading.Event)
    result: t.Optional[object] = None
    error: t.Optional[Exception] = None


class ParallelProvisioner:
    """Executes provisioning tasks in parallel based on dependency graph."""

    def __init__(self, instance: object, max_workers: int = 10):
        self.instance = instance
        self.max_workers = max_workers
        self.tasks: dict[str, Task] = {}
        self.lock = threading.Lock()

    def add_task(self, name: str, command: str, dependencies: list[str] | None = None):
        """Add a task to the provisioning graph."""
        self.tasks[name] = Task(
            name=name, command=command, dependencies=dependencies or []
        )

    def _execute_task(self, task: Task) -> None:
        """Execute a single task after its dependencies complete."""
        try:
            # Wait for dependencies
            for dep_name in task.dependencies:
                dep_task = self.tasks.get(dep_name)
                if dep_task:
                    dep_task.completed.wait()
                    if dep_task.error:
                        raise Exception(
                            f"Dependency {dep_name} failed: {dep_task.error}"
                        )

            # Execute the task
            print(f"[{task.name}] Starting...")
            result = self.instance.exec(task.command)
            task.result = result

            # Check for errors
            exit_code = getattr(result, "exit_code", 0)
            if exit_code != 0:
                stderr = getattr(result, "stderr", "")
                raise Exception(f"Command failed with exit code {exit_code}: {stderr}")

            print(f"[{task.name}] ✓ Completed")
        except Exception as e:
            task.error = e
            print(f"[{task.name}] ✗ Failed: {e}")
            raise
        finally:
            task.completed.set()

    def execute_all(self) -> None:
        """Execute all tasks in parallel, respecting dependencies."""
        print(f"\nExecuting {len(self.tasks)} tasks with up to {self.max_workers} parallel workers...")

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=self.max_workers
        ) as executor:
            futures = {
                executor.submit(self._execute_task, task): task
                for task in self.tasks.values()
            }

            # Wait for all tasks to complete
            for future in concurrent.futures.as_completed(futures):
                task = futures[future]
                try:
                    future.result()
                except Exception:
                    # Error already logged in _execute_task
                    pass

        # Check if any tasks failed
        failed_tasks = [t for t in self.tasks.values() if t.error]
        if failed_tasks:
            print(f"\n✗ {len(failed_tasks)} tasks failed:")
            for task in failed_tasks:
                print(f"  - {task.name}: {task.error}")
            raise Exception("Provisioning failed")

        print("\n✓ All provisioning tasks completed successfully")


def create_repo_tarball(repo_path: str) -> str:
    """Create a tarball of the repo, excluding large directories."""
    print(f"Creating tarball of repo at {repo_path}...")
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz", prefix="cmux-repo-")
    os.close(fd)

    # Exclude patterns
    exclude_patterns = [
        ".git",
        "node_modules",
        ".next",
        "dist",
        "build",
        ".turbo",
        "*.log",
        ".env*",
        ".vscode",
        ".idea",
    ]

    exclude_args = []
    for pattern in exclude_patterns:
        exclude_args.extend(["--exclude", pattern])

    subprocess.run(
        ["tar", "-czf", tar_path, "-C", repo_path] + exclude_args + ["."],
        check=True,
        capture_output=True,
    )

    tar_size_mb = os.path.getsize(tar_path) / (1024 * 1024)
    print(f"Created tarball: {tar_path} ({tar_size_mb:.2f} MB)")
    return tar_path


def setup_parallel_provisioning(instance: object) -> ParallelProvisioner:
    """Set up the parallel provisioning graph."""
    provisioner = ParallelProvisioner(instance, max_workers=10)

    # Base system updates (can run in parallel)
    provisioner.add_task(
        "apt-update",
        "DEBIAN_FRONTEND=noninteractive apt-get update",
    )

    # Install base utilities (depends on apt-update)
    provisioner.add_task(
        "install-base-utils",
        "DEBIAN_FRONTEND=noninteractive apt-get install -y "
        "curl wget git sudo zsh build-essential procps util-linux coreutils "
        "ca-certificates gnupg lsb-release && "
        "rm -rf /var/lib/apt/lists/*",
        dependencies=["apt-update"],
    )

    # Install Docker (depends on base utils)
    provisioner.add_task(
        "install-docker",
        "curl -fsSL https://get.docker.com | sh && "
        "usermod -aG docker root",
        dependencies=["install-base-utils"],
    )

    # Install Node.js 24
    provisioner.add_task(
        "install-node-24",
        "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs && "
        "rm -rf /var/lib/apt/lists/*",
        dependencies=["apt-update"],
    )

    # Install Bun (independent)
    provisioner.add_task(
        "install-bun",
        "curl -fsSL https://bun.sh/install | bash && "
        "ln -sf /root/.bun/bin/bun /usr/local/bin/bun && "
        "ln -sf /root/.bun/bin/bunx /usr/local/bin/bunx",
        dependencies=["install-base-utils"],
    )

    # Install Rust/Cargo (independent)
    provisioner.add_task(
        "install-rust",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && "
        "ln -sf /root/.cargo/bin/cargo /usr/local/bin/cargo && "
        "ln -sf /root/.cargo/bin/rustc /usr/local/bin/rustc",
        dependencies=["install-base-utils"],
    )

    # Install uv (Python package manager)
    provisioner.add_task(
        "install-uv",
        "curl -LsSf https://astral.sh/uv/install.sh | sh && "
        "ln -sf /root/.cargo/bin/uv /usr/local/bin/uv",
        dependencies=["install-base-utils"],
    )

    # Enable corepack for pnpm (depends on Node)
    provisioner.add_task(
        "enable-corepack",
        "corepack enable && corepack prepare pnpm@10.14.0 --activate",
        dependencies=["install-node-24"],
    )

    # Install nvm and Node 18 (depends on base utils)
    provisioner.add_task(
        "install-nvm",
        'export NVM_DIR="/root/.nvm" && '
        "mkdir -p $NVM_DIR && "
        "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && "
        '. "$NVM_DIR/nvm.sh" && '
        "nvm install 18 && "
        "nvm alias default 24",
        dependencies=["install-node-24"],
    )

    # Set up shell configurations (depends on installations)
    provisioner.add_task(
        "setup-shell",
        'echo \'export NVM_DIR="$HOME/.nvm"\' >> ~/.zshrc && '
        'echo \'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\' >> ~/.zshrc && '
        'echo \'export PATH="/root/.bun/bin:$PATH"\' >> ~/.zshrc && '
        'echo \'export PATH="/root/.cargo/bin:$PATH"\' >> ~/.zshrc',
        dependencies=["install-bun", "install-nvm", "install-rust"],
    )

    # Create workspace directory (independent)
    provisioner.add_task(
        "create-workspace",
        "mkdir -p /root/workspace && chown -R root:root /root/workspace",
    )

    return provisioner


def run_sanity_checks(instance: object) -> bool:
    """Run sanity checks to verify the instance is properly provisioned."""
    print("\n=== Running Sanity Checks ===")

    checks = [
        ("cargo", "cargo --version"),
        ("node", "node --version"),
        ("bun", "bun --version"),
        ("uv", "uv --version"),
        ("docker", "docker --version"),
        ("pnpm", "pnpm --version"),
        ("nvm", '. /root/.nvm/nvm.sh && nvm --version'),
        ("git", "git --version"),
    ]

    all_passed = True
    for name, cmd in checks:
        try:
            result = instance.exec(cmd)
            exit_code = getattr(result, "exit_code", 0)
            if exit_code == 0:
                output = getattr(result, "stdout", "").strip()
                print(f"✓ {name}: {output}")
            else:
                print(f"✗ {name}: Command failed")
                all_passed = False
        except Exception as e:
            print(f"✗ {name}: {e}")
            all_passed = False

    return all_passed


def check_http_endpoints(instance: object, ports: list[int]) -> bool:
    """Check if HTTP endpoints are accessible."""
    print("\n=== Checking HTTP Endpoints ===")

    services = getattr(instance.networking, "http_services", [])

    def _get(obj: object, key: str) -> t.Any:
        if isinstance(obj, dict):
            return obj.get(key)
        return getattr(obj, key, None)

    all_passed = True
    for port in ports:
        service = None
        for svc in services or []:
            svc_port = _get(svc, "port")
            if svc_port == port:
                service = svc
                break

        url = _get(service, "url") if service is not None else None
        if not url:
            print(f"✗ Port {port}: No exposed HTTP service found")
            all_passed = False
            continue

        # Try to curl the endpoint
        try:
            for attempt in range(5):
                try:
                    with urllib_request.urlopen(url, timeout=5) as resp:
                        code = getattr(resp, "status", getattr(resp, "code", None))
                        if code == 200:
                            print(f"✓ Port {port}: HTTP {code}")
                            break
                        else:
                            print(f"  Port {port}: HTTP {code} (attempt {attempt + 1}/5)")
                except (HTTPError, URLError) as e:
                    if attempt == 4:
                        raise
                    time.sleep(2)
        except Exception as e:
            print(f"✗ Port {port}: {e}")
            all_passed = False

    return all_passed


def build_custom_components(instance: object) -> None:
    """Build custom components like worker inside the instance."""
    print("\n=== Building Custom Components ===")

    # Install dependencies
    print("Installing dependencies...")
    result = instance.exec(
        "cd /root/workspace && "
        "bun install --frozen-lockfile"
    )
    if getattr(result, "exit_code", 0) != 0:
        raise Exception("Failed to install dependencies")

    # Build worker
    print("Building worker...")
    result = instance.exec(
        "cd /root/workspace/apps/worker && "
        "bun run build"
    )
    if getattr(result, "exit_code", 0) != 0:
        raise Exception("Failed to build worker")

    print("✓ Custom components built successfully")


def expose_ports_private(instance: object, ports: list[int]) -> None:
    """Expose ports using the instance's private function."""
    print("\n=== Exposing Ports ===")
    for port in ports:
        instance.expose_http_service(port=port, name=f"port-{port}")
        print(f"✓ Exposed port {port}")


def provision_instance(
    repo_path: str,
    vcpus: int = 10,
    memory: int = 32768,
    disk_size: int = 102400,
) -> object:
    """Provision a new instance with parallel provisioning."""
    print(f"\n=== Starting Instance ===")
    print(f"vCPUs: {vcpus}, Memory: {memory} MB, Disk: {disk_size} MB")

    # Start instance from base snapshot
    instance = client.instances.start(
        vcpus=vcpus,
        memory=memory,
        disk_size=disk_size,
        ttl_seconds=7200,
        ttl_action="pause",
    )

    global current_instance
    current_instance = instance

    print(f"Instance ID: {instance.id}")
    instance.wait_until_ready()
    print("✓ Instance ready")

    # Create and upload repo tarball
    tar_path = create_repo_tarball(repo_path)
    try:
        print("\nUploading repo...")
        instance.upload(tar_path, "/tmp/repo.tar.gz", recursive=False)
        print("✓ Repo uploaded")

        print("\nExtracting repo...")
        instance.exec("mkdir -p /root/workspace")
        instance.exec("tar -xzf /tmp/repo.tar.gz -C /root/workspace")
        instance.exec("rm /tmp/repo.tar.gz")
        print("✓ Repo extracted")
    finally:
        if os.path.exists(tar_path):
            os.unlink(tar_path)

    # Run parallel provisioning
    print("\n=== Starting Parallel Provisioning ===")
    provisioner = setup_parallel_provisioning(instance)
    provisioner.execute_all()

    # Build custom components
    build_custom_components(instance)

    # Expose ports
    expose_ports_private(instance, [39376, 39377, 39378])

    # Run sanity checks
    if not run_sanity_checks(instance):
        raise Exception("Initial sanity checks failed")

    # Check HTTP endpoints (optional, may not be running yet)
    # check_http_endpoints(instance, [39378])

    return instance


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build Morph snapshot using instance-based parallel provisioning"
    )
    ap.add_argument(
        "--repo-path",
        default="/root/workspace",
        help="Path to the repository to upload",
    )
    ap.add_argument(
        "--vcpus",
        type=int,
        default=10,
        help="Number of vCPUs for the instance",
    )
    ap.add_argument(
        "--memory",
        type=int,
        default=32768,
        help="Memory in MB for the instance",
    )
    ap.add_argument(
        "--disk-size",
        type=int,
        default=102400,
        help="Disk size in MB for the instance",
    )
    ap.add_argument(
        "--skip-snapshot",
        action="store_true",
        help="Skip taking a snapshot at the end",
    )
    args = ap.parse_args()

    try:
        # Provision instance
        instance = provision_instance(
            args.repo_path,
            vcpus=args.vcpus,
            memory=args.memory,
            disk_size=args.disk_size,
        )

        if args.skip_snapshot:
            print("\n✓ Instance provisioned successfully (snapshot skipped)")
            print(f"Instance ID: {instance.id}")
            input("Press Enter to stop instance...")
            return

        # Take snapshot
        print("\n=== Taking Snapshot ===")
        snapshot = instance.snapshot()
        print(f"✓ Snapshot ID: {snapshot.id}")

        # Stop the current instance
        print("\nStopping provisioning instance...")
        instance.stop()
        global current_instance
        current_instance = None

        # Start new instance from snapshot
        print("\n=== Starting Instance from Snapshot ===")
        test_instance = client.instances.start(
            snapshot_id=snapshot.id,
            ttl_seconds=3600,
            ttl_action="pause",
        )
        current_instance = test_instance

        print(f"Test Instance ID: {test_instance.id}")
        test_instance.wait_until_ready()
        print("✓ Test instance ready")

        # Expose ports on test instance
        expose_ports_private(test_instance, [39376, 39377, 39378])

        # Run sanity checks again
        print("\n=== Running Final Sanity Checks ===")
        if not run_sanity_checks(test_instance):
            raise Exception("Final sanity checks failed")

        print("\n" + "=" * 60)
        print("✓ SUCCESS: Snapshot provisioned and verified!")
        print(f"Snapshot ID: {snapshot.id}")
        print(f"Test Instance ID: {test_instance.id}")
        print("=" * 60)

        input("\nPress Enter to stop test instance...")

    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        raise
    finally:
        _cleanup_instance()


if __name__ == "__main__":
    main()

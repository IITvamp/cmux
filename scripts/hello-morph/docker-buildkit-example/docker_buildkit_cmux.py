# /// script
# dependencies = [
#   "morphcloud",
#   "requests",
#   "tqdm",
#   "python-dotenv",
# ]
# ///

#!/usr/bin/env python3
"""
Port of coderouter Dockerfile to Morph Cloud VM.
Sets up Node.js, Bun, OpenVSCode server, and global packages.
"""

import fnmatch
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from morphcloud.api import MorphCloudClient
from tqdm import tqdm

load_dotenv()


def run_ssh_command(instance, command, sudo=False, print_output=True):
    """Run a command on the instance via SSH and return the result"""
    if sudo and not command.startswith("sudo "):
        command = f"sudo {command}"

    print(f"Running: {command}")
    result = instance.exec(command)

    if print_output:
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(f"ERR: {result.stderr}", file=sys.stderr)

    if result.exit_code != 0:
        print(f"Command failed with exit code {result.exit_code}")

    return result


def read_ignore_patterns(ignore_file):
    """Read patterns from .gitignore or .dockerignore file"""
    patterns = []
    if os.path.exists(ignore_file):
        with open(ignore_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    patterns.append(line)
    return patterns


def should_ignore_gitignore(path, patterns, root_dir):
    """Check if a path should be ignored based on gitignore patterns (recursive)"""
    # Convert path to relative path from root_dir
    try:
        rel_path = os.path.relpath(path, root_dir)
    except ValueError:
        rel_path = path

    # Check patterns against the path and all its parent directories
    path_parts = Path(rel_path).parts

    for pattern in patterns:
        # Remove leading slash for consistent matching
        pattern = pattern.lstrip("/")

        # Check if pattern matches the full path
        if fnmatch.fnmatch(rel_path, pattern):
            return True

        # Check if pattern matches any part of the path (for recursive matching)
        for i in range(len(path_parts)):
            partial_path = "/".join(path_parts[i:])
            if fnmatch.fnmatch(partial_path, pattern):
                return True

            # Also check individual directory/file names
            if fnmatch.fnmatch(path_parts[i], pattern):
                return True

    return False


def should_ignore_dockerignore(path, patterns, root_dir):
    """Check if a path should be ignored based on dockerignore patterns (non-recursive)"""
    # Convert path to relative path from root_dir
    try:
        rel_path = os.path.relpath(path, root_dir)
    except ValueError:
        rel_path = path

    for pattern in patterns:
        # Remove leading slash for consistent matching
        pattern = pattern.lstrip("/")

        # Direct match from root
        if fnmatch.fnmatch(rel_path, pattern):
            return True

    return False


def get_files_to_upload(local_dir, gitignore_patterns=None, dockerignore_patterns=None):
    """Get list of files to upload, respecting ignore patterns"""
    if gitignore_patterns is None:
        gitignore_patterns = []
    if dockerignore_patterns is None:
        dockerignore_patterns = []

    files_to_upload = []

    for root, dirs, files in os.walk(local_dir):
        # Filter directories based on patterns
        filtered_dirs = []
        for d in dirs:
            dir_path = os.path.join(root, d)

            # Skip if ignored by gitignore (recursive) or dockerignore (non-recursive)
            if should_ignore_gitignore(dir_path, gitignore_patterns, local_dir):
                continue
            if should_ignore_dockerignore(dir_path, dockerignore_patterns, local_dir):
                continue

            filtered_dirs.append(d)

        # Update dirs in-place to affect os.walk recursion
        dirs[:] = filtered_dirs

        # Check files
        for file in files:
            file_path = os.path.join(root, file)

            # Skip if ignored
            if should_ignore_gitignore(file_path, gitignore_patterns, local_dir):
                continue
            if should_ignore_dockerignore(file_path, dockerignore_patterns, local_dir):
                continue

            # Skip very large files
            try:
                if os.path.getsize(file_path) > 100 * 1024 * 1024:  # 100MB
                    print(
                        f"Skipping large file: {os.path.relpath(file_path, local_dir)}"
                    )
                    continue
            except OSError:
                continue

            files_to_upload.append(file_path)

    return files_to_upload


def upload_file_sftp(sftp, local_path, remote_path, pbar=None):
    """Upload a single file via SFTP with progress tracking"""
    # Create remote directory if needed
    remote_dir = os.path.dirname(remote_path)
    if remote_dir:
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            # Create parent directories recursively
            dirs_to_create = []
            current = remote_dir
            while current and current != "/":
                try:
                    sftp.stat(current)
                    break
                except FileNotFoundError:
                    dirs_to_create.append(current)
                    current = os.path.dirname(current)

            # Create directories in reverse order (parent first)
            for dir_path in reversed(dirs_to_create):
                try:
                    sftp.mkdir(dir_path)
                except OSError:
                    pass  # Directory might already exist

    # Upload file
    sftp.put(local_path, remote_path)

    # Preserve executable permissions
    if os.access(local_path, os.X_OK):
        sftp.chmod(remote_path, 0o755)

    if pbar:
        pbar.update(1)


def upload_directory_sftp(
    instance, local_dir, remote_dir, show_progress=True, max_workers=8
):
    """Upload a directory via SFTP, respecting .gitignore and .dockerignore"""
    # Read ignore patterns
    gitignore_patterns = read_ignore_patterns(os.path.join(local_dir, ".gitignore"))
    dockerignore_patterns = read_ignore_patterns(
        os.path.join(local_dir, ".dockerignore")
    )

    # Always ignore .git directory
    gitignore_patterns.append(".git")
    gitignore_patterns.append(".git/**")

    # Get list of files to upload
    print(f"Scanning files in {local_dir}...")
    files_to_upload = get_files_to_upload(
        local_dir, gitignore_patterns, dockerignore_patterns
    )

    if not files_to_upload:
        print("No files to upload.")
        return

    print(f"Found {len(files_to_upload)} files to upload")
    print(f"Using {max_workers} parallel workers")

    # Upload files via SFTP with parallel workers
    # Create progress bar
    if show_progress:
        pbar = tqdm(total=len(files_to_upload), desc="Uploading files", unit="file")
        pbar_lock = Lock()
    else:
        pbar = None
        pbar_lock = None

    # Create a list to track failed uploads
    failed_uploads = []
    failed_lock = Lock()

    def upload_single_file(local_path):
        """Upload a single file in a thread"""
        # Calculate relative path
        rel_path = os.path.relpath(local_path, local_dir)
        remote_path = os.path.join(remote_dir, rel_path).replace("\\", "/")

        try:
            # Each thread needs its own SSH/SFTP connection
            with instance.ssh() as ssh:
                sftp = ssh._client.open_sftp()
                try:
                    upload_file_sftp(sftp, local_path, remote_path, pbar=None)

                    # Update progress bar thread-safely
                    if pbar:
                        with pbar_lock:
                            pbar.update(1)

                    return True, rel_path
                finally:
                    sftp.close()
        except Exception as e:
            with failed_lock:
                failed_uploads.append((rel_path, str(e)))
            return False, f"{rel_path}: {e}"

    # Create remote directory first
    with instance.ssh() as ssh:
        sftp = ssh._client.open_sftp()
        try:
            sftp.mkdir(remote_dir)
        except OSError:
            pass  # Directory might already exist
        finally:
            sftp.close()

    # Upload files in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all upload tasks
        futures = {
            executor.submit(upload_single_file, local_path): local_path
            for local_path in files_to_upload
        }

        # Process completed uploads
        for future in as_completed(futures):
            success, result = future.result()
            if not success:
                tqdm.write(f"Failed to upload: {result}")

    if pbar:
        pbar.close()

    # Report results
    successful_uploads = len(files_to_upload) - len(failed_uploads)
    print(f"\nSuccessfully uploaded {successful_uploads} files")

    if failed_uploads:
        print(f"Failed to upload {len(failed_uploads)} files:")
        for rel_path, error in failed_uploads[:5]:  # Show first 5 failures
            print(f"  - {rel_path}: {error}")
        if len(failed_uploads) > 5:
            print(f"  ... and {len(failed_uploads) - 5} more")


def upload_file(instance, local_path, remote_path):
    """Upload a single file via SFTP"""
    with instance.ssh() as ssh:
        sftp = ssh._client.open_sftp()

        try:
            # Create remote directory if needed
            remote_dir = os.path.dirname(remote_path)
            if remote_dir:
                try:
                    sftp.stat(remote_dir)
                except FileNotFoundError:
                    sftp.mkdir(remote_dir)

            # Upload file
            print(f"Uploading {local_path} to {remote_path}")
            sftp.put(local_path, remote_path)

            # Preserve executable permissions
            if os.access(local_path, os.X_OK):
                sftp.chmod(remote_path, 0o755)

        finally:
            sftp.close()


def setup_base_environment(instance):
    """Install base dependencies"""
    print("\n--- Installing base dependencies ---")

    run_ssh_command(
        instance,
        "DEBIAN_FRONTEND=noninteractive apt-get update && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
        "ca-certificates curl wget git python3 make g++ bash nano net-tools "
        "sudo supervisor openssl pigz xz-utils unzip chromium chromium-driver && "
        "rm -rf /var/lib/apt/lists/*",
        sudo=True,
    )


def setup_docker_environment(instance):
    """Set up Docker with BuildKit"""
    print("\n--- Setting up Docker environment ---")

    # Install Docker and essentials
    run_ssh_command(
        instance,
        "DEBIAN_FRONTEND=noninteractive apt-get update && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y "
        "docker.io python3-docker git curl",
        sudo=True,
    )

    # Enable BuildKit for faster builds
    run_ssh_command(
        instance,
        "mkdir -p /etc/docker && "
        'echo \'{"features":{"buildkit":true}}\' > /etc/docker/daemon.json && '
        "echo 'DOCKER_BUILDKIT=1' >> /etc/environment",
        sudo=True,
    )

    # Restart Docker and make sure it's running
    run_ssh_command(instance, "systemctl restart docker", sudo=True)

    # Wait for Docker to be fully started
    print("Waiting for Docker to be ready...")
    for i in range(5):
        result = run_ssh_command(
            instance,
            "docker info >/dev/null 2>&1 || echo 'not ready'",
            sudo=True,
            print_output=False,
        )
        if result.exit_code == 0 and "not ready" not in result.stdout:
            print("Docker is ready")
            break
        print(f"Waiting for Docker... ({i + 1}/5)")
        time.sleep(3)


def setup_nodejs(instance):
    """Install Node.js 22.x"""
    print("\n--- Installing Node.js 22.x ---")

    run_ssh_command(
        instance,
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && "
        "apt-get install -y nodejs && "
        "rm -rf /var/lib/apt/lists/*",
        sudo=True,
    )

    # Verify installation
    result = run_ssh_command(instance, "node --version", print_output=True)
    print(f"Node.js installed: {result.stdout.strip()}")


def setup_bun(instance):
    """Install Bun"""
    print("\n--- Installing Bun ---")

    run_ssh_command(instance, "curl -fsSL https://bun.sh/install | bash")

    # Add Bun to PATH for current session
    run_ssh_command(instance, 'echo "export PATH=/root/.bun/bin:$PATH" >> ~/.bashrc')

    # Verify installation
    result = run_ssh_command(
        instance, "/root/.bun/bin/bun --version", print_output=True
    )
    print(f"Bun installed: {result.stdout.strip()}")


def install_global_packages(instance):
    """Install global packages with Bun"""
    print("\n--- Installing global packages ---")

    packages = [
        "@openai/codex",
        "@anthropic-ai/claude-code",
        "@google/gemini-cli",
        "opencode-ai",
        "codebuff",
        "@devcontainers/cli",
    ]

    run_ssh_command(
        instance, f"/root/.bun/bin/bun add -g {' '.join(packages)}", print_output=True
    )


def setup_openvscode_server(instance):
    """Install OpenVSCode server"""
    print("\n--- Installing OpenVSCode server ---")

    # Get latest release version
    result = run_ssh_command(
        instance,
        'curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" | '
        "grep \"tag_name\" | awk -F'\"' '{print $4}' | sed 's|^openvscode-server-v||'",
        print_output=False,
    )

    code_release = result.stdout.strip()
    print(f"Latest OpenVSCode server version: {code_release}")

    # Detect architecture
    result = run_ssh_command(instance, "dpkg --print-architecture", print_output=False)
    arch = result.stdout.strip()

    if arch == "amd64":
        arch_name = "x64"
    elif arch == "arm64":
        arch_name = "arm64"
    else:
        print(f"Unsupported architecture: {arch}")
        return

    # Download and extract OpenVSCode server
    run_ssh_command(
        instance,
        f"mkdir -p /app/openvscode-server && "
        f"curl -L -o /tmp/openvscode-server.tar.gz "
        f'"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v{code_release}/'
        f'openvscode-server-v{code_release}-linux-{arch_name}.tar.gz" && '
        f"tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server/ --strip-components=1 && "
        f"rm -rf /tmp/openvscode-server.tar.gz",
        sudo=True,
    )

    print("OpenVSCode server installed successfully")


def setup_workspace(instance, workspace_path):
    """Upload workspace files and build the application"""
    print("\n--- Setting up workspace ---")

    # Create workspace directory
    run_ssh_command(instance, f"mkdir -p {workspace_path}", sudo=True)

    # Get the project root (4 levels up from this script)
    script_dir = Path(__file__).resolve()
    project_root = script_dir.parent.parent.parent.parent

    print(f"Uploading project files from {project_root}...")

    # Upload the entire project respecting .gitignore and .dockerignore
    upload_directory_sftp(instance, str(project_root), workspace_path)

    print("Project files uploaded successfully")

    # Install npm dependencies with cache mount
    print("\n--- Installing npm dependencies ---")
    run_ssh_command(instance, f"sh -c 'cd {workspace_path} && npm install'", sudo=True)

    # Pre-install node-pty in /builtins location (matching Dockerfile)
    print("\n--- Setting up /builtins ---")
    run_ssh_command(
        instance,
        f"mkdir -p /builtins && "
        f"cp {workspace_path}/apps/worker/package.json /builtins/package.json",
        sudo=True,
    )

    # Install node-pty in /builtins
    run_ssh_command(instance, "sh -c 'cd /builtins && npm install node-pty'", sudo=True)

    # Build the worker
    print("\n--- Building worker application ---")
    run_ssh_command(
        instance,
        f"sh -c 'cd {workspace_path} && "
        f"/root/.bun/bin/bun build {workspace_path}/apps/worker/src/index.ts "
        f"--target node --outdir {workspace_path}/apps/worker/build --external node-pty'",
        sudo=True,
    )

    # Copy build output to /builtins
    run_ssh_command(
        instance, f"cp -r {workspace_path}/apps/worker/build /builtins/build", sudo=True
    )

    # Copy wait-for-docker.sh to /usr/local/bin
    run_ssh_command(
        instance,
        f"cp {workspace_path}/apps/worker/wait-for-docker.sh /usr/local/bin/ && "
        f"chmod +x /usr/local/bin/wait-for-docker.sh",
        sudo=True,
    )


def build_vscode_extension(instance, workspace_path):
    """Build the VS Code extension"""
    print("\n--- Building VS Code extension ---")

    # Change to the vscode extension directory first
    run_ssh_command(
        instance,
        f"sh -c 'cd {workspace_path}/packages/vscode-extension && "
        f"/root/.bun/bin/bun install && "  # Install dependencies first
        f"/root/.bun/bin/bun run package'",
        sudo=True,
    )

    # Copy to temp location
    run_ssh_command(
        instance,
        f"cp {workspace_path}/packages/vscode-extension/coderouter-extension-0.0.1.vsix "
        f"/tmp/coderouter-extension-0.0.1.vsix",
        sudo=True,
    )


def install_vscode_extensions(instance):
    """Install VS Code extensions"""
    print("\n--- Installing VS Code extensions ---")

    # extensions = ["/tmp/coderouter-extension-0.0.1.vsix", "vscode.git", "vscode.github"]
    extensions = ["/tmp/coderouter-extension-0.0.1.vsix"]

    for ext in extensions:
        run_ssh_command(
            instance,
            f"/app/openvscode-server/bin/openvscode-server --install-extension {ext}",
            sudo=True,
        )

    # Clean up
    run_ssh_command(instance, "rm -f /tmp/coderouter-extension-0.0.1.vsix", sudo=True)


def setup_vscode_settings(instance):
    """Create VS Code user settings"""
    print("\n--- Setting up VS Code settings ---")

    settings = '{"workbench.startupEditor": "none"}'

    dirs = [
        "/root/.openvscode-server/data/User",
        "/root/.openvscode-server/data/User/profiles/default-profile",
        "/root/.openvscode-server/data/Machine",
    ]

    for dir_path in dirs:
        run_ssh_command(instance, f"mkdir -p {dir_path}", sudo=True)
        run_ssh_command(
            instance,
            f"sh -c 'echo \\'{settings}\\' > {dir_path}/settings.json'",
            sudo=True,
        )


def warmup_vscode(instance):
    """Warm up VS Code with headless Chrome"""
    print("\n--- Warming up VS Code with headless Chrome ---")

    # Fixed version: combine all commands into a single line
    warmup_command = (
        "chromium --headless --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-setuid-sandbox "
        "http://localhost:2376/?folder=/root/workspace & "
        "CHROME_PID=$! && "
        'echo "Chrome started with PID $CHROME_PID, waiting 10 seconds for VS Code to warm up..." && '
        "sleep 10 && "
        "kill $CHROME_PID 2>/dev/null || true && "
        'echo "VS Code warm-up complete!"'
    )

    run_ssh_command(instance, warmup_command, sudo=True)


def create_startup_script(instance):
    """Create startup script for the application"""
    print("\n--- Creating startup script ---")

    startup_script = """#!/bin/bash
set -e

# Create log directory
mkdir -p /var/log/openvscode

# Log environment variables for debugging
echo "[Startup] Environment variables:" > /var/log/openvscode/startup.log
env >> /var/log/openvscode/startup.log

# Start OpenVSCode server on port 2376 without authentication
echo "[Startup] Starting OpenVSCode server..." >> /var/log/openvscode/startup.log
/app/openvscode-server/bin/openvscode-server \\
  --host 0.0.0.0 \\
  --port 2376 \\
  --without-connection-token \\
  --disable-workspace-trust \\
  --disable-telemetry \\
  --disable-updates \\
  --profile default-profile \\
  --verbose \\
  /root/workspace \\
  > /var/log/openvscode/server.log 2>&1 &

echo "[Startup] OpenVSCode server started, logs available at /var/log/openvscode/server.log" >> /var/log/openvscode/startup.log

# Start the worker
export NODE_ENV=production
export WORKER_PORT=3002
export MANAGEMENT_PORT=3003

exec node /builtins/build/index.js
"""

    run_ssh_command(
        instance, f"cat > /startup.sh << 'EOF'\n{startup_script}\nEOF", sudo=True
    )

    run_ssh_command(instance, "chmod +x /startup.sh", sudo=True)


def main():
    client = MorphCloudClient()

    # VM configuration
    VCPUS = 4
    MEMORY = 8192
    DISK_SIZE = 20480

    print("Creating snapshot...")
    snapshot = client.snapshots.create(
        vcpus=VCPUS,
        memory=MEMORY,
        disk_size=DISK_SIZE,
    )

    print(f"Starting instance from snapshot {snapshot.id}...")
    instance = client.instances.start(snapshot.id)

    try:
        # Install base dependencies
        setup_base_environment(instance)

        # Setup Docker environment
        setup_docker_environment(instance)

        # Install Node.js
        setup_nodejs(instance)

        # Install Bun
        setup_bun(instance)

        # Install global packages
        install_global_packages(instance)

        # Install OpenVSCode server
        setup_openvscode_server(instance)

        # Setup workspace
        workspace_path = "/coderouter"
        setup_workspace(instance, workspace_path)

        # Build VS Code extension
        build_vscode_extension(instance, workspace_path)

        # Install VS Code extensions
        install_vscode_extensions(instance)

        # Setup VS Code settings
        setup_vscode_settings(instance)

        # Create startup script
        create_startup_script(instance)

        # Create workspace directory for OpenVSCode
        run_ssh_command(instance, "mkdir -p /root/workspace", sudo=True)

        # Expose HTTP services
        instance.expose_http_service("openvscode", 2376)
        instance.expose_http_service("worker", 3002)
        instance.expose_http_service("management", 3003)

        print("\n--- Starting services ---")
        # Run the startup script in the background
        run_ssh_command(
            instance, "nohup /startup.sh > /var/log/startup.log 2>&1 &", sudo=True
        )

        # Wait a bit for services to start
        print("Waiting for services to start...")
        time.sleep(10)

        # Check if services are running
        print("\n--- Checking services ---")

        # Check OpenVSCode server
        result = run_ssh_command(
            instance,
            "ps aux | grep openvscode-server | grep -v grep",
            sudo=True,
            print_output=False,
        )
        if result.stdout:
            print("✅ OpenVSCode server is running")
        else:
            print("❌ OpenVSCode server is not running")
            # Show logs
            run_ssh_command(
                instance, "cat /var/log/openvscode/server.log | tail -20", sudo=True
            )

        # Check worker
        result = run_ssh_command(
            instance,
            "ps aux | grep 'node /builtins/build/index.js' | grep -v grep",
            sudo=True,
            print_output=False,
        )
        if result.stdout:
            print("✅ Worker is running")
        else:
            print("❌ Worker is not running")
            # Show startup logs
            run_ssh_command(instance, "cat /var/log/startup.log | tail -20", sudo=True)

        # Warm up VS Code
        warmup_vscode(instance)

        print("\n✅ Setup complete!")
        print(f"Instance ID: {instance.id}")

        # Get service URLs
        instance = client.instances.get(instance.id)  # Refresh instance info
        print("\nService URLs:")
        for service in instance.networking.http_services:
            if service.name == "openvscode":
                print(f"- OpenVSCode: {service.url}/?folder=/root/workspace")
                continue
            print(f"- {service.name}: {service.url}")

        print("\nUseful commands:")
        print(f"- SSH to instance: morphcloud instance ssh {instance.id}")
        print(
            f"- View OpenVSCode logs: morphcloud instance ssh {instance.id} -- sudo cat /var/log/openvscode/server.log"
        )
        print(
            f"- View startup logs: morphcloud instance ssh {instance.id} -- sudo cat /var/log/startup.log"
        )
        print(
            f"- Restart services: morphcloud instance ssh {instance.id} -- sudo /startup.sh"
        )

        # let the user interact with the instance and wait for them to press enter
        input("Press Enter to continue to final snapshot...")

        # Create final snapshot
        print("\nCreating final snapshot...")
        final_snapshot = instance.snapshot()
        print(f"Final snapshot created: {final_snapshot.id}")
        print(
            f"Start new instances with: morphcloud instance start {final_snapshot.id}"
        )

    except Exception as e:
        print(f"\nError: {e}")
        print(f"\nFor troubleshooting: morphcloud instance ssh {instance.id}")
        raise


if __name__ == "__main__":
    main()

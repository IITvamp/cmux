import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

import dotenv
from morphcloud.api import MorphCloudClient, Snapshot

dotenv.load_dotenv()

client = MorphCloudClient()


def ensure_docker(snapshot: Snapshot) -> Snapshot:
    """Install Docker, docker compose, and enable BuildKit."""
    snapshot = snapshot.setup(
        "DEBIAN_FRONTEND=noninteractive apt-get update && "
        "DEBIAN_FRONTEND=noninteractive apt-get install -y "
        "docker.io docker-compose python3-docker git curl unzip && "
        "rm -rf /var/lib/apt/lists/*"
    )
    snapshot = snapshot.exec(
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
    # Ensure IPv6 localhost resolution
    snapshot = snapshot.exec("echo '::1       localhost' >> /etc/hosts")
    return snapshot


vcpus = 8
memory = 16384
disk_size = 32768
digest_prefix = "cmux"

snapshot = client.snapshots.create(
    vcpus=vcpus,
    memory=memory,
    disk_size=disk_size,
)
snapshot = ensure_docker(snapshot)

# Zip the repository (respecting .gitignore and .dockerignore) and upload it


def _zip_repo_with_ignores(repo_root: Path, out_zip: Path) -> None:
    """Invoke the zipping helper using uv if available, else python."""
    repo_root = repo_root.resolve()
    out_zip = out_zip.resolve()
    # Prefer uv run (installs pathspec), fallback to python
    try:
        subprocess.run(
            [
                "uv",
                "run",
                str(Path.cwd().joinpath("scripts/zip_dir_respecting_ignores.py")),
                "-d",
                str(repo_root),
                "-o",
                str(out_zip),
                "--include",
                "Dockerfile.sh",
            ],
            check=True,
        )
    except Exception:
        subprocess.run(
            [
                sys.executable,
                str(Path.cwd().joinpath("scripts/zip_dir_respecting_ignores.py")),
                "-d",
                str(repo_root),
                "-o",
                str(out_zip),
                "--include",
                "Dockerfile.sh",
            ],
            check=True,
        )


# Determine repo root (two levels up from this script: apps/client/scripts -> repo root)
THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parents[2]
local_zip = Path(tempfile.gettempdir()) / "cmux_workspace.zip"
_zip_repo_with_ignores(REPO_ROOT, local_zip)

# Upload to the snapshot and extract into /workspace
remote_zip = "/root/cmux_workspace.zip"
snapshot = snapshot.upload(str(local_zip), remote_zip, recursive=False)
snapshot = snapshot.exec(
    "mkdir -p /workspace && unzip -q -o /root/cmux_workspace.zip -d /workspace"
)

snapshot = snapshot.exec("chmod +x /workspace/Dockerfile.sh || true")
snapshot = snapshot.exec(
    "sh -lc "
    + shlex.quote(
        "cd /workspace && EXECUTE=1 ALLOW_DANGEROUS=1 ./Dockerfile.sh",
    )
)

print(snapshot.id)

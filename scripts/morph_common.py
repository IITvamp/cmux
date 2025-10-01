from __future__ import annotations

import base64
import shlex
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - typing helpers only
    from morphcloud.api import Snapshot

MORPH_EXPECTED_UNAME_ARCH = "x86_64"
DOCKER_COMPOSE_VERSION = "v2.32.2"
DOCKER_BUILDX_VERSION = "v0.18.0"


def _run_remote(snapshot: "Snapshot", command: str) -> "Snapshot":
    """Execute a command on the snapshot and return the resulting snapshot."""
    return snapshot.exec(command)


def write_remote_file(
    snapshot: "Snapshot",
    *,
    remote_path: str,
    content: str,
    executable: bool = False,
) -> "Snapshot":
    """Write text content to `remote_path` on the snapshot, optionally chmod +x."""
    payload = base64.b64encode(content.encode("utf-8")).decode("ascii")
    snapshot = _run_remote(
        snapshot,
        f"printf %s {shlex.quote(payload)} | base64 -d > {shlex.quote(remote_path)}",
    )
    if executable:
        snapshot = _run_remote(snapshot, f"chmod +x {shlex.quote(remote_path)}")
    return snapshot


def write_remote_file_from_path(
    snapshot: "Snapshot",
    *,
    remote_path: str,
    local_path: Path,
    executable: bool = False,
) -> "Snapshot":
    """Read a local file and upload its contents to the snapshot."""
    text = local_path.read_text(encoding="utf-8")
    return write_remote_file(
        snapshot,
        remote_path=remote_path,
        content=text,
        executable=executable,
    )


def ensure_docker_cli_plugins(
    *,
    compose_version: str = DOCKER_COMPOSE_VERSION,
    buildx_version: str = DOCKER_BUILDX_VERSION,
    expected_arch: str = MORPH_EXPECTED_UNAME_ARCH,
) -> str:
    """Return command string to install docker CLI plugins and validate arch."""
    compose_download = " ".join(
        [
            "curl",
            "-fsSL",
            f"https://github.com/docker/compose/releases/download/{compose_version}/docker-compose-linux-{expected_arch}",
            "-o",
            "/usr/local/lib/docker/cli-plugins/docker-compose",
        ]
    )
    buildx_download = " ".join(
        [
            "curl",
            "-fsSL",
            f"https://github.com/docker/buildx/releases/download/{buildx_version}/buildx-{buildx_version}.linux-amd64",
            "-o",
            "/usr/local/lib/docker/cli-plugins/docker-buildx",
        ]
    )

    docker_plugin_cmds = [
        "mkdir -p /usr/local/lib/docker/cli-plugins",
        "arch=$(uname -m)",
        f'echo "Architecture detected: $arch"',
        compose_download,
        "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
        buildx_download,
        "chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx",
        "docker compose version",
        "docker buildx version",
    ]
    return " && ".join(docker_plugin_cmds)


def ensure_docker() -> str:
    """Return command string to install Docker engine and enable BuildKit."""
    daemon_config = '{"features":{"buildkit":true}}'
    docker_ready_loop = "\n".join(
        [
            "for i in {1..30}; do",
            "  if docker info >/dev/null 2>&1; then",
            "    echo 'Docker ready'; break;",
            "  else",
            "    echo 'Waiting for Docker...';",
            "    [ $i -eq 30 ] && { echo 'Docker failed to start after 30 attempts'; exit 1; };",
            "    sleep 2;",
            "  fi;",
            "done",
        ]
    )

    commands = [
        "DEBIAN_FRONTEND=noninteractive apt-get update",
        "DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose python3-docker git curl",
        "rm -rf /var/lib/apt/lists/*",
        "mkdir -p /etc/docker",
        f"echo {shlex.quote(daemon_config)} > /etc/docker/daemon.json",
        "echo 'DOCKER_BUILDKIT=1' >> /etc/environment",
        "systemctl restart docker",
        docker_ready_loop,
        "docker --version && docker-compose --version",
        "(docker compose version 2>/dev/null || echo 'docker compose plugin not available')",
        "echo 'Docker commands verified'",
        "echo '::1       localhost' >> /etc/hosts",
    ]
    return " && ".join(commands)

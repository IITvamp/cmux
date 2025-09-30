#!/usr/bin/env python3
"""
Build a Morph snapshot by flattening a Docker image and running it in a chroot.
This approach avoids installing Docker in the VM entirely.

The script:
1. Builds or pulls a Docker image locally
2. Inspects its runtime config (ENTRYPOINT, CMD, ENV, etc.)
3. Flattens the image to a tarball via `docker export`
4. Creates a Morph snapshot and uploads the tarball
5. Extracts it to /opt/app/rootfs
6. Installs chroot runner scripts
7. Creates a systemd service that runs the image's command in the chroot
"""

from __future__ import annotations

import argparse
import atexit
import base64
import json
import os
import shlex
import signal
import subprocess
import sys
import tempfile
import time
import typing as t
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

import dotenv
from morphcloud.api import MorphCloudClient, Snapshot

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


class DockerImageConfig(t.TypedDict):
    entrypoint: list[str]
    cmd: list[str]
    env: list[str]
    workdir: str
    user: str


def build_or_pull_image(dockerfile_path: str | None, image_name: str | None) -> str:
    """Build from Dockerfile or pull the image, return the image tag/name."""
    if dockerfile_path:
        tag = f"cmux-morph-temp:{os.getpid()}"
        print(f"Building Docker image from {dockerfile_path}...")
        dockerfile_dir = os.path.dirname(os.path.abspath(dockerfile_path)) or "."
        subprocess.run(
            ["docker", "build", "-t", tag, "-f", dockerfile_path, dockerfile_dir],
            check=True,
        )
        print(f"Built image: {tag}")
        return tag
    elif image_name:
        print(f"Pulling Docker image: {image_name}")
        subprocess.run(["docker", "pull", image_name], check=True)
        return image_name
    else:
        raise ValueError("Must provide either --dockerfile or --image")


def inspect_image(image: str) -> DockerImageConfig:
    """Extract runtime config from the Docker image."""
    print(f"Inspecting image: {image}")
    result = subprocess.run(
        ["docker", "image", "inspect", image],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    config = data[0]["Config"]
    return {
        "entrypoint": config.get("Entrypoint") or [],
        "cmd": config.get("Cmd") or [],
        "env": config.get("Env") or [],
        "workdir": config.get("WorkingDir") or "/",
        "user": config.get("User") or "root",
    }


def export_image_to_tar(image: str) -> str:
    """Flatten the Docker image to a tarball using docker export.

    Returns the path to the temporary tar file.
    """
    print(f"Flattening image {image} to tarball...")
    fd, tar_path = tempfile.mkstemp(suffix=".tar", prefix="cmux-rootfs-")
    os.close(fd)

    result = subprocess.run(
        ["docker", "create", image],
        capture_output=True,
        text=True,
        check=True,
    )
    cid = result.stdout.strip()
    print(f"Created temporary container: {cid}")

    try:
        with open(tar_path, "wb") as f:
            subprocess.run(
                ["docker", "export", cid],
                stdout=f,
                check=True,
            )
        print(f"Exported rootfs to: {tar_path}")
        return tar_path
    finally:
        subprocess.run(["docker", "rm", cid], capture_output=True, check=True)


def create_chroot_runner_scripts(snapshot: Snapshot) -> Snapshot:
    """Install the chroot runner and umount scripts."""
    print("Installing chroot runner scripts...")

    runner_script = """#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/app/rootfs}"

for d in proc sys dev dev/pts; do
  mkdir -p "$ROOT/$d"
done

mountpoint -q "$ROOT/proc"    || mount -t proc proc "$ROOT/proc"
mountpoint -q "$ROOT/sys"     || mount -t sysfs sysfs "$ROOT/sys"
mountpoint -q "$ROOT/dev"     || mount --bind /dev "$ROOT/dev"
mountpoint -q "$ROOT/dev/pts" || mount --bind /dev/pts "$ROOT/dev/pts"

if [ ! -e "$ROOT/etc/resolv.conf" ] && [ -e /etc/resolv.conf ]; then
  mkdir -p "$ROOT/etc"
  cp -L /etc/resolv.conf "$ROOT/etc/resolv.conf"
fi

ENV_FILE="${ENV_FILE:-/opt/app/app.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

USERSPEC="${USERSPEC:-}"
WORKDIR="${WORKDIR:-/}"

cd_target="$ROOT$WORKDIR"
if [ ! -d "$cd_target" ]; then
  mkdir -p "$cd_target"
fi

if [ -n "$USERSPEC" ]; then
  exec chroot --userspec="$USERSPEC" "$ROOT" sh -c "cd ${WORKDIR@Q} && exec \\"$@\\""
else
  exec chroot "$ROOT" sh -c "cd ${WORKDIR@Q} && exec \\"$@\\""
fi
"""

    umount_script = """#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-/opt/app/rootfs}"
for m in dev/pts dev sys proc; do
  if mountpoint -q "$ROOT/$m"; then
    umount -l "$ROOT/$m" || true
  fi
done
"""

    runner_b64 = base64.b64encode(runner_script.encode("utf-8")).decode("ascii")
    umount_b64 = base64.b64encode(umount_script.encode("utf-8")).decode("ascii")

    snapshot = snapshot.exec(
        f"printf %s {shlex.quote(runner_b64)} | base64 -d > /usr/local/bin/app-chroot-runner && "
        f"chmod +x /usr/local/bin/app-chroot-runner"
    )
    snapshot = snapshot.exec(
        f"printf %s {shlex.quote(umount_b64)} | base64 -d > /usr/local/bin/app-chroot-umount && "
        f"chmod +x /usr/local/bin/app-chroot-umount"
    )

    return snapshot


def create_systemd_service(snapshot: Snapshot, config: DockerImageConfig) -> Snapshot:
    """Create and enable the systemd service that runs the app in chroot."""
    print("Creating systemd service...")

    cmd_parts = config["entrypoint"] + config["cmd"]
    if not cmd_parts:
        cmd_parts = ["/bin/sh"]

    exec_start_args = " ".join(shlex.quote(p) for p in cmd_parts)
    exec_start = f"/usr/local/bin/app-chroot-runner {exec_start_args}"

    user_spec = ""
    if config["user"] and config["user"] != "root":
        if ":" in config["user"]:
            user_spec = config["user"]
        else:
            user_spec = config["user"]

    env_userspec_line = f"Environment=USERSPEC={user_spec}" if user_spec else ""
    env_workdir_line = f"Environment=WORKDIR={config['workdir']}"

    service_content = f"""[Unit]
Description=Cmux App (chroot)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/opt/app/app.env
{env_userspec_line}
{env_workdir_line}
ExecStart={exec_start}
ExecStopPost=/usr/local/bin/app-chroot-umount
WorkingDirectory=/
Restart=no
StandardOutput=append:/var/log/cmux/cmux.service.log
StandardError=append:/var/log/cmux/cmux.service.log

[Install]
WantedBy=multi-user.target
"""

    service_b64 = base64.b64encode(service_content.encode("utf-8")).decode("ascii")
    snapshot = snapshot.exec(
        f"mkdir -p /var/log/cmux && "
        f"printf %s {shlex.quote(service_b64)} | base64 -d > /etc/systemd/system/cmux.service && "
        f"systemctl daemon-reload && "
        f"systemctl enable cmux.service"
    )

    if user_spec and ":" not in user_spec:
        snapshot = snapshot.exec(
            f"sh -lc 'id -u {shlex.quote(user_spec)} >/dev/null 2>&1 || useradd -m {shlex.quote(user_spec)}'"
        )

    return snapshot


def build_snapshot(
    dockerfile_path: str | None,
    image_name: str | None,
) -> Snapshot:
    """Build a Morph snapshot from a Docker image using chroot approach."""
    image = build_or_pull_image(dockerfile_path, image_name)
    config = inspect_image(image)
    print(f"Image config: entrypoint={config['entrypoint']}, cmd={config['cmd']}, workdir={config['workdir']}, user={config['user']}")

    rootfs_tar = export_image_to_tar(image)

    try:
        print("Creating Morph snapshot...")
        snapshot = client.snapshots.create(
            vcpus=8,
            memory=16384,
            disk_size=32768,
        )

        print("Installing base utilities...")
        snapshot = snapshot.setup(
            "DEBIAN_FRONTEND=noninteractive apt-get update && "
            "DEBIAN_FRONTEND=noninteractive apt-get install -y "
            "curl procps util-linux coreutils && "
            "rm -rf /var/lib/apt/lists/*"
        )

        snapshot = snapshot.exec("mkdir -p /opt/app/rootfs")

        print("Uploading rootfs tarball...")
        snapshot = snapshot.upload(rootfs_tar, "/tmp/rootfs.tar", recursive=False)

        print("Extracting rootfs...")
        snapshot = snapshot.exec(
            "tar -xf /tmp/rootfs.tar -C /opt/app/rootfs && rm /tmp/rootfs.tar"
        )

        print("Writing environment file...")
        env_content = "\n".join(config["env"])
        if env_content:
            env_b64 = base64.b64encode(env_content.encode("utf-8")).decode("ascii")
            snapshot = snapshot.exec(
                f"printf %s {shlex.quote(env_b64)} | base64 -d > /opt/app/app.env"
            )
        else:
            snapshot = snapshot.exec("touch /opt/app/app.env")

        snapshot = create_chroot_runner_scripts(snapshot)
        snapshot = create_systemd_service(snapshot, config)

        return snapshot
    finally:
        if os.path.exists(rootfs_tar):
            os.unlink(rootfs_tar)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build Morph snapshot from Docker image (chroot approach)"
    )
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--dockerfile", help="Path to Dockerfile to build")
    group.add_argument("--image", help="Docker image name to use")
    ap.add_argument(
        "--resnapshot",
        action="store_true",
        help="After starting the instance, wait for Enter and snapshot again",
    )
    args = ap.parse_args()

    try:
        snapshot = build_snapshot(args.dockerfile, args.image)
        print(f"Snapshot ID: {snapshot.id}")

        print("Starting instance...")
        instance = client.instances.start(
            snapshot_id=snapshot.id,
            ttl_seconds=3600,
            ttl_action="pause",
        )
        global current_instance
        current_instance = instance

        print(f"Instance ID: {instance.id}")

        expose_ports = [39376, 39377, 39378]
        for port in expose_ports:
            instance.expose_http_service(port=port, name=f"port-{port}")
        instance.wait_until_ready()
        print(instance.networking.http_services)

        try:
            print("\n--- Instance diagnostics ---")
            start_res = instance.exec("systemctl start cmux.service || true")
            if getattr(start_res, "stdout", None):
                print(start_res.stdout)
            if getattr(start_res, "stderr", None):
                sys.stderr.write(str(start_res.stderr))

            diag_cmds = [
                "systemctl is-enabled cmux.service || true",
                "systemctl is-active cmux.service || true",
                "systemctl status cmux.service --no-pager -l | tail -n 80 || true",
                "ps aux | grep -E 'openvscode-server|node /builtins/build/index.js' | grep -v grep || true",
                "ss -lntp | grep ':39378' || true",
                "tail -n 80 /var/log/cmux/cmux.service.log || true",
            ]
            for cmd in diag_cmds:
                print(f"\n$ {cmd}")
                res = instance.exec(cmd)
                if getattr(res, "stdout", None):
                    print(res.stdout)
                if getattr(res, "stderr", None):
                    sys.stderr.write(str(res.stderr))
        except Exception as e:
            print(f"Diagnostics failed: {e}")

        try:
            services = getattr(instance.networking, "http_services", [])

            def _get(obj: object, key: str) -> t.Any:
                if isinstance(obj, dict):
                    return obj.get(key)
                return getattr(obj, key, None)

            vscode_service = None
            for svc in services or []:
                port = _get(svc, "port")
                name = _get(svc, "name")
                if port == 39378 or name == "port-39378":
                    vscode_service = svc
                    break

            url = _get(vscode_service, "url") if vscode_service is not None else None
            if not url:
                print("No exposed HTTP service found for port 39378")
            else:
                ok = False
                for _ in range(30):
                    try:
                        with urllib_request.urlopen(url, timeout=5) as resp:
                            code = getattr(resp, "status", getattr(resp, "code", None))
                            if code == 200:
                                print(f"Port 39378 check: HTTP {code}")
                                ok = True
                                break
                            else:
                                print(
                                    f"Port 39378 not ready yet, HTTP {code}; retrying..."
                                )
                    except (HTTPError, URLError) as e:
                        print(f"Port 39378 not ready yet ({e}); retrying...")
                    time.sleep(2)
                if not ok:
                    print("Port 39378 did not return HTTP 200 within timeout")

                print(f"VSCode URL: {url}/?folder=/root/workspace")
        except Exception as e:
            print(f"Error checking port 39378: {e}")

        if args.resnapshot:
            input("Press Enter to snapshot again...")
            print("Snapshotting...")
            final_snapshot = instance.snapshot()
            print(f"Snapshot ID: {final_snapshot.id}")
    finally:
        _cleanup_instance()


if __name__ == "__main__":
    main()
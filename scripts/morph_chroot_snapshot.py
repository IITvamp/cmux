#!/usr/bin/env python3
"""
Build a Morph snapshot by flattening a Docker image and wiring it into the host via overlayfs.
This approach avoids installing Docker in the VM entirely.

The script:
1. Builds or pulls a Docker image locally
2. Inspects its runtime config (ENTRYPOINT, CMD, ENV, etc.)
3. Flattens the image to a tarball via `docker export`
4. Creates a Morph snapshot and uploads the tarball
5. Extracts it to /opt/app/rootfs
6. Prepares overlay workspace directories for runtime mounting
7. Writes runtime environment configuration
8. Installs and enables the cmux systemd units that ship with the image
"""

from __future__ import annotations

import argparse
import atexit
import json
import os
import socket
import shlex
import signal
import subprocess
import sys
import tempfile
import time
import typing as t
from contextlib import contextmanager
from pathlib import Path
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

import dotenv
from morphcloud.api import Instance, MorphCloudClient, Snapshot
from morph_common import ensure_docker, ensure_docker_cli_plugins, write_remote_file

dotenv.load_dotenv()

client = MorphCloudClient()

current_instance: Instance | None = None


T = t.TypeVar("T")


class Console:
    def __init__(self) -> None:
        self.quiet = False

    def info(self, *args: t.Any, **kwargs: t.Any) -> None:
        if not self.quiet:
            print(*args, **kwargs)

    def always(self, *args: t.Any, **kwargs: t.Any) -> None:
        print(*args, **kwargs)

    def info_stderr(self, value: str) -> None:
        if not self.quiet:
            sys.stderr.write(value)


console = Console()


class TimingsCollector:
    def __init__(self) -> None:
        self._sections: list[tuple[str, float]] = []

    @contextmanager
    def section(self, label: str) -> t.Iterator[None]:
        start = time.perf_counter()
        try:
            yield
        finally:
            duration = time.perf_counter() - start
            self._sections.append((label, duration))

    def time(self, label: str, func: t.Callable[[], T]) -> T:
        with self.section(label):
            return func()

    def summary_lines(self) -> list[str]:
        if not self._sections:
            return []

        lines = [f"{label}: {duration:.2f}s" for label, duration in self._sections]

        lines.append("")
        lines.append("Aggregates:")

        totals: dict[str, float] = {}
        for label, duration in self._sections:
            prefix = label.split(":", 1)[0]
            totals[prefix] = totals.get(prefix, 0.0) + duration

        for prefix, duration in totals.items():
            lines.append(f"{prefix}: {duration:.2f}s")

        total_duration = sum(duration for _, duration in self._sections)
        lines.append(f"total: {total_duration:.2f}s")

        return lines


def print_timing_summary(timings: TimingsCollector) -> None:
    lines = timings.summary_lines()
    if not lines:
        return

    console.info("\n--- Timing Summary ---")
    for line in lines:
        console.info(line)


def _cleanup_instance() -> None:
    global current_instance
    inst = current_instance
    if not inst:
        return
    try:
        console.info(f"Stopping instance {getattr(inst, 'id', '<unknown>')}...")
        inst.stop()
        console.info("Instance stopped")
    except Exception as e:
        console.always(f"Failed to stop instance: {e}")
    finally:
        current_instance = None


def _signal_handler(signum, _frame) -> None:
    console.info(f"Received signal {signum}; cleaning up...")
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


def build_or_pull_image(
    dockerfile_path: str | None,
    image_name: str | None,
    *,
    platform: str,
    target: str | None,
) -> str:
    """Build from Dockerfile or pull the image, return the image tag/name."""
    if dockerfile_path:
        tag = f"cmux-morph-temp:{os.getpid()}"
        stage_note = f" (target: {target})" if target else ""
        console.info(
            f"Building Docker image from {dockerfile_path} (platform: {platform}){stage_note}..."
        )
        dockerfile_dir = os.path.dirname(os.path.abspath(dockerfile_path)) or "."
        cmd = [
            "docker",
            "buildx",
            "build",
            "--platform",
            platform,
            "-t",
            tag,
            "-f",
            dockerfile_path,
            "--load",
            dockerfile_dir,
        ]
        if target:
            cmd.extend(["--target", target])
        subprocess.run(cmd, check=True)
        console.info(f"Built image: {tag}")
        return tag
    elif image_name:
        console.info(f"Pulling Docker image: {image_name} (platform: {platform})")
        if target:
            console.info("--target is ignored when pulling an image tag")
        subprocess.run(
            ["docker", "pull", "--platform", platform, image_name],
            check=True,
        )
        return image_name
    else:
        raise ValueError("Must provide either --dockerfile or --image")


def inspect_image(image: str) -> DockerImageConfig:
    """Extract runtime config from the Docker image."""
    console.info(f"Inspecting image: {image}")
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


def export_image_to_tar(image: str, *, platform: str) -> str:
    """Flatten the Docker image to a tarball using docker export.

    Returns the path to the temporary tar file.
    """
    console.info(f"Flattening image {image} to tarball (platform: {platform})...")
    fd, tar_path = tempfile.mkstemp(suffix=".tar", prefix="cmux-rootfs-")
    os.close(fd)

    result = subprocess.run(
        ["docker", "create", "--platform", platform, image],
        capture_output=True,
        text=True,
        check=True,
    )
    cid = result.stdout.strip()
    console.info(f"Created temporary container: {cid}")

    try:
        with open(tar_path, "wb") as f:
            subprocess.run(
                ["docker", "export", cid],
                stdout=f,
                check=True,
            )
        console.info(f"Exported rootfs to: {tar_path}")
        return tar_path
    finally:
        subprocess.run(["docker", "rm", cid], capture_output=True, check=True)


def enable_cmux_units(snapshot: Snapshot) -> Snapshot:
    """Copy and enable cmux systemd units that ship inside the rootfs."""
    console.info("Enabling cmux systemd units...")

    units = [
        "cmux.target",
        "cmux-openvscode.service",
        "cmux-worker.service",
        "cmux-dockerd.service",
    ]

    for unit in units:
        source = f"/opt/app/rootfs/usr/lib/systemd/system/{unit}"
        dest = f"/etc/systemd/system/{unit}"
        snapshot = snapshot.exec(
            f"if [ -f {shlex.quote(source)} ]; then cp {shlex.quote(source)} {shlex.quote(dest)}; fi"
        )

    snapshot = snapshot.exec("mkdir -p /usr/local/lib/cmux")
    snapshot = snapshot.exec(
        "if [ -d /opt/app/rootfs/usr/local/lib/cmux ]; then cp -a /opt/app/rootfs/usr/local/lib/cmux/. /usr/local/lib/cmux/; fi"
    )
    snapshot = snapshot.exec(
        "chmod +x /usr/local/lib/cmux/cmux-rootfs-exec /usr/local/lib/cmux/configure-openvscode || true"
    )

    snapshot = snapshot.exec("mkdir -p /var/log/cmux")
    snapshot = snapshot.exec("systemctl daemon-reload && systemctl enable cmux.target")

    return snapshot


def build_snapshot(
    dockerfile_path: str | None,
    image_name: str | None,
    platform: str,
    target: str | None,
    timings: TimingsCollector,
) -> Snapshot:
    """Build a Morph snapshot from a Docker image using an overlay-based approach."""
    image = timings.time(
        "build_snapshot:build_or_pull_image",
        lambda: build_or_pull_image(
            dockerfile_path,
            image_name,
            platform=platform,
            target=target,
        ),
    )
    config = timings.time(
        "build_snapshot:inspect_image",
        lambda: inspect_image(image),
    )
    console.info(
        f"Image config: entrypoint={config['entrypoint']}, cmd={config['cmd']}, workdir={config['workdir']}, user={config['user']}"
    )

    rootfs_tar = timings.time(
        "build_snapshot:export_image_to_tar",
        lambda: export_image_to_tar(image, platform=platform),
    )

    try:
        console.info("Creating Morph snapshot...")
        snapshot = timings.time(
            "build_snapshot:create_snapshot",
            lambda: client.snapshots.create(
                vcpus=8, memory=16384, disk_size=32768, digest="cmux:base-docker"
            ),
        )

        console.info("Ensuring Docker tooling...")
        docker_command = " && ".join(
            [
                ensure_docker(),
                ensure_docker_cli_plugins(),
            ]
        )

        console.info("Installing base utilities and preparing rootfs directory...")
        snapshot = timings.time(
            "build_snapshot:prepare_base_system",
            lambda: snapshot.exec(
                f"""
                DEBIAN_FRONTEND=noninteractive apt-get update &&
                DEBIAN_FRONTEND=noninteractive apt-get install -y curl procps util-linux coreutils &&
                rm -rf /var/lib/apt/lists/* &&
                mkdir -p /opt/app/rootfs &&
                {docker_command}
                """
            ),
        )

        console.info("Uploading rootfs tarball...")
        snapshot = timings.time(
            "build_snapshot:upload_rootfs",
            lambda: snapshot.upload(
                rootfs_tar,
                "/opt/app/rootfs.tar",  # keep tar on persistent storage
                recursive=False,
            ),
        )

        console.info("Extracting rootfs...")
        snapshot = timings.time(
            "build_snapshot:extract_rootfs",
            lambda: snapshot.exec(
                "tar -xf /opt/app/rootfs.tar -C /opt/app/rootfs && rm /opt/app/rootfs.tar"
            ),
        )

        console.info("Preparing overlay directories...")
        snapshot = timings.time(
            "build_snapshot:prepare_overlay",
            lambda: snapshot.exec(
                "mkdir -p /opt/app/runtime /opt/app/overlay/upper /opt/app/overlay/work"
            ),
        )

        console.info("Writing environment file...")
        env_lines = list(config.get("env", []))
        env_lines.extend(
            [
                "CMUX_ROOTFS=/opt/app/rootfs",
                "CMUX_RUNTIME_ROOT=/opt/app/runtime",
                "CMUX_OVERLAY_UPPER=/opt/app/overlay/upper",
                "CMUX_OVERLAY_WORK=/opt/app/overlay/work",
            ]
        )
        env_content = "\n".join(env_lines) + "\n"
        snapshot = timings.time(
            "build_snapshot:write_env_file",
            lambda: write_remote_file(
                snapshot,
                remote_path="/opt/app/app.env",
                content=env_content,
            ),
        )

        snapshot = timings.time(
            "build_snapshot:enable_cmux_units",
            lambda: enable_cmux_units(snapshot),
        )

        return snapshot
    finally:
        if os.path.exists(rootfs_tar):
            os.unlink(rootfs_tar)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build Morph snapshot from Docker image (overlay approach)"
    )
    group = ap.add_mutually_exclusive_group()
    group.add_argument(
        "--dockerfile",
        help="Path to Dockerfile to build (default: Dockerfile)",
    )
    group.add_argument("--image", help="Docker image name to use")
    ap.add_argument(
        "--platform",
        default="linux/amd64",
        help="Docker platform to target (default: linux/amd64)",
    )
    ap.add_argument(
        "--target",
        default="morph",
        help="Docker build stage to target when using --dockerfile",
    )
    ap.add_argument(
        "--resnapshot",
        action="store_true",
        help="After starting the instance, wait for Enter and snapshot again",
    )
    ap.add_argument(
        "--exec",
        dest="exec_script",
        help="Bash script to run on the instance before optional resnapshot",
    )
    ap.add_argument(
        "--quiet",
        action="store_true",
        help="Reduce log output for non-interactive use",
    )
    args = ap.parse_args()

    console.quiet = args.quiet

    if args.dockerfile is None and args.image is None:
        args.dockerfile = "Dockerfile"

    timings = TimingsCollector()

    try:
        snapshot = build_snapshot(
            args.dockerfile,
            args.image,
            args.platform,
            args.target,
            timings=timings,
        )
        console.always(f"Snapshot ID: {snapshot.id}")

        console.info("Starting instance...")
        instance = timings.time(
            "main:start_instance",
            lambda: client.instances.start(
                snapshot_id=snapshot.id,
                ttl_seconds=3600,
                ttl_action="pause",
            ),
        )
        global current_instance
        current_instance = instance

        console.always(f"Instance ID: {instance.id}")

        expose_ports = [39376, 39377, 39378]
        with timings.section("main:expose_http_services"):
            for port in expose_ports:
                instance.expose_http_service(port=port, name=f"port-{port}")

        timings.time("main:wait_until_ready", instance.wait_until_ready)
        console.info(instance.networking.http_services)

        # Ensure cmux target is started regardless of quiet mode
        with timings.section("main:start_cmux_target"):
            instance.exec(
                "systemctl start cmux.target || systemctl start cmux.service || true"
            )

        if not console.quiet:
            try:
                with timings.section("main:instance_diagnostics"):
                    console.info("\n--- Instance diagnostics ---")
                    start_res = instance.exec(
                        "systemctl status cmux.target --no-pager -l | tail -n 40 || true"
                    )
                    if getattr(start_res, "stdout", None):
                        console.info(start_res.stdout)
                    if getattr(start_res, "stderr", None):
                        console.info_stderr(str(start_res.stderr))

                    diag_cmds = [
                        "systemctl is-enabled cmux.target || true",
                        "systemctl is-active cmux.target || true",
                        "systemctl status cmux.target --no-pager -l | tail -n 40 || true",
                        "systemctl status cmux-openvscode.service --no-pager -l | tail -n 80 || true",
                        "ps aux | grep -E 'openvscode-server|node /builtins/build/index.js' | grep -v grep || true",
                        "ss -lntp | grep ':39378' || true",
                        "tail -n 80 /var/log/cmux/openvscode.log || true",
                    ]
                    for cmd in diag_cmds:
                        console.info(f"\n$ {cmd}")
                        res = instance.exec(cmd)
                        if getattr(res, "stdout", None):
                            console.info(res.stdout)
                        if getattr(res, "stderr", None):
                            console.info_stderr(str(res.stderr))
            except Exception as e:
                console.always(f"Diagnostics failed: {e}")

        try:
            with timings.section("main:port_39378_check"):
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

                url = (
                    _get(vscode_service, "url") if vscode_service is not None else None
                )
                if not url:
                    console.always("No exposed HTTP service found for port 39378")
                else:
                    health_url = f"{url.rstrip('/')}/?folder=/root/workspace"
                    ok = False
                    for _ in range(30):
                        log = console.always if console.quiet else console.info

                        try:
                            with urllib_request.urlopen(health_url, timeout=5) as resp:
                                code = getattr(
                                    resp, "status", getattr(resp, "code", None)
                                )
                                if code == 200:
                                    log(f"Port 39378 check: HTTP {code}")
                                    ok = True
                                    break
                                else:
                                    log(
                                        f"Port 39378 not ready yet, HTTP {code}; retrying..."
                                    )
                        except (HTTPError, URLError, socket.timeout, TimeoutError) as e:
                            log(f"Port 39378 not ready yet ({e}); retrying...")
                        time.sleep(2)
                    if not ok:
                        console.always(
                            "Port 39378 did not return HTTP 200 within timeout"
                        )

                    console.always(f"VSCode URL: {health_url}")
        except Exception as e:
            console.always(f"Error checking port 39378: {e}")

        print_timing_summary(timings)

        if args.exec_script:
            console.always("Running custom --exec script...")
            exec_result = instance.exec(f"bash -lc {shlex.quote(args.exec_script)}")
            if getattr(exec_result, "stdout", None):
                console.always(exec_result.stdout)
            if getattr(exec_result, "stderr", None):
                console.always(str(exec_result.stderr))
            exit_code = getattr(exec_result, "exit_code", 0)
            if exit_code not in (None, 0):
                raise RuntimeError(f"--exec script exited with code {exit_code}")

        if args.resnapshot:
            input("Press Enter to snapshot again...")
            console.info("Snapshotting...")
            final_snapshot = instance.snapshot()
            console.always(f"Snapshot ID: {final_snapshot.id}")
    finally:
        _cleanup_instance()


if __name__ == "__main__":
    main()

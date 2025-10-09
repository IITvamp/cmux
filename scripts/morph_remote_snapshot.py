#!/usr/bin/env python3
"""
Build a Morph snapshot by uploading the repository, building the Docker image
remotely, and extracting the resulting rootfs inside the snapshot.

The script:
1. Archives the repository (respecting .gitignore via git ls-files)
2. Creates a Morph snapshot and uploads the archive
3. Installs Docker tooling inside the snapshot
4. Extracts the archive and builds the Docker image remotely
5. Flattens the image into /opt/app/rootfs
6. Prepares overlay workspace directories for runtime mounting
7. Writes runtime environment configuration
8. Installs and enables the cmux systemd units that ship with the image
"""

from __future__ import annotations

import argparse
import atexit
import json
import os
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import tempfile
import uuid
import time
import typing as t
from contextlib import contextmanager
from pathlib import Path
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

import dotenv
from morphcloud.api import Instance, MorphCloudClient, Snapshot
from morph_common import (
    ensure_docker,
    ensure_docker_cli_plugins,
    write_remote_file,
)

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

    def add(self, label: str, duration: float) -> None:
        self._sections.append((label, duration))

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


def send_macos_notification(title: str, message: str) -> None:
    """Send a user notification on macOS without failing the build."""
    if sys.platform != "darwin":
        return

    if shutil.which("osascript") is None:
        return

    script = f"display notification {json.dumps(message)} with title {json.dumps(title)}"
    try:
        subprocess.run(["osascript", "-e", script], check=False)
    except Exception as exc:  # noqa: BLE001
        console.info(f"Failed to send macOS notification: {exc}")


def _cleanup_instance() -> None:
    global current_instance
    inst = current_instance
    if not inst:
        return
    try:
        console.info(f"Stopping instance {getattr(inst, 'id', '<unknown>')}...")
        inst.stop()
        console.info("Instance stopped")
    except Exception as e:  # noqa: BLE001
        console.always(f"Failed to stop instance: {e}")
    finally:
        current_instance = None


def _signal_handler(signum, _frame) -> None:  # type: ignore[no-untyped-def]
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


def parse_image_config(raw: t.Any) -> DockerImageConfig:
    """Validate and normalize the docker image config payload."""
    if not isinstance(raw, dict):
        raise ValueError("image config payload must be a mapping")

    def _list(value: t.Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value]

    return {
        "entrypoint": _list(raw.get("entrypoint")),
        "cmd": _list(raw.get("cmd")),
        "env": _list(raw.get("env")),
        "workdir": str(raw.get("workdir") or "/"),
        "user": str(raw.get("user") or "root"),
    }


def _git_candidates() -> list[str]:
    """Return viable git binary paths preferring homebrew installations."""
    hints = [
        os.environ.get("CMUX_GIT_PATH"),
        os.environ.get("GIT_BINARY"),
        "/opt/homebrew/bin/git",
        "/usr/local/bin/git",
    ]

    which_git = shutil.which("git")
    if which_git:
        hints.append(which_git)

    hints.append("git")

    seen: set[str] = set()
    candidates: list[str] = []
    for hint in hints:
        if not hint:
            continue
        resolved = shutil.which(hint) if os.path.basename(hint) == hint else hint
        if not resolved:
            continue
        full_path = str(Path(resolved).resolve())
        if full_path in seen:
            continue
        if os.access(full_path, os.X_OK):
            seen.add(full_path)
            candidates.append(full_path)
    return candidates


def _run_git_command(repo_root: Path, args: list[str]) -> subprocess.CompletedProcess[str] | None:
    """Attempt git command with multiple candidates; returns first success."""
    errors: list[str] = []
    for git_bin in _git_candidates():
        result = subprocess.run(
            [git_bin, "-C", str(repo_root), *args],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return result
        error_excerpt = result.stderr.strip() or f"exit code {result.returncode}"
        errors.append(f"{git_bin}: {error_excerpt}")

    if errors:
        joined = "; ".join(errors)
        console.always(f"Failed to run git command {args}: {joined}")
    else:
        console.always(f"No git executable found to run command {args}")
    return None


def list_repo_files(repo_root: Path) -> list[Path]:
    """Return repository files respecting gitignore rules via git ls-files."""
    rev_parse = _run_git_command(
        repo_root,
        ["rev-parse", "--is-inside-work-tree"],
    )
    if rev_parse and rev_parse.stdout.strip() == "true":
        files_result = _run_git_command(
            repo_root,
            [
                "ls-files",
                "--cached",
                "--others",
                "--exclude-standard",
                "-z",
            ],
        )
        if files_result:
            entries = [entry for entry in files_result.stdout.split("\0") if entry]
            return [Path(entry) for entry in entries]

    console.always(
        "Falling back to filesystem walk for repository packaging; .gitignore will not be applied."
    )
    files: list[Path] = []
    for path in repo_root.rglob("*"):
        if path.is_file() and ".git" not in path.parts:
            files.append(path.relative_to(repo_root))
    return files


def create_repo_archive(repo_root: Path) -> str:
    """Create a gzipped tarball of the repository respecting gitignore."""
    files = list_repo_files(repo_root)
    fd, archive_path = tempfile.mkstemp(suffix=".tar.gz", prefix="cmux-repo-")
    os.close(fd)

    with tarfile.open(archive_path, "w:gz") as tar:
        for rel_path in files:
            full_path = repo_root / rel_path
            tar.add(full_path, arcname=rel_path.as_posix())

    return archive_path


def build_snapshot(
    dockerfile_path: str | None,
    image_name: str | None,
    platform: str,
    target: str | None,
    timings: TimingsCollector,
) -> Snapshot:
    """Build a Morph snapshot by performing the Docker build remotely."""

    repo_root = Path.cwd()
    archive_path: str | None = None
    local_config_path: str | None = None
    local_result_path: str | None = None

    plan_script_source = Path(__file__).with_name("morph_remote_plan.sh")
    if not plan_script_source.exists():
        raise FileNotFoundError(
            f"Remote plan script not found: {plan_script_source}"  # pragma: no cover - defensive
        )

    run_id = uuid.uuid4().hex
    remote_archive_path = f"/opt/app/repo-{run_id}.tar.gz"
    remote_repo_root = "/opt/app/workdir/repo"
    remote_context_dir = ""
    remote_dockerfile_path = ""
    remote_plan_path = f"/opt/app/cmux-build-plan-{run_id}.sh"
    remote_config_path = f"/opt/app/cmux-build-config-{run_id}.sh"
    remote_result_path = f"/opt/app/cmux-build-result-{run_id}.json"
    remote_plan_log_path = f"/opt/app/cmux-build-{run_id}.log"
    remote_build_log_path = "/opt/app/docker-build.log"
    remote_image_config_path = f"/opt/app/docker-image-config-{run_id}.json"
    remote_rootfs_tar_path = f"/opt/app/rootfs-{run_id}.tar"
    remote_env_path = "/opt/app/app.env"

    mode = "image" if image_name else "build"
    built_image: str

    try:
        console.info("Creating Morph snapshot...")
        snapshot = timings.time(
            "build_snapshot:create_snapshot",
            lambda: client.snapshots.create(
                vcpus=10,
                memory=32768,
                disk_size=32768,
                digest="cmux:base-docker",
            ),
        )

        console.info("Uploading remote build plan script...")
        snapshot = timings.time(
            "build_snapshot:upload_plan_script",
            lambda: snapshot.upload(
                str(plan_script_source),
                remote_plan_path,
                recursive=False,
            ),
        )

        ensure_docker_script_remote = f"/opt/app/cmux-ensure-docker-{run_id}.sh"
        ensure_docker_script_content = "\n".join(
            [
                "#!/usr/bin/env bash",
                "set -Eeuo pipefail",
                "set -x",
                ensure_docker(),
                "",
            ]
        )

        ensure_docker_cli_script_remote = (
            f"/opt/app/cmux-ensure-docker-cli-{run_id}.sh"
        )
        ensure_docker_cli_script_content = "\n".join(
            [
                "#!/usr/bin/env bash",
                "set -Eeuo pipefail",
                ensure_docker_cli_plugins(),
                "",
            ]
        )

        console.info("Writing remote ensure-docker script...")
        snapshot = timings.time(
            "build_snapshot:write_ensure_docker_script",
            lambda: write_remote_file(
                snapshot,
                remote_path=ensure_docker_script_remote,
                content=ensure_docker_script_content,
                executable=True,
            ),
        )

        console.info("Writing remote ensure-docker-cli script...")
        snapshot = timings.time(
            "build_snapshot:write_ensure_docker_cli_script",
            lambda: write_remote_file(
                snapshot,
                remote_path=ensure_docker_cli_script_remote,
                content=ensure_docker_cli_script_content,
                executable=True,
            ),
        )

        if mode == "build":
            dockerfile_local = dockerfile_path or "Dockerfile"
            dockerfile_abs = (repo_root / dockerfile_local).resolve()
            try:
                dockerfile_rel = dockerfile_abs.relative_to(repo_root.resolve())
            except ValueError as exc:  # noqa: TRY003
                raise ValueError(
                    f"Dockerfile {dockerfile_abs} is outside the repository root"
                ) from exc

            if not dockerfile_abs.exists():
                raise FileNotFoundError(f"Dockerfile not found: {dockerfile_abs}")

            context_rel = dockerfile_rel.parent
            remote_context_dir = (
                remote_repo_root
                if context_rel.as_posix() == "."
                else f"{remote_repo_root}/{context_rel.as_posix()}"
            )
            remote_dockerfile_path = f"{remote_repo_root}/{dockerfile_rel.as_posix()}"
            built_image = f"cmux-morph-temp:{os.getpid()}"

            console.info("Packaging repository for remote build...")
            archive_path = timings.time(
                "build_snapshot:create_repo_archive",
                lambda: create_repo_archive(repo_root),
            )

            console.info("Uploading repository archive...")
            snapshot = timings.time(
                "build_snapshot:upload_repo_archive",
                lambda: snapshot.upload(
                    archive_path,
                    remote_archive_path,
                    recursive=False,
                ),
            )
        else:
            assert image_name is not None  # for type checking
            built_image = image_name

        config_entries = {
            "MODE": mode,
            "PLATFORM": platform,
            "REMOTE_ARCHIVE_PATH": remote_archive_path,
            "REMOTE_REPO_ROOT": remote_repo_root,
            "REMOTE_CONTEXT_DIR": remote_context_dir,
            "REMOTE_DOCKERFILE_PATH": remote_dockerfile_path,
            "DOCKER_BUILD_TARGET": target or "",
            "BUILD_LOG_PATH": remote_build_log_path,
            "BUILT_IMAGE": built_image,
            "SOURCE_IMAGE": image_name or "",
            "ROOTFS_TAR_PATH": remote_rootfs_tar_path,
            "RESULT_PATH": remote_result_path,
            "PLAN_LOG_PATH": remote_plan_log_path,
            "IMAGE_CONFIG_OUTPUT_PATH": remote_image_config_path,
            "ENV_FILE_PATH": remote_env_path,
            "ENSURE_DOCKER_SCRIPT_PATH": ensure_docker_script_remote,
            "ENSURE_DOCKER_CLI_SCRIPT_PATH": ensure_docker_cli_script_remote,
        }

        with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as config_file:
            for key, value in config_entries.items():
                quoted = shlex.quote(str(value))
                config_file.write(f"export {key}={quoted}\n")
            local_config_path = config_file.name

        console.info("Uploading remote build plan configuration...")
        snapshot = timings.time(
            "build_snapshot:upload_plan_config",
            lambda: snapshot.upload(
                local_config_path,
                remote_config_path,
                recursive=False,
            ),
        )

        def collect_plan_logs(current_snapshot: Snapshot) -> Snapshot:
            updated_snapshot = current_snapshot

            def _download(remote_path: str, label: str) -> None:
                nonlocal updated_snapshot
                fd, local_path = tempfile.mkstemp(
                    prefix=f"cmux-{label}-",
                    suffix=".log",
                )
                os.close(fd)
                try:
                    updated_snapshot = updated_snapshot.download(
                        remote_path,
                        local_path,
                        recursive=False,
                    )
                    console.always(f"{label.replace('_', ' ')} saved to {local_path}")
                    try:
                        tail_lines = (
                            Path(local_path)
                            .read_text(encoding="utf-8", errors="ignore")
                            .splitlines()[-200:]
                        )
                        if tail_lines:
                            console.always(f"--- {label.replace('_', ' ')} tail ---")
                            console.always(os.linesep.join(tail_lines))
                    except Exception as read_err:  # noqa: BLE001
                        console.always(
                            f"Failed to read {label} tail: {read_err}",
                        )
                except Exception as download_err:  # noqa: BLE001
                    console.always(
                        f"Failed to download {label}: {download_err}",
                    )

            _download(remote_plan_log_path, "plan_log")
            if mode == "build":
                _download(remote_build_log_path, "build_log")

            return updated_snapshot

        console.info("Executing remote build plan...")
        try:
            snapshot = timings.time(
                "build_snapshot:execute_plan",
                lambda: snapshot.exec(
                    f"bash {shlex.quote(remote_plan_path)} {shlex.quote(remote_config_path)}"
                ),
            )
        except RuntimeError as plan_error:
            console.always(
                "Remote build plan failed; attempting to collect remote logs",
            )
            snapshot = collect_plan_logs(snapshot)
            raise plan_error

        with tempfile.NamedTemporaryFile(delete=False) as result_file:
            local_result_path = result_file.name

        try:
            snapshot = timings.time(
                "build_snapshot:download_plan_result",
                lambda: snapshot.download(
                    remote_result_path,
                    local_result_path,
                    recursive=False,
                ),
            )
        except FileNotFoundError as download_error:
            snapshot = collect_plan_logs(snapshot)
            raise RuntimeError(
                f"Remote build plan did not produce result file at {remote_result_path}"
            ) from download_error

        result_data = json.loads(Path(local_result_path).read_text(encoding="utf-8"))

        timings_payload = result_data.get("timings", {})
        if not isinstance(timings_payload, dict):
            raise ValueError("Remote plan timings payload malformed")

        for label, value in timings_payload.items():
            try:
                timings.add(str(label), float(value))
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    f"Invalid timing entry {label!r}: {value!r}"
                ) from exc

        config = parse_image_config(result_data.get("image_config"))
        console.info(
            f"Image config: entrypoint={config['entrypoint']}, "
            f"cmd={config['cmd']}, workdir={config['workdir']}, user={config['user']}"
        )

        return snapshot
    finally:
        if archive_path and os.path.exists(archive_path):
            os.unlink(archive_path)
        if local_config_path and os.path.exists(local_config_path):
            os.unlink(local_config_path)
        if local_result_path and os.path.exists(local_result_path):
            os.unlink(local_result_path)

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build Morph snapshot from Docker image (remote build approach)"
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
        help="Docker build stage when using --dockerfile (default: morph)",
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

        expose_ports = [39375, 39376, 39377, 39378, 39379, 39380, 39381]
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
                        "ss -lntp | grep ':39379' || true",
                        "ss -lntp | grep ':39380' || true",
                        "ss -lntp | grep ':39381' || true",
                        "tail -n 80 /var/log/cmux/openvscode.log || true",
                        "tail -n 80 /var/log/cmux/websockify.log || true",
                        "tail -n 80 /var/log/cmux/x11vnc.log || true",
                    ]
                    for cmd in diag_cmds:
                        console.info(f"\n$ {cmd}")
                        res = instance.exec(cmd)
                        if getattr(res, "stdout", None):
                            console.info(res.stdout)
                        if getattr(res, "stderr", None):
                            console.info_stderr(str(res.stderr))
            except Exception as e:  # noqa: BLE001
                console.always(f"Diagnostics failed: {e}")

        try:
            with timings.section("main:port_39378_check"):
                services = getattr(instance.networking, "http_services", [])

                def _get(obj: object, key: str) -> t.Any:
                    if isinstance(obj, dict):
                        return obj.get(key)
                    return getattr(obj, key, None)

                vscode_service = None
                proxy_service = None
                vnc_service = None
                cdp_service = None
                for svc in services or []:
                    port = _get(svc, "port")
                    name = _get(svc, "name")
                    if port == 39378 or name == "port-39378":
                        vscode_service = svc
                    elif port == 39379 or name == "port-39379":
                        proxy_service = svc
                    elif port == 39380 or name == "port-39380":
                        vnc_service = svc
                    elif port == 39381 or name == "port-39381":
                        cdp_service = svc

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

                proxy_url = (
                    _get(proxy_service, "url") if proxy_service is not None else None
                )
                if proxy_url:
                    console.always(f"Proxy URL: {proxy_url}")
                else:
                    console.always("No exposed HTTP service found for port 39379")

                vnc_url = _get(vnc_service, "url") if vnc_service is not None else None
                if vnc_url:
                    novnc_url = f"{vnc_url.rstrip('/')}/vnc.html"
                    ok = False
                    for _ in range(30):
                        log = console.always if console.quiet else console.info
                        try:
                            with urllib_request.urlopen(novnc_url, timeout=5) as resp:
                                code = getattr(resp, "status", getattr(resp, "code", None))
                                if code == 200:
                                    log(f"Port 39380 check: HTTP {code}")
                                    ok = True
                                    break
                                log(f"Port 39380 not ready yet, HTTP {code}; retrying...")
                        except (HTTPError, URLError, socket.timeout, TimeoutError) as e:
                            log(f"Port 39380 not ready yet ({e}); retrying...")
                        time.sleep(2)
                    if not ok:
                        console.always("Port 39380 did not return HTTP 200 within timeout")
                    console.always(f"VNC URL: {novnc_url}")
                else:
                    console.always("No exposed HTTP service found for port 39380")

                cdp_url = _get(cdp_service, "url") if cdp_service is not None else None
                if cdp_url:
                    console.always(f"DevTools endpoint: {cdp_url}/json/version")
                else:
                    console.always("No exposed DevTools service found for port 39381")
        except Exception as e:  # noqa: BLE001
            console.always(f"Error checking exposed services: {e}")

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
            send_macos_notification(
                "cmux snapshot ready",
                f"Instance {instance.id} is ready to resnapshot.",
            )
            input("Press Enter to snapshot again...")
            console.info("Snapshotting...")
            final_snapshot = instance.snapshot()
            console.always(f"Snapshot ID: {final_snapshot.id}")
    finally:
        _cleanup_instance()


if __name__ == "__main__":
    main()

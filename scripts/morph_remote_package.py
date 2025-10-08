#!/usr/bin/env python3
"""
Build cmux host packages on a Morph snapshot by running the Docker packaging
stage remotely and downloading the resulting .deb/.rpm artifacts.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import shlex
import shutil
import socket
import subprocess
import tarfile
import tempfile
import time
import typing as t
import uuid
import sys
from pathlib import Path

import dotenv
from contextlib import contextmanager
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from morphcloud.api import ApiError, Instance, MorphCloudClient, Snapshot
from morph_common import (
    ensure_docker,
    ensure_docker_cli_plugins,
    write_remote_file,
)

dotenv.load_dotenv()


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
            from sys import stderr

            stderr.write(value)


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

    def time(self, label: str, func: t.Callable[[], t.Any]) -> t.Any:
        with self.section(label):
            return func()

    def add(self, label: str, duration: float) -> None:
        self._sections.append((label, duration))

    def summary_lines(self) -> list[str]:
        sections = self._sections
        if not sections:
            return []
        lines = [f"{label}: {duration:.2f}s" for label, duration in sections]
        total = sum(duration for _, duration in sections)
        lines.append(f"total: {total:.2f}s")
        return lines


client = MorphCloudClient()

LogEntry = tuple[t.Literal["always", "info", "info_stderr"], str]


def _append_log_entries(
    entries: list[LogEntry],
    kind: t.Literal["always", "info", "info_stderr"],
    text: t.Any,
) -> None:
    if text is None:
        return
    value = str(text)
    if not value:
        return
    for line in value.rstrip("\n").splitlines():
        entries.append((kind, line))


def _noop(_value: str) -> None:
    return


def resolve_snapshot_identifier(identifier: str) -> str:
    """Resolve user-friendly identifier to an actual Morph snapshot id."""
    try:
        snapshot = client.snapshots.get(identifier)
    except ApiError as err:
        status = getattr(err, "status_code", None)
        if status != 404:
            raise
    except Exception:
        raise
    else:
        console.info(f"Using snapshot {snapshot.id} for identifier '{identifier}'")
        return snapshot.id

    console.info(
        f"Snapshot '{identifier}' not found directly; searching for snapshots referencing it."
    )
    candidates: list[Snapshot] = []
    for snap in client.snapshots.list():
        if snap.digest == identifier or snap.refs.image_id == identifier:
            candidates.append(snap)

    if not candidates:
        raise RuntimeError(
            f"Unable to locate snapshot matching identifier '{identifier}'. "
            "Ensure the snapshot exists or update the identifier."
        )

    candidates.sort(key=lambda snap: snap.created, reverse=True)
    chosen = candidates[0]
    console.info(
        f"Resolved identifier '{identifier}' to snapshot {chosen.id} "
        f"(image {chosen.refs.image_id})"
    )
    return chosen.id


def _run_git_command(repo_root: Path, args: list[str]) -> t.Optional[str]:
    git_bins = [os.environ.get("GIT_EXE"), os.environ.get("GIT_BINARY"), "git"]
    errors: list[str] = []
    for git_bin in git_bins:
        if not git_bin:
            continue
        try:
            completed = subprocess.run(
                [git_bin, *args],
                cwd=str(repo_root),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            errors.append(f"{git_bin}: not found")
            continue
        if completed.returncode == 0:
            return completed.stdout
        errors.append(
            f"{git_bin}: {completed.stderr.strip()}"
            if completed.stderr
            else f"{git_bin}: exit code {completed.returncode}"
        )
    if errors:
        console.always(f"Failed to run git command {args}: {'; '.join(errors)}")
    return None


def list_repo_files(repo_root: Path) -> list[Path]:
    ls_files = _run_git_command(
        repo_root,
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    )
    if ls_files:
        entries = [entry for entry in ls_files.split("\0") if entry]
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
    files = list_repo_files(repo_root)
    fd, archive_path = tempfile.mkstemp(suffix=".tar.gz", prefix="cmux-repo-")
    os.close(fd)
    with tarfile.open(archive_path, "w:gz") as tar:
        for rel_path in files:
            full_path = repo_root / rel_path
            tar.add(full_path, arcname=rel_path.as_posix())
    return archive_path


def _cleanup_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def build_packages(
    dockerfile_path: str,
    platform: str,
    target: str,
    output_dir: Path,
    timings: TimingsCollector,
) -> tuple[list[Path], Instance]:
    repo_root = Path.cwd()
    plan_script = Path(__file__).with_name("morph_remote_package_plan.sh")
    if not plan_script.exists():
        raise FileNotFoundError(f"Remote plan script not found: {plan_script}")

    run_id = uuid.uuid4().hex
    remote_archive_path = f"/opt/app/repo-{run_id}.tar.gz"
    remote_repo_root = "/opt/app/workdir/repo"
    remote_context_dir = remote_repo_root
    remote_plan_path = f"/opt/app/cmux-package-plan-{run_id}.sh"
    remote_config_path = f"/opt/app/cmux-package-config-{run_id}.sh"
    remote_result_path = f"/opt/app/cmux-package-result-{run_id}.json"
    remote_plan_log_path = f"/opt/app/cmux-package-{run_id}.log"
    remote_build_log_path = f"/opt/app/cmux-package-build-{run_id}.log"
    remote_package_dir = f"/opt/app/cmux-packages-{run_id}"
    remote_archive_result = f"/opt/app/cmux-packages-{run_id}.tar.gz"

    config_file_path: str | None = None
    archive_path: str | None = None
    result_file_path: str | None = None
    package_archive_local: str | None = None
    instance: Instance | None = None

    ensure_script_remote = f"/opt/app/cmux-ensure-docker-{run_id}.sh"
    ensure_cli_script_remote = f"/opt/app/cmux-ensure-docker-cli-{run_id}.sh"

    ensure_script_content = "\n".join(
        [
            "#!/usr/bin/env bash",
            "set -Eeuo pipefail",
            "set -x",
            ensure_docker(),
            "",
        ]
    )

    ensure_cli_script_content = "\n".join(
        [
            "#!/usr/bin/env bash",
            "set -Eeuo pipefail",
            ensure_docker_cli_plugins(),
            "",
        ]
    )

    def run_remote(label: str, func: t.Callable[[], t.Any]) -> t.Any:
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                return timings_add(timings, label, func)
            except Exception as err:  # noqa: BLE001
                last_error = err
                console.always(f"{label} attempt {attempt} failed: {err}")
                if attempt < 3:
                    time.sleep(5)
        assert last_error is not None
        raise last_error

    try:
        base_snapshot_id = resolve_snapshot_identifier("morphvm-minimal")
        console.info(
            f"Starting Morph instance from snapshot '{base_snapshot_id}' "
            "(requested identifier 'morphvm-minimal')..."
        )
        instance = run_remote(
            "instance_start",
            lambda: client.instances.start(
                snapshot_id=base_snapshot_id,
                ttl_seconds=3600,
                ttl_action="pause",
            ),
        )
        timings.time("instance_wait_until_ready", instance.wait_until_ready)
        console.always(f"Instance ID: {instance.id}")

        console.info("Uploading packaging plan script...")
        run_remote(
            "upload_plan_script",
            lambda: instance.upload(
                str(plan_script),
                remote_plan_path,
                recursive=False,
            ),
        )

        console.info("Writing remote ensure-docker scripts...")
        run_remote(
            "write_ensure_docker",
            lambda: write_remote_file(
                instance,
                remote_path=ensure_script_remote,
                content=ensure_script_content,
                executable=True,
            ),
        )
        run_remote(
            "write_ensure_docker_cli",
            lambda: write_remote_file(
                instance,
                remote_path=ensure_cli_script_remote,
                content=ensure_cli_script_content,
                executable=True,
            ),
        )

        dockerfile_abs = (repo_root / dockerfile_path).resolve()
        if not dockerfile_abs.exists():
            raise FileNotFoundError(f"Dockerfile not found: {dockerfile_abs}")
        dockerfile_rel = dockerfile_abs.relative_to(repo_root)
        remote_dockerfile_path = f"{remote_repo_root}/{dockerfile_rel.as_posix()}"
        remote_context_dir = (
            remote_repo_root
            if dockerfile_rel.parent.as_posix() == "."
            else f"{remote_repo_root}/{dockerfile_rel.parent.as_posix()}"
        )

        console.info("Creating repository archive...")
        archive_path = timings_add(
            timings,
            "create_repo_archive",
            lambda: create_repo_archive(repo_root),
        )

        console.info("Uploading repository archive...")
        run_remote(
            "upload_repo_archive",
            lambda: instance.upload(
                archive_path,
                remote_archive_path,
                recursive=False,
            ),
        )

        config_entries = {
            "REMOTE_ARCHIVE_PATH": remote_archive_path,
            "REMOTE_REPO_ROOT": remote_repo_root,
            "REMOTE_CONTEXT_DIR": remote_context_dir,
            "REMOTE_DOCKERFILE_PATH": remote_dockerfile_path,
            "DOCKER_BUILD_TARGET": target,
            "PLATFORM": platform,
            "PACKAGE_OUTPUT_DIR": remote_package_dir,
            "PACKAGE_ARCHIVE_PATH": remote_archive_result,
            "RESULT_PATH": remote_result_path,
            "PLAN_LOG_PATH": remote_plan_log_path,
            "BUILD_LOG_PATH": remote_build_log_path,
            "ENSURE_DOCKER_SCRIPT_PATH": ensure_script_remote,
            "ENSURE_DOCKER_CLI_SCRIPT_PATH": ensure_cli_script_remote,
        }

        config_file_path = create_temp_config(config_entries)

        console.info("Uploading packaging config...")
        run_remote(
            "upload_plan_config",
            lambda: instance.upload(
                config_file_path,
                remote_config_path,
                recursive=False,
            ),
        )

        console.info("Executing remote packaging plan...")
        try:
            run_remote(
                "execute_plan",
                lambda: instance.exec(
                    f"bash {shlex.quote(remote_plan_path)} {shlex.quote(remote_config_path)}",
                    on_stdout=_noop,
                    on_stderr=_noop,
                ),
            )
        except Exception as exec_error:  # noqa: BLE001
            console.always("Remote packaging plan failed; fetching logs.")
            if instance is not None:
                download_remote_log(instance, remote_plan_log_path, "plan_log")
                download_remote_log(instance, remote_build_log_path, "build_log")
            raise exec_error

        result_file_path = tempfile.mktemp(suffix=".json", prefix="cmux-packages-")
        run_remote(
            "download_plan_result",
            lambda: instance.download(
                remote_result_path,
                result_file_path,
                recursive=False,
            ),
        )

        with open(result_file_path, "r", encoding="utf-8") as result_file:
            result_data = json.load(result_file)

        remote_timings = result_data.get("timings", {})
        if isinstance(remote_timings, dict):
            for label, value in remote_timings.items():
                try:
                    timings.add(f"remote:{label}", float(value))
                except (TypeError, ValueError):
                    continue

        archive_remote = result_data.get("archive_path")
        if not isinstance(archive_remote, str) or not archive_remote:
            raise RuntimeError("Remote plan did not report archive path")

        console.info("Downloading package archive...")
        package_archive_local = tempfile.mktemp(suffix=".tar.gz", prefix="cmux-packages-")
        run_remote(
            "download_package_archive",
            lambda: instance.download(
                archive_remote,
                package_archive_local,
                recursive=False,
            ),
        )

        console.info(f"Extracting packages to {output_dir}...")
        _cleanup_directory(output_dir)
        with tarfile.open(package_archive_local, "r:gz") as tar:
            tar.extractall(path=output_dir)

        package_paths = sorted(path for path in output_dir.glob("*") if path.is_file())
        if instance is None:
            raise RuntimeError("Instance reference lost after packaging")
        return package_paths, instance
    except Exception:
        if instance is not None:
            try:
                instance.stop()
            except Exception as err:  # noqa: BLE001
                console.always(f"Failed to stop instance after error: {err}")
        raise
    finally:
        if archive_path and os.path.exists(archive_path):
            os.unlink(archive_path)
        if config_file_path and os.path.exists(config_file_path):
            os.unlink(config_file_path)
        if result_file_path and os.path.exists(result_file_path):
            os.unlink(result_file_path)
        if package_archive_local and os.path.exists(package_archive_local):
            os.unlink(package_archive_local)


def create_temp_config(entries: dict[str, str]) -> str:
    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as config_file:
        for key, value in entries.items():
            config_file.write(f"export {key}={shlex.quote(str(value))}\n")
        return config_file.name


def timings_add(
    timings: TimingsCollector,
    label: str,
    func: t.Callable[[], t.Any],
) -> t.Any:
    start = time.perf_counter()
    result = func()
    duration = time.perf_counter() - start
    timings.add(label, duration)
    return result


def download_remote_log(remote: Snapshot | Instance, remote_path: str, label: str) -> None:
    attempts = 3
    fd, local_path = tempfile.mkstemp(suffix=f"-{label}.log", prefix="cmux-")
    os.close(fd)
    for attempt in range(1, attempts + 1):
        try:
            remote.download(remote_path, local_path, recursive=False)
            console.always(f"{label} saved to {local_path}")
            return
        except Exception as err:  # noqa: BLE001
            if attempt == attempts:
                console.always(f"failed to download {label}: {err}")
            else:
                console.always(
                    f"{label} attempt {attempt} failed: {err}; retrying..."
                )
                time.sleep(5)


def print_timing_summary(timings: TimingsCollector) -> None:
    lines = timings.summary_lines()
    if not lines:
        return
    console.info("\n--- Packaging Timings ---")
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


def _emit_logs(entries: list[LogEntry]) -> None:
    for log_type, message in entries:
        log_fn = getattr(console, log_type, console.always)
        log_fn(message)


def _safe_get(obj: object, key: str) -> t.Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _exec_instance_command(instance: Instance, cmd: str) -> tuple[list[LogEntry], bool]:
    entries: list[LogEntry] = []
    stdout_chunks: list[str] = []
    stderr_chunks: list[str] = []

    def handle_stdout(chunk: str) -> None:
        stdout_chunks.append(chunk)
        _append_log_entries(entries, "info", chunk)

    def handle_stderr(chunk: str) -> None:
        stderr_chunks.append(chunk)
        _append_log_entries(entries, "info_stderr", chunk)

    try:
        result = instance.exec(
            cmd,
            on_stdout=handle_stdout,
            on_stderr=handle_stderr,
        )
    except Exception as err:  # noqa: BLE001
        entries.append(("always", f"Command failed: {cmd}\n{err}"))
        return entries, False

    if not stdout_chunks:
        stdout = getattr(result, "stdout", None)
        if stdout:
            _append_log_entries(entries, "info", stdout)
    if not stderr_chunks:
        stderr = getattr(result, "stderr", None)
        if stderr:
            _append_log_entries(entries, "info_stderr", stderr)

    exit_code = getattr(result, "exit_code", 0)
    if exit_code in (None, 0):
        return entries, True
    entries.append(("always", f"Exit code: {exit_code}"))
    return entries, False


def _run_instance_diagnostics(instance: Instance) -> None:
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

    if not diag_cmds:
        return

    max_workers = min(4, len(diag_cmds))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        tasks: list[tuple[str, concurrent.futures.Future[list[LogEntry]]]] = []
        for cmd in diag_cmds:
            future = executor.submit(_exec_instance_command, instance, cmd)
            tasks.append((cmd, future))

        for cmd, future in tasks:
            console.info(f"\n$ {cmd}")
            try:
                entries, _ = future.result()
            except Exception as err:  # noqa: BLE001
                console.always(f"Command failed while gathering diagnostics: {cmd}\n{err}")
                continue
            _emit_logs(entries)


def _categorize_services(
    services: t.Sequence[object] | None,
) -> tuple[t.Any, t.Any, t.Any, t.Any]:
    vscode_service = None
    proxy_service = None
    vnc_service = None
    cdp_service = None
    for svc in services or []:
        port = _safe_get(svc, "port")
        name = _safe_get(svc, "name")
        if port == 39378 or name == "port-39378":
            vscode_service = svc
        elif port == 39379 or name == "port-39379":
            proxy_service = svc
        elif port == 39380 or name == "port-39380":
            vnc_service = svc
        elif port == 39381 or name == "port-39381":
            cdp_service = svc
    return vscode_service, proxy_service, vnc_service, cdp_service


def _check_vscode_service(service: object | None, *, quiet: bool) -> list[LogEntry]:
    if service is None:
        return [("always", "No exposed HTTP service found for port 39378")]

    url = _safe_get(service, "url")
    if not url:
        return [("always", "No exposed HTTP service found for port 39378")]

    health_url = f"{str(url).rstrip('/')}/?folder=/root/workspace"
    log_kind: t.Literal["always", "info"] = "always" if quiet else "info"
    entries: list[LogEntry] = []
    ok = False
    for _ in range(30):
        try:
            with urllib_request.urlopen(health_url, timeout=5) as resp:
                code = getattr(resp, "status", getattr(resp, "code", None))
                if code == 200:
                    entries.append((log_kind, f"Port 39378 check: HTTP {code}"))
                    ok = True
                    break
                entries.append((log_kind, f"Port 39378 not ready yet, HTTP {code}; retrying..."))
        except (HTTPError, URLError, socket.timeout, TimeoutError) as exc:
            entries.append((log_kind, f"Port 39378 not ready yet ({exc}); retrying..."))
        time.sleep(2)
    if not ok:
        entries.append(("always", "Port 39378 did not return HTTP 200 within timeout"))

    entries.append(("always", f"VSCode URL: {health_url}"))
    return entries


def _check_vnc_service(service: object | None, *, quiet: bool) -> list[LogEntry]:
    if service is None:
        return [("always", "No exposed HTTP service found for port 39380")]

    url = _safe_get(service, "url")
    if not url:
        return [("always", "No exposed HTTP service found for port 39380")]

    novnc_url = f"{str(url).rstrip('/')}/vnc.html"
    log_kind: t.Literal["always", "info"] = "always" if quiet else "info"
    entries: list[LogEntry] = []
    ok = False
    for _ in range(30):
        try:
            with urllib_request.urlopen(novnc_url, timeout=5) as resp:
                code = getattr(resp, "status", getattr(resp, "code", None))
                if code == 200:
                    entries.append((log_kind, f"Port 39380 check: HTTP {code}"))
                    ok = True
                    break
                entries.append((log_kind, f"Port 39380 not ready yet, HTTP {code}; retrying..."))
        except (HTTPError, URLError, socket.timeout, TimeoutError) as exc:
            entries.append((log_kind, f"Port 39380 not ready yet ({exc}); retrying..."))
        time.sleep(2)
    if not ok:
        entries.append(("always", "Port 39380 did not return HTTP 200 within timeout"))

    entries.append(("always", f"VNC URL: {novnc_url}"))
    return entries


def _inspect_exposed_services(instance: Instance, timings: TimingsCollector) -> None:
    services = getattr(instance.networking, "http_services", [])
    vscode_service, proxy_service, vnc_service, cdp_service = _categorize_services(services)

    with timings.section("instance:service_checks"):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            tasks: list[tuple[str, concurrent.futures.Future[list[LogEntry]]]] = [
                ("Port 39378", executor.submit(_check_vscode_service, vscode_service, quiet=console.quiet)),
                ("Port 39380", executor.submit(_check_vnc_service, vnc_service, quiet=console.quiet)),
            ]

            for label, future in tasks:
                try:
                    entries = future.result()
                except Exception as err:  # noqa: BLE001
                    console.always(f"{label} check failed: {err}")
                    continue
                _emit_logs(entries)

        proxy_url = _safe_get(proxy_service, "url") if proxy_service is not None else None
        if proxy_url:
            console.always(f"Proxy URL: {proxy_url}")
        else:
            console.always("No exposed HTTP service found for port 39379")

        cdp_url = _safe_get(cdp_service, "url") if cdp_service is not None else None
        if cdp_url:
            console.always(f"DevTools endpoint: {cdp_url}/json/version")
        else:
            console.always("No exposed DevTools service found for port 39381")


def _run_sanity_checks(instance: Instance, timings: TimingsCollector) -> None:
    commands: list[tuple[str, str]] = [
        ("docker --version", "docker --version"),
        ("docker compose version", "docker compose version"),
        ("docker run --rm hello-world", "docker run --rm hello-world"),
    ]

    if not commands:
        return

    with timings.section("instance:sanity_checks"):
        for label, command in commands:
            console.info(f"\n$ {label}")
            entries, success = _exec_instance_command(instance, command)
            _emit_logs(entries)
            if not success:
                raise RuntimeError(f"Sanity check failed: {label}")


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build cmux host packages using a remote Morph snapshot",
    )
    ap.add_argument(
        "--dockerfile",
        default="Dockerfile",
        help="Path to Dockerfile (default: Dockerfile)",
    )
    ap.add_argument(
        "--platform",
        default="linux/amd64",
        help="Docker platform to target (default: linux/amd64)",
    )
    ap.add_argument(
        "--target",
        default="package-export",
        help="Docker build stage to package (default: package-export)",
    )
    ap.add_argument(
        "--output-dir",
        default="cmux-packages",
        help="Directory to write extracted packages (default: cmux-packages)",
    )
    ap.add_argument(
        "--quiet",
        action="store_true",
        help="Reduce log verbosity",
    )
    ap.add_argument(
        "--keep-snapshot",
        action="store_true",
        help="Retain the Morph snapshot after packaging completes",
    )
    ap.add_argument(
        "--resnapshot",
        action="store_true",
        help="Start an instance from the packaging snapshot and optionally resnapshot it",
    )
    args = ap.parse_args()

    console.quiet = args.quiet
    output_dir = Path(args.output_dir).resolve()
    timings = TimingsCollector()
    package_files: list[Path] = []
    new_snapshot_id: str | None = None
    instance: Instance | None = None

    if args.keep_snapshot or args.resnapshot:
        console.info(
            "--keep-snapshot/--resnapshot flags are no longer required; "
            "the script now prompts before creating a new snapshot."
        )

    try:
        package_files, instance = build_packages(
            args.dockerfile,
            args.platform,
            args.target,
            output_dir,
            timings,
        )

        if instance is None:
            raise RuntimeError("Failed to obtain instance for validation steps")

        expose_ports = [39376, 39377, 39378, 39379, 39380, 39381]
        with timings.section("instance:expose_http_services"):
            for port in expose_ports:
                instance.expose_http_service(port=port, name=f"port-{port}")

        timings.time("instance:wait_until_ready_for_checks", instance.wait_until_ready)
        console.info(instance.networking.http_services)

        with timings.section("instance:start_cmux_target"):
            instance.exec(
                "systemctl start cmux.target || systemctl start cmux.service || true",
                on_stdout=_noop,
                on_stderr=_noop,
            )

        if not console.quiet:
            try:
                with timings.section("instance:diagnostics"):
                    console.info("\n--- Instance diagnostics ---")
                    start_res = instance.exec(
                        "systemctl status cmux.target --no-pager -l | tail -n 40 || true",
                        on_stdout=_noop,
                        on_stderr=_noop,
                    )
                    if getattr(start_res, "stdout", None):
                        console.info(start_res.stdout)
                    if getattr(start_res, "stderr", None):
                        console.info_stderr(str(start_res.stderr))
                    _run_instance_diagnostics(instance)
            except Exception as err:  # noqa: BLE001
                console.always(f"Diagnostics failed: {err}")

        try:
            _inspect_exposed_services(instance, timings)
        except Exception as err:  # noqa: BLE001
            console.always(f"Error checking exposed services: {err}")

        try:
            _run_sanity_checks(instance, timings)
        except Exception as err:  # noqa: BLE001
            console.always(f"Sanity checks failed: {err}")
            raise

        send_macos_notification(
            "cmux packaging ready",
            f"Instance {instance.id} is ready for manual sanity checks.",
        )
        console.always("Instance ready for manual sanity checks.")
        console.always(
            "Validate VSCode/VNC access, then press Enter to capture a new snapshot."
        )
        input("Press Enter to snapshot the instance once checks pass...")

        console.info("Snapshotting...")
        final_snapshot = timings.time(
            "instance:create_snapshot",
            instance.snapshot,
        )
        new_snapshot_id = getattr(final_snapshot, "id", None)
        if new_snapshot_id:
            console.always(f"Snapshot ID: {new_snapshot_id}")
        else:
            console.always("Snapshot operation completed without returning an ID")
    finally:
        if instance is not None:
            try:
                instance.stop()
            except Exception as err:  # noqa: BLE001
                console.always(f"Failed to stop instance: {err}")
        print_timing_summary(timings)

    console.always(f"Packages extracted to: {output_dir}")
    if package_files:
        console.always("Artifacts:")
        for path in package_files:
            console.always(f"  - {path.name}")
    if new_snapshot_id:
        console.always(f"Snapshot ID: {new_snapshot_id}")


if __name__ == "__main__":
    main()

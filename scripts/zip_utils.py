from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:  # Avoid heavy imports unless needed
    pass  # type: ignore


def _collect_repo_files(
    repo_root: Path, *, timeout_seconds: float | None = None
) -> list[Path]:
    files: list[Path] = []
    try:
        r = subprocess.run(
            [
                "git",
                "-C",
                str(repo_root),
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=timeout_seconds
            if timeout_seconds and timeout_seconds > 0
            else None,
        )
        out = r.stdout or b""
        for part in out.split(b"\x00"):
            if not part:
                continue
            files.append(Path(part.decode("utf-8", errors="ignore")))
    except subprocess.TimeoutExpired:
        print(f"Git listing timed out after {timeout_seconds}s")
        # Git listing is too slow; fall back to empty to trigger CLI zip fallback
        return []
    except Exception as e:
        print(f"Git listing failed: {e}")
        # Return empty list to trigger the CLI fallback
        return []
    return files


def _force_include(
    repo_root: Path, files: list[Path], include_paths: Iterable[str] | None
) -> list[Path]:
    if not include_paths:
        return files
    files_set = set(files)
    for inc in include_paths:
        p = repo_root / inc
        try:
            rel = p.relative_to(repo_root)
        except Exception:
            continue
        # Only include regular files or symlinks to files
        if p.is_file() or (p.is_symlink() and p.resolve().is_file()):
            if rel not in files_set:
                files.append(rel)
                files_set.add(rel)
    return files


def _zip_with_cli(
    repo_root: Path, out_zip: Path, rel_files: list[Path], timeout_s: float
) -> bool:
    """Try to zip using the system `zip` command with no compression (fast).

    Returns True on success, False on failure/timeout.
    """
    try:
        print(f"Zipping {len(rel_files)} files with system zip command...")
        # Prepare input list for `zip -@` (newline separated, POSIX paths)
        # Filter out empty strings and ensure we have valid paths
        valid_files = [str(p).replace("\\", "/") for p in rel_files if str(p).strip()]
        if not valid_files:
            print("No valid files to zip")
            return False

        stdin_data = "\n".join(valid_files) + "\n"
        out_zip.parent.mkdir(parents=True, exist_ok=True)

        # First try to remove existing zip if it exists
        if out_zip.exists():
            out_zip.unlink()

        # -q: quiet, -0: store only, -y: store symlinks as symlinks, -@ read from stdin
        result = subprocess.run(
            ["zip", "-q", "-0", "-y", "-@", str(out_zip)],
            input=stdin_data.encode("utf-8"),
            cwd=str(repo_root),
            capture_output=True,
            text=False,
            timeout=timeout_s,
        )

        if result.returncode != 0:
            stderr = (
                result.stderr.decode("utf-8", errors="ignore") if result.stderr else ""
            )
            print(
                f"System zip command failed with exit code {result.returncode}: {stderr[:200]}"
            )
            return False

        print("Successfully zipped with system zip command")
        return True
    except subprocess.TimeoutExpired:
        print(f"System zip command timed out after {timeout_s}s")
        try:
            if out_zip.exists():
                out_zip.unlink()
        except Exception:
            pass
        return False
    except Exception as e:
        print(f"System zip command failed: {e}")
        # zip not available or failed; fall back
        try:
            if out_zip.exists():
                out_zip.unlink()
        except Exception:
            pass
        return False


def _zip_with_python(repo_root: Path, out_zip: Path, rel_files: list[Path]) -> None:
    # Use no compression for speed.
    from zipfile import ZIP_STORED, ZipFile

    out_zip.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(out_zip, "w", compression=ZIP_STORED) as zf:
        for rel in rel_files:
            abspath = repo_root / rel
            if abspath.is_file():
                zf.write(abspath, arcname=str(rel).replace("\\", "/"))
            elif abspath.is_symlink():
                try:
                    if abspath.resolve().is_file():
                        zf.write(abspath, arcname=str(rel).replace("\\", "/"))
                except Exception:
                    continue


def _zip_whole_tree_with_cli(repo_root: Path, out_zip: Path, timeout_s: float) -> bool:
    """Fallback: Zip the whole tree recursively with common excludes.

    Excludes heavy directories and junk files to keep it fast.
    """
    excludes = [
        ".git/*",
        "**/.git/*",
        "node_modules/*",
        "**/node_modules/*",
        "logs/*",
        "**/logs/*",
        "dist/*",
        "**/dist/*",
        "out/*",
        "**/out/*",
        "build/*",
        "**/build/*",
        ".pnpm-store/*",
        "**/.pnpm-store/*",
        ".vercel/*",
        "**/.vercel/*",
        "*.log",
        "**/*.log",
        ".DS_Store",
        "**/.DS_Store",
        "cmux-cli",
        ".next/*",
        "**/.next/*",
        "coverage/*",
        "**/coverage/*",
    ]
    try:
        print("Fallback: Zipping whole tree with excludes...")
        out_zip.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["zip", "-q", "-0", "-r", "-y", str(out_zip), "."]
        for pat in excludes:
            cmd.extend(["-x", pat])
        subprocess.run(
            cmd,
            cwd=str(repo_root),
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout_s,
        )
        print("Successfully zipped whole tree")
        return True
    except subprocess.TimeoutExpired:
        print(f"Whole tree zip timed out after {timeout_s}s")
        try:
            if out_zip.exists():
                out_zip.unlink()
        except Exception:
            pass
        return False
    except Exception as e:
        print(f"Whole tree zip failed: {e}")
        try:
            if out_zip.exists():
                out_zip.unlink()
        except Exception:
            pass
        return False


def zip_repo_fast(
    repo_root: Path,
    out_zip: Path,
    include_paths: list[str] | None = None,
    *,
    timeout_seconds: float | None = None,
) -> None:
    """Zip repo quickly with a timeout, preferring system `zip`.

    - Uses `git ls-files --cached --others --exclude-standard` to collect files.
    - Forces inclusion of `include_paths` if provided.
    - Attempts `zip -0 -@` (store-only) with a timeout, then falls back to Python ZIP.
    """
    repo_root = repo_root.resolve()
    out_zip = out_zip.resolve()

    # Time-limited git listing first
    git_tmo: float
    if timeout_seconds is not None:
        git_tmo = max(1.0, min(timeout_seconds * 0.3, 5.0))  # Limit to 5 seconds max
    else:
        try:
            git_tmo = float(os.environ.get("CMUX_ZIP_GIT_TIMEOUT_SECONDS", "5"))
        except Exception:
            git_tmo = 5.0

    files = _collect_repo_files(repo_root, timeout_seconds=git_tmo)
    files = _force_include(repo_root, files, include_paths)

    # Sort for determinism
    rel_files = sorted(set(files), key=lambda p: str(p))

    # Default timeout from env or 15s (reduced from 30s)
    tmo = timeout_seconds
    if tmo is None:
        try:
            tmo = float(os.environ.get("CMUX_ZIP_TIMEOUT_SECONDS", "15"))
        except Exception:
            tmo = 15.0

    # Try fast path with system `zip` and our list
    if rel_files:
        print(f"Collected {len(rel_files)} files from git")
        if _zip_with_cli(repo_root, out_zip, rel_files, tmo):
            return

    # If we couldn't get a file list quickly, try recursive CLI zip with excludes
    print("Trying fallback zip method...")
    if _zip_whole_tree_with_cli(repo_root, out_zip, tmo):
        return

    # Fall back to Python ZIP (no compression)
    print("Using Python zipfile as last resort...")
    if not rel_files:
        # As a last resort, include only forced includes
        rel_files = []
        if include_paths:
            for inc in include_paths:
                p = repo_root / inc
                if p.is_file():
                    try:
                        rel_files.append(p.relative_to(repo_root))
                    except Exception:
                        pass
    _zip_with_python(repo_root, out_zip, rel_files)

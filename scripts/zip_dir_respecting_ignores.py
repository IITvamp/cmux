# /// script
# dependencies = [
#   "pathspec>=0.12.1",
# ]
# ///

#!/usr/bin/env python3

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Set

import pathspec


def read_ignore_file(path: Path) -> List[str]:
    if not path.is_file():
        return []
    lines: List[str] = []
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = raw.strip("\n")
        if not s or s.lstrip().startswith("#"):
            continue
        lines.append(s)
    return lines


def dockerignore_spec(root: Path) -> Optional[pathspec.PathSpec]:
    lines = read_ignore_file(root / ".dockerignore")
    if not lines:
        return None
    # Dockerignore uses gitwildmatch-like semantics
    return pathspec.PathSpec.from_lines("gitwildmatch", lines)


def git_available() -> bool:
    try:
        subprocess.run(["git", "--version"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def inside_git_work_tree(root: Path) -> bool:
    try:
        r = subprocess.run(["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"], check=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        return r.stdout.strip() == "true"
    except Exception:
        return False


def git_ls_included_paths(root: Path) -> List[Path]:
    # List tracked + untracked (not ignored) files, relative to root
    r = subprocess.run(
        [
            "git",
            "-C",
            str(root),
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    out = r.stdout
    rels: List[Path] = []
    if out:
        for part in out.split(b"\x00"):
            if not part:
                continue
            rels.append(Path(part.decode("utf-8", errors="ignore")))
    return rels


def fallback_walk_all_files(root: Path) -> List[Path]:
    files: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip VCS dir
        if ".git" in dirnames:
            dirnames.remove(".git")
        for name in filenames:
            p = Path(dirpath) / name
            try:
                rel = p.relative_to(root)
            except ValueError:
                continue
            files.append(rel)
    return files


def gitignore_root_spec(root: Path) -> Optional[pathspec.PathSpec]:
    lines = read_ignore_file(root / ".gitignore")
    if not lines:
        return None
    return pathspec.PathSpec.from_lines("gitwildmatch", lines)


def filter_with_specs(paths: Iterable[Path], root: Path, specs: List[Optional[pathspec.PathSpec]]) -> List[Path]:
    filtered: List[Path] = []
    # Compose ignore behavior: excluded if any spec matches path
    for rel in paths:
        s_rel = str(rel).replace("\\", "/")
        ignored = False
        for spec in specs:
            if spec and spec.match_file(s_rel):
                ignored = True
                break
        if not ignored:
            filtered.append(rel)
    return filtered


def zip_paths(root: Path, rel_paths: Iterable[Path], output_zip: Path) -> None:
    from zipfile import ZipFile, ZIP_DEFLATED

    output_zip.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output_zip, "w", compression=ZIP_DEFLATED) as zf:
        for rel in rel_paths:
            abs_path = root / rel
            # Ensure file exists (skip dangling symlinks etc.)
            if not abs_path.is_file():
                # Allow symlinks to files
                if abs_path.is_symlink():
                    try:
                        if not abs_path.resolve().is_file():
                            continue
                    except Exception:
                        continue
                else:
                    continue
            zf.write(abs_path, arcname=str(rel).replace("\\", "/"))


def main() -> None:
    ap = argparse.ArgumentParser(description="Zip a directory respecting .gitignore and .dockerignore")
    ap.add_argument("-d", "--dir", default=".", help="Directory to zip (default: .)")
    ap.add_argument("-o", "--output", default=None, help="Output zip file path (default: <dir>.zip in CWD)")
    ap.add_argument("--no-git", action="store_true", help="Do not use git to compute ignored files")
    ap.add_argument(
        "-I",
        "--include",
        action="append",
        default=[],
        help=(
            "Additional paths/patterns to force-include (gitwildmatch). "
            "Can be passed multiple times. Example: --include Dockerfile.sh"
        ),
    )
    args = ap.parse_args()

    root = Path(args.dir).resolve()
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        output_zip = Path(args.output).resolve()
    else:
        name = root.name if root.name else "archive"
        output_zip = Path.cwd() / f"{name}.zip"

    # Build ignore specs
    dspec = dockerignore_spec(root)

    rel_paths: List[Path]
    used_git = False
    if not args.no_git and git_available() and inside_git_work_tree(root):
        rel_paths = git_ls_included_paths(root)
        used_git = True
    else:
        rel_paths = fallback_walk_all_files(root)
        gspec = gitignore_root_spec(root)
        # Apply .gitignore root and .dockerignore (if present)
        rel_paths = filter_with_specs(rel_paths, root, [gspec, dspec])

    # If git was used, still apply dockerignore filter
    if used_git and dspec is not None:
        rel_paths = filter_with_specs(rel_paths, root, [dspec])

    # Apply allowlist includes: force-include files matching provided patterns
    # Optimize to avoid walking the entire tree when possible.
    includes: List[str] = args.include or []
    if includes:
        def has_glob_chars(s: str) -> bool:
            return any(ch in s for ch in "*?[]")

        for inc in includes:
            # Fast-path: direct relative file path without glob characters
            if not has_glob_chars(inc):
                p = (root / inc).resolve()
                try:
                    rel = p.relative_to(root)
                except Exception:
                    # If outside root or invalid, skip
                    continue
                if p.is_file() or (p.is_symlink() and p.resolve().is_file()):
                    if rel not in rel_paths:
                        rel_paths.append(rel)
                continue

            # Glob path: use rglob limited to the provided pattern
            # Note: Path.rglob supports ** and * which covers common cases
            for match in root.rglob(inc):
                if match.is_file() or (match.is_symlink() and match.resolve().is_file()):
                    try:
                        rel = match.relative_to(root)
                    except Exception:
                        continue
                    if rel not in rel_paths:
                        rel_paths.append(rel)

    # Exclude the output zip if it is within root
    try:
        out_rel = output_zip.relative_to(root)
        rel_paths = [p for p in rel_paths if p != out_rel]
    except ValueError:
        pass

    # Sort for determinism
    rel_paths = sorted(set(rel_paths), key=lambda p: str(p))

    zip_paths(root, rel_paths, output_zip)
    print(f"Zipped {len(rel_paths)} files from {root} -> {output_zip}")


if __name__ == "__main__":
    main()

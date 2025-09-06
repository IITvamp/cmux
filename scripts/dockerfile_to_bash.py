# /// script
# dependencies = []
# ///

#!/usr/bin/env python3

import argparse
import json
import os
import re
import shlex
from pathlib import Path
from typing import List, Tuple


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Convert a Dockerfile into a bash script")
    p.add_argument("-i", "--input", default="Dockerfile", help="Path to Dockerfile")
    p.add_argument("-o", "--output", default=None, help="Path to output .sh file (default: <input>.sh)")
    return p.parse_args()


def is_heredoc_run(line: str) -> Tuple[bool, str]:
    m = re.match(r"^\s*RUN\s+<<-?['\"]?([A-Za-z0-9_]+)['\"]?\s*$", line)
    return (bool(m), m.group(1) if m else "")


def split_json_array(text: str) -> List[str]:
    try:
        arr = json.loads(text)
        if isinstance(arr, list) and all(isinstance(x, str) for x in arr):
            return arr
    except Exception:
        pass
    return []


def render_run_block(commands: str) -> str:
    # Note: do not indent heredoc content to keep it exact
    # Export DESTDIR and CURRENT_WORKDIR so they're available in the subshell
    return (
        "if [ \"$EXECUTE\" = \"1\" ] && [ \"$ALLOW_DANGEROUS\" = \"1\" ]; then\n"
        "  export DESTDIR=\"$DESTDIR\" CURRENT_WORKDIR=\"$CURRENT_WORKDIR\"\n"
        "  bash -euo pipefail <<'__CMUX_RUN__'\n"
        "cd \"${DESTDIR}${CURRENT_WORKDIR}\"\n"
        f"{commands.rstrip()}\n"
        "__CMUX_RUN__\n"
        "else\n"
        "  cat <<'__CMUX_SHOW__'\n"
        f"{commands.rstrip()}\n"
        "__CMUX_SHOW__\n"
        "fi\n"
    )


def main() -> None:
    args = parse_args()
    in_path = Path(args.input).resolve()
    if not in_path.exists():
        raise SystemExit(f"Dockerfile not found: {in_path}")

    out_path = Path(args.output) if args.output else Path(str(in_path) + ".sh")
    build_context = in_path.parent.resolve()

    with in_path.open("r", encoding="utf-8") as f:
        lines = f.read().splitlines()

    output: List[str] = []

    # Header of generated script
    output.append("#!/usr/bin/env bash")
    output.append("set -euo pipefail")
    output.append("")
    output.append("# Generated from Dockerfile by scripts/dockerfile_to_bash.py")
    output.append("# Safety:")
    output.append("# - By default, RUN blocks are NOT executed.")
    output.append("#   To execute them, set EXECUTE=1 ALLOW_DANGEROUS=1.")
    output.append("# - Filesystem operations write into DESTDIR, not host root.")
    output.append("")
    output.append("EXECUTE=${EXECUTE:-0}")
    output.append("ALLOW_DANGEROUS=${ALLOW_DANGEROUS:-0}")
    # Resolve build context at runtime to avoid embedding host paths
    output.append("BUILD_CONTEXT=${BUILD_CONTEXT:-$(pwd)}")
    output.append("DESTDIR=${DESTDIR:-$(pwd)/_dockerfile_rootfs}")
    output.append("mkdir -p \"$DESTDIR\"")
    output.append("CURRENT_WORKDIR=/")
    output.append("")
    output.append("do_safe() { echo \"+ $*\"; if [ \"$EXECUTE\" = \"1\" ]; then eval \"$@\"; fi; }")
    output.append("")

    acc = ""
    i = 0
    in_heredoc = False
    heredoc_tag = ""
    heredoc_lines: List[str] = []

    def flush(line: str) -> None:
        nonlocal output
        line = line.strip()
        if not line or line.startswith("#"):
            output.append(line)
            return

        # Split instruction and rest
        parts = line.split(None, 1)
        instr = parts[0].upper()
        rest = parts[1] if len(parts) > 1 else ""

        if instr == "FROM":
            output.append(f"# FROM {rest}")
            output.append("# (New stage begins)")
            output.append("CURRENT_WORKDIR=/")
            return

        if instr == "ARG":
            output.append(f"# ARG {rest}")
            if "=" in rest:
                key, val = rest.split("=", 1)
                output.append(f"do_safe export {key}={shlex.quote(val)}")
            else:
                output.append(f"do_safe export {rest}=\"\"")
            return

        if instr == "ENV":
            output.append(f"# ENV {rest}")
            if "=" in rest:
                for tok in shlex.split(rest):
                    if "=" in tok:
                        output.append(f"do_safe export {tok}")
            else:
                toks = shlex.split(rest)
                if len(toks) >= 2:
                    k, v = toks[0], " ".join(toks[1:])
                    output.append(f"do_safe export {k}={shlex.quote(v)}")
            return

        if instr == "WORKDIR":
            wd = rest.strip()
            output.append(f"# WORKDIR {wd}")
            output.append(f"CURRENT_WORKDIR=\"{wd}\"")
            output.append("do_safe mkdir -p \"$DESTDIR$CURRENT_WORKDIR\"")
            # Symlink absolute workdir path to the DESTDIR-backed path for commands that use absolute paths
            output.append("do_safe ln -sfn \"$DESTDIR$CURRENT_WORKDIR\" \"$CURRENT_WORKDIR\" 2>/dev/null || true")
            output.append("do_safe cd \"$DESTDIR$CURRENT_WORKDIR\"")
            return

        if instr in ("COPY", "ADD"):
            raw = rest
            # Extract flags like --from=builder --chown=...
            flags: List[str] = []
            toks = shlex.split(raw)
            while toks and toks[0].startswith("--"):
                flags.append(toks.pop(0))
            output.append(f"# {instr} {' '.join(flags)} {' '.join(toks)}".rstrip())

            if any(f.startswith("--from=") for f in flags):
                output.append("# Skipping stage copy on host (requires image layer)")
                return

            # Parse sources + dest
            srcs: List[str] = []
            dest: str = ""
            rest_after_flags = " ".join(toks)
            rest_after_flags_stripped = rest_after_flags.strip()
            if rest_after_flags_stripped.startswith("["):
                arr = split_json_array(rest_after_flags_stripped)
                if len(arr) >= 2:
                    dest = arr[-1]
                    srcs = arr[:-1]
            else:
                if len(toks) >= 2:
                    dest = toks[-1]
                    srcs = toks[:-1]

            if not dest or not srcs:
                output.append(f"# (Skipping {instr}: could not parse sources/dest)")
                return

            output.append(f"# {instr} -> copying into '{dest}' under DESTDIR")
            # Respect --parents flag if present
            has_parents = any(f == "--parents" for f in flags)
            # If multiple sources or trailing slash or --parents, ensure dest directory; else create parent directory
            dest_is_dir = dest.endswith("/") or len(srcs) > 1 or has_parents
            plain_target = dest if dest_is_dir else (dest.rsplit("/", 1)[0] if "/" in dest else "/")
            # Anchor destination into DESTDIR and CURRENT_WORKDIR when relative
            if dest.startswith("/"):
                mkdir_target = f"$DESTDIR{plain_target}"
                dest_path = f"$DESTDIR{dest}"
            else:
                # ensure leading separator between CURRENT_WORKDIR and target
                mkdir_target = f"$DESTDIR$CURRENT_WORKDIR/{plain_target}" if plain_target != "/" else f"$DESTDIR$CURRENT_WORKDIR"
                dest_path = f"$DESTDIR$CURRENT_WORKDIR/{dest}"
            output.append(f"do_safe mkdir -p \"{mkdir_target}\" 2>/dev/null || true")
            # Helper to format the source path: if it contains glob characters,
            # do not quote it so the shell can expand; otherwise, quote safely.
            def format_src(s: str) -> str:
                if any(ch in s for ch in ['*', '?', '[']):
                    return f"$BUILD_CONTEXT/{s}"
                return shlex.quote(f"$BUILD_CONTEXT/{s}")

            for s in srcs:
                src_arg = format_src(s)
                if has_parents:
                    output.append(f"do_safe cp --parents -R {src_arg} \"{dest_path}\"")
                else:
                    output.append(f"do_safe cp -R {src_arg} \"{dest_path}\"")
            return

        if instr == "RUN":
            # Drop any leading BuildKit flags without altering quoting
            r = re.sub(r"^\s*(?:--\S+\s+)+", "", rest)
            output.append(render_run_block(r))
            return

        if instr in {
            "USER",
            "CMD",
            "ENTRYPOINT",
            "EXPOSE",
            "VOLUME",
            "LABEL",
            "SHELL",
            "ONBUILD",
            "STOPSIGNAL",
            "HEALTHCHECK",
            "MAINTAINER",
        }:
            output.append(f"# {instr} {rest}")
            return

        output.append(f"# (Unrecognized) {line}")

    while i < len(lines):
        raw = lines[i]
        i += 1

        if in_heredoc:
            heredoc_lines.append(raw)
            # Detect terminator line matching tag, allowing leading spaces
            if re.match(rf"^\s*{re.escape(heredoc_tag)}\s*$", raw):
                # Remove the terminator from content
                content = "\n".join(heredoc_lines[:-1])
                output.append(render_run_block(content))
                in_heredoc = False
                heredoc_tag = ""
                heredoc_lines = []
            continue

        line = raw.rstrip()
        # Handle line continuations ending with backslash (not heredoc)
        if line.endswith("\\"):
            acc += line[:-1] + " "
            continue

        # Detect heredoc RUN
        is_hd, tag = is_heredoc_run((acc + line).strip())
        if is_hd:
            in_heredoc = True
            heredoc_tag = tag
            heredoc_lines = []
            acc = ""
            continue

        if acc:
            line = acc + line
            acc = ""
        flush(line)

    if acc:
        flush(acc)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        f.write("\n".join(output) + "\n")

    # Make executable
    os.chmod(out_path, 0o755)
    print(f"Generated: {out_path}")


if __name__ == "__main__":
    main()

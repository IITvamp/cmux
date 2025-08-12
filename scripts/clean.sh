#!/usr/bin/env bash
set -euo pipefail

# Fast cleanup of all node_modules directories in the repo.
# Works from any subdirectory. Uses -prune to avoid descending into node_modules.

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  ROOT="$(git rev-parse --show-toplevel)"
else
  # Fallback: assume this script lives in scripts/ under the repo root
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

cd "$ROOT"

echo "Searching for node_modules under: $ROOT"

# Parallelism can be tuned via CMUX_CLEAN_PARALLELISM env var (default 8)
PARALLELISM="${CMUX_CLEAN_PARALLELISM:-8}"

delete_with_paths() {
  if [ -t 0 ]; then
    echo "No node_modules directories found."
    return 0
  fi
  echo "Deleting node_modules (parallelism=$PARALLELISM)..."
  time xargs -0 -n 1 -P "$PARALLELISM" rm -rf --
}

if command -v rg >/dev/null 2>&1; then
  # Fast path: use ripgrep to find package.json files (respects .gitignore so it won't descend into node_modules),
  # then map to sibling node_modules directories and delete those that exist.
  # This avoids scanning into large node_modules trees and is typically very fast.
  rg --files --hidden -g '*/package.json' -0 2>/dev/null \
    | while IFS= read -r -d '' pkg; do
        dir="$(dirname "$pkg")"
        nm="$dir/node_modules"
        if [ -d "$nm" ]; then
          printf '%s\0' "$nm"
        fi
      done \
    | delete_with_paths
else
  # Fallback: portable find with -prune to avoid descending into node_modules
  if ! find . -name node_modules -type d -prune -print -quit | grep -q .; then
    echo "No node_modules directories found."
    exit 0
  fi
  echo "Deleting node_modules (parallelism=$PARALLELISM)..."
  find . -name node_modules -type d -prune -print0 \
    | xargs -0 -n 1 -P "$PARALLELISM" rm -rf --
fi

echo "Done."

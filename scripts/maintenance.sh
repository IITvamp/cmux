#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Updating repository from main branch..."
if ! command -v git >/dev/null 2>&1; then
  echo "git is required to run this script" >&2
  exit 1
fi

if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "scripts/maintenance.sh must be run within the cmux repository" >&2
  exit 1
fi

CURRENT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "scripts/maintenance.sh must be run from the main branch (current: $CURRENT_BRANCH)" >&2
  exit 1
fi

git -C "$REPO_ROOT" pull --ff-only origin main

NO_CACHE=false

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --no-cache)
      NO_CACHE=true
      shift
      ;;
  esac
done

./scripts/clean.sh

if [ "$NO_CACHE" = true ]; then
  docker build -t cmux-worker:0.0.1 . --no-cache &
else
  docker build -t cmux-worker:0.0.1 . &
fi

bun i --frozen-lockfile &

(cd apps/server/native/core && cargo build --release) &

wait

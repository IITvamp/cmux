#!/bin/bash
set -euo pipefail

# Use development env for local packaging
ENV_FILE="../../.env"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

STARTED_WWW=false

# Start the www dev server on :9779 if not already running
if ! curl -fsS "http://localhost:9779/api/doc" >/dev/null 2>&1; then
  echo "Starting www dev server on :9779... (logs: logs/www-build.log)"
  (cd "$ROOT_DIR/apps/www" && bun run dev > "$LOG_DIR/www-build.log" 2>&1) &
  WWW_PID=$!
  STARTED_WWW=true

  # Ensure cleanup on exit
  cleanup() {
    if [[ "${STARTED_WWW}" == "true" ]] && [[ -n "${WWW_PID:-}" ]]; then
      kill "$WWW_PID" 2>/dev/null || true
    fi
  }
  trap cleanup EXIT INT TERM

  # Wait for server readiness
  echo -n "Waiting for :9779 to be ready"
  for i in {1..120}; do
    if curl -fsS "http://localhost:9779/api/doc" >/dev/null 2>&1; then
      echo " - ready"
      break
    fi
    echo -n "."
    sleep 0.5
    if [[ $i -eq 120 ]]; then
      echo
      echo "Timed out waiting for :9779 server to start" >&2
      exit 1
    fi
  done
else
  echo ":9779 already running; reusing existing server"
fi

# Build the Electron app with dev env
(cd "$ROOT_DIR/apps/client" && bun run build:mac:workaround -- --env-file "$ENV_FILE")

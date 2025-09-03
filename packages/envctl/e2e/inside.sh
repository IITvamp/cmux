#!/usr/bin/env bash
set -euo pipefail

echo "Bun: $(bun --version)"
echo "Node: $(node --version)"
echo "Shell: $SHELL"

SOCK_PATH=$(bun packages/envd/src/index.ts --print-socket)
echo "Socket will be at: $SOCK_PATH"

echo "Starting envd daemon in background..."
XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/tmp} nohup bun packages/envd/src/index.ts >/tmp/envd.log 2>&1 &
DAEMON_PID=$!
echo "envd PID: $DAEMON_PID"

# Wait for socket to appear
for i in $(seq 1 100); do
  if [ -S "$SOCK_PATH" ]; then
    break
  fi
  sleep 0.05
done

if [ ! -S "$SOCK_PATH" ]; then
  echo "Daemon failed to create socket at $SOCK_PATH" >&2
  tail -n +1 /tmp/envd.log || true
  exit 1
fi

echo "Daemon is up. Basic ping..."
bun packages/envctl/src/index.ts ping | grep -q pong

echo "Test: set FOO=bar then refresh in bash..."
bun packages/envctl/src/index.ts set FOO=bar

bash -lc '
  set -e
  function envctl(){ bun packages/envctl/src/index.ts "$@"; }
  eval "$(bun packages/envctl/src/index.ts hook bash)"
  __envctl_refresh
  if [ "$FOO" != "bar" ]; then
    echo "Expected FOO=bar, got: $FOO" >&2
    exit 1
  fi
'

echo "OK: FOO visible"

echo "Test: unset FOO then refresh..."
bun packages/envctl/src/index.ts unset FOO

bash -lc '
  set -e
  function envctl(){ bun packages/envctl/src/index.ts "$@"; }
  eval "$(bun packages/envctl/src/index.ts hook bash)"
  __envctl_refresh
  if [ -n "${FOO:-}" ]; then
    echo "Expected FOO to be unset, got: $FOO" >&2
    exit 1
  fi
'

echo "OK: FOO unset"

echo "Test: load .env from stdin (A, B with spaces, C quoted)"
printf "A=1\nB=two words\nC=\"quoted value\"\n" | bun packages/envctl/src/index.ts load -

bash -lc '
  set -e
  function envctl(){ bun packages/envctl/src/index.ts "$@"; }
  eval "$(bun packages/envctl/src/index.ts hook bash)"
  __envctl_refresh
  test "$A" = "1"
  test "$B" = "two words"
  test "$C" = "quoted value"
'

echo "OK: load from stdin works"

echo "Stopping daemon..."
kill "$DAEMON_PID" || true
sleep 0.1

echo "All e2e assertions passed."

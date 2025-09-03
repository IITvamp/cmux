# @cmux/envd

A per‑user environment daemon that keeps a simple in‑memory map of environment variables and a change history (with a generation counter). Clients like `envctl` connect over a Unix domain socket to set/unset keys or fetch a shell script that applies only the changes since a given generation.

- Socket: `${XDG_RUNTIME_DIR:-/tmp}/cmux-envd/envd.sock`
- Platform: Linux/macOS (Unix domain sockets)

## Quick start (in this repo)

Start the daemon (default command is `start`):

```bash
bun packages/envd/src/index.ts
```

Print the socket path and exit:

```bash
bun packages/envd/src/index.ts --print-socket
```

Show usage:

```bash
bun packages/envd/src/index.ts --help
```

## Build the JS binary

```bash
pnpm -F @cmux/envd build
# Then run
node packages/envd/dist/index.js
```

When published, the package exposes a `bin` named `envd` pointing to `dist/index.js`.

## How it works

- State: `{ gen: number, map: Map<string,string>, history: ChangeEvent[] }`
- API (over the socket, JSON per line):
  - `ping`, `status`, `get`, `list`
  - `set`, `unset`, `load { entries }`
  - `export { shell, since? }` → returns a shell snippet that applies only the changes after `since`
- Generation (`gen`) increments on every `set`/`unset`/`load` change and is used by clients to compute deltas.

## Clients

Use `envctl` to interact from your shell:

```bash
# In one terminal, run the daemon
bun packages/envd/src/index.ts

# In another terminal, set a variable
bun packages/envctl/src/index.ts set FOO=bar

# Install and use the hook (bash example)
export -f envctl 2>/dev/null || true
function envctl(){ bun packages/envctl/src/index.ts "$@"; }
eval "$(envctl hook bash)"
```

## Configuration

- `XDG_RUNTIME_DIR`: Base directory for the socket. Defaults to `/tmp` if unset.
- The daemon creates `${XDG_RUNTIME_DIR}/cmux-envd/` and writes `envd.sock` and a convenience `envd.pid`.

## Notes

- The server listens only on a Unix domain socket, not TCP.
- No authentication is performed; rely on per‑user runtime directories for isolation.
- State is in‑memory and reset when the process exits.

# @cmux/envctl

A tiny CLI client that talks to the per‑user environment daemon (`envd`) over a Unix domain socket and applies env var changes to your shell on demand.

- Socket: `${XDG_RUNTIME_DIR:-/tmp}/cmux-envd/envd.sock`
- Works with bash, zsh, and fish via a small shell hook

## Quick start (in this repo)

1. Start the daemon in another terminal:

```bash
bun packages/envd/src/index.ts
```

2. Use `envctl` directly from source:

```bash
# Set and unset
bun packages/envctl/src/index.ts set FOO=bar
bun packages/envctl/src/index.ts unset FOO

# List and get
bun packages/envctl/src/index.ts list
bun packages/envctl/src/index.ts get FOO
```

3. Install the auto‑refresh hook in your current shell:

- bash
  ```bash
  eval "$(bun packages/envctl/src/index.ts hook bash)"
  ```
- zsh
  ```zsh
  eval "$(bun packages/envctl/src/index.ts hook zsh)"
  ```
- fish
  ```fish
  bun packages/envctl/src/index.ts hook fish | source
  ```

With the hook loaded, each prompt refresh (and on DEBUG for bash / preexec for zsh) will pull and apply only the delta of env var changes since the last refresh.

## Build the JS CLI

```bash
pnpm -F @cmux/envctl build
# Then run
node packages/envctl/dist/index.js list
```

The package exposes a `bin` named `envctl` that points to `dist/index.js` when published.

## Commands

```
Usage: envctl <command>

Commands:
  set KEY=VAL            Set a variable
  unset KEY              Unset a variable
  get KEY                Get a variable
  list                   List all variables
  load [FILE|-]          Load .env from file or stdin
  export <bash|zsh|fish> [--since GEN]
                         Print export/unset script diff and bump gen
  hook <bash|zsh|fish>   Print shell hook code
  status                 Show daemon status
  ping                   Ping daemon
```

Notes:

- `load` accepts simple `.env` lines (with optional quotes or `export` prefix). Invalid keys are ignored.
- `export` is typically used by the hook; it prints only the changes since `--since GEN` and updates the generation.

## Examples

- One‑shot apply without installing a hook (bash/zsh):

  ```bash
  eval "$(bun packages/envctl/src/index.ts export bash)"
  ```

- Load a file then refresh the current shell:
  ```bash
  bun packages/envctl/src/index.ts load .env
  eval "$(bun packages/envctl/src/index.ts export zsh)"
  ```

## E2E in Docker (Linux, Bun)

Run the repository’s e2e against `oven/bun:1`:

```bash
docker run --rm -t \
  -e XDG_RUNTIME_DIR=/tmp \
  -v "$(pwd)":/work \
  -w /work \
  oven/bun:1 \
  bash -lc "bash packages/envctl/e2e/inside.sh"
```

## Troubleshooting

- Ensure the daemon is running and the socket exists at `${XDG_RUNTIME_DIR:-/tmp}/cmux-envd/envd.sock`.
- If the hook seems inactive, re‑`eval` the `hook` output in the current shell session.

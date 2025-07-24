#!/bin/bash

set -e

# first, build vite app
(cd apps/client && VITE_CONVEX_URL=http://localhost:9777 bun run build)

cp -r ./apps/client/dist ./packages/cmux/public

# deno compile -A --unstable-detect-cjs --unstable-node-globals --unstable-bare-node-builtins --unstable-sloppy-imports -o cmux-cli packages/cmux/src/cli.ts
# bun build packages/cmux/src/cli.ts --compile --outfile cmux-cli
#!/bin/bash

set -e

# first, build vite app
# (cd apps/client && VITE_CONVEX_URL=http://localhost:9777 bun run build)

cp -r ./apps/client/dist ./packages/cmux/public

# deno compile -A --unstable-detect-cjs --unstable-node-globals --unstable-bare-node-builtins --unstable-sloppy-imports -o cmux-cli packages/cmux/src/cli.ts
# bun build packages/cmux/src/cli.ts --compile --outfile cmux-cli

# copy the following files to /tmp/cmux-convex and then zip it:
# packages/convex/convex/*
# packages/convex/package.json

# Create temporary directory and copy convex files
mkdir -p /tmp/cmux-convex
cp -r packages/convex/convex/* /tmp/cmux-convex/
cp packages/convex/package.json /tmp/cmux-convex/

# Create zip archive
cd /tmp
zip -r cmux-convex.zip cmux-convex/
cd -

mv /tmp/cmux-convex.zip ./packages/cmux/public/convex.zip

bun build packages/cmux/src/cli.ts --compile --outfile cmux-cli

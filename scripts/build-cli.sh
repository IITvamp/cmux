#!/bin/bash

set -e

# first, build vite app
# (cd apps/client && VITE_CONVEX_URL=http://localhost:9777 bun run build)

source .env.local

echo $CONVEX_INSTANCE_SECRET

cp -r ./apps/client/dist ./packages/cmux/public

# deno compile -A --unstable-detect-cjs --unstable-node-globals --unstable-bare-node-builtins --unstable-sloppy-imports -o cmux-cli packages/cmux/src/cli.ts
# bun build packages/cmux/src/cli.ts --compile --outfile cmux-cli

# Copy everything we need to run the cli

mkdir -p ./packages/cmux/src/convex/convex-bundle

cp -r packages/convex/convex ./packages/cmux/src/convex/convex-bundle
cp packages/convex/package.json ./packages/cmux/src/convex/convex-bundle/
bun build ./packages/cmux/node_modules/convex/dist/cli.bundle.cjs --outdir ./packages/cmux/src/convex/convex-bundle/convex-cli-dist --outfile convex-cli.cjs --target bun --minify

./packages/cmux/src/convex/convex-bundle/convex-local-backend &

# wait for the backend to be ready
sleep 5

bun run ./packages/cmux/src/convex/convex-bundle/convex-cli-dist/convex-cli.js deploy

# bun run 

# then bunx convex dev

# Build the convex cli

# bun build packages/cmux/src/cli.ts --compile --outfile cmux-cli



# copy the following files to /tmp/cmux-convex and then zip it:
# packages/convex/convex/*
# packages/convex/package.json

# Create temporary directory and copy convex files
# mkdir -p /tmp/cmux-convex
# cp -r packages/convex/convex/* /tmp/cmux-convex/
# cp packages/convex/package.json /tmp/cmux-convex/

# # Create zip archive
# cd /tmp
# zip -r cmux-convex.zip cmux-convex/
# cd -

# mv /tmp/cmux-convex.zip ./packages/cmux/src/convex/convex-dir.zip

# bun build packages/cmux/src/cli.ts --compile --outfile cmux-cli

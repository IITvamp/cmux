#!/bin/bash

set -e

# first, build vite app
(cd apps/client && VITE_CONVEX_URL=http://localhost:9777 bun run build)

cp -r ./apps/client/dist ./packages/cmux/public/client

# then, copy to cli public dir
# bun run build

# then, copy the vite app to the cli
cp -r apps/client/dist/client/ public/

# then, build the cli

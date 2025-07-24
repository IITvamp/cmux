#!/bin/bash

set -e

# first, build vite app
(cd apps/client && VITE_CONVEX_URL=http://localhost:9777 bun run build)

cp -r ./apps/client/dist ./packages/cmux/public

#!/bin/bash
set -euo pipefail

# Bump version
npm version patch --no-git-tag-version --prefix packages/cmux && \
# Build CLI
./scripts/build-cli.ts && \
# Commit changes
git add -A && \
git commit -m "v$(node -p "require('./packages/cmux/package.json').version")" && \
# Push to main
git push origin main && \
# Publish to npm
(cd packages/cmux && npm run publish-cli)
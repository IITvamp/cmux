#!/bin/bash
set -euo pipefail

# Ensure there are no staged or unstaged changes at the start
git update-index -q --refresh
if ! git diff-index --quiet HEAD --; then
  echo "Error: You have uncommitted changes. Please commit or stash them before running this script."
  exit 1
fi

# Save current HEAD for rollback
START_COMMIT=$(git rev-parse HEAD)

undo() {
  echo "Rolling back to original state..."
  git reset --hard "$START_COMMIT"
  git clean -fd
}

trap undo ERR

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
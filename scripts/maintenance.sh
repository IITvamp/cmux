#!/bin/bash

NO_CACHE=false

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --no-cache)
      NO_CACHE=true
      shift
      ;;
  esac
done

# Pull latest changes from main branch
echo "Pulling latest changes from main branch..."
git pull origin main

./scripts/clean.sh

if [ "$NO_CACHE" = true ]; then
  docker build -t cmux-worker:0.0.1 . --no-cache &
else
  docker build -t cmux-worker:0.0.1 . &
fi

bun i --frozen-lockfile &

(cd apps/server/native/core && cargo build --release) &

wait
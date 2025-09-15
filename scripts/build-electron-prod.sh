#!/bin/bash
set -euo pipefail

# Prefer production env for local packaging; fall back to .env if missing
ENV_FILE="../../.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="../../.env"
fi

(cd apps/client && bun run --env-file "$ENV_FILE" build:mac:workaround)

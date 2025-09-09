#!/bin/bash

# build the electron app
# (cd apps/client && bunx dotenv-cli -e ../../.env -- bun run build:mac:workaround)
bun run --env-file .env -F @cmux/client build:mac:workaround

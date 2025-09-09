#!/bin/bash

# build the electron app
(cd apps/client && bunx dotenv-cli -e ../../.env -- pnpm build:mac:workaround)

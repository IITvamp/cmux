#!/bin/bash

(cd apps/client && bunx dotenv-cli -e ../../.env -- bun run build:mac:workaround)

#!/bin/bash

(cd apps/client && bun run --env-file ../../.env build:mac:workaround)

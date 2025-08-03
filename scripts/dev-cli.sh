#!/bin/bash

FORCE_UPGRADE=true bun run --hot --define VERSION=0.0.0 packages/cmux/src/cli.ts "$@"
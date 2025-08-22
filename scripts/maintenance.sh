#!/bin/bash

docker build -t cmux-worker:0.0.1 . &
pnpm i --frozen-lockfile &

wait
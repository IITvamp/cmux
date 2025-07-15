#!/bin/sh

dockerd-entrypoint.sh &
wait-for-docker.sh
node /builtins/build/index.js
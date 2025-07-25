#!/bin/bash
set -e

# Docker Hub repository
REPO="lawrencecchen/cmux"

# Get version from argument or use 'latest'
VERSION=${1:-latest}

# Build first
echo "Building Docker image..."
./scripts/docker-build.sh ${VERSION}

echo "Pushing to Docker Hub..."
echo "Repository: ${REPO}"
echo "Version: ${VERSION}"

# Push the specific version
docker push ${REPO}:${VERSION}

# Also push latest tag
docker push ${REPO}:latest

echo "Successfully pushed to Docker Hub!"
echo "Users can now run: docker pull ${REPO}:latest"
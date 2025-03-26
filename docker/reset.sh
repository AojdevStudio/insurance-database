#!/bin/bash

# Navigate to project root
cd "$(dirname "$0")/.."

# Stop and remove containers, networks, and volumes
docker-compose down -v

# Remove any dangling images
docker image prune -f

# Start fresh containers
./docker/start.sh

echo "Environment reset successfully" 
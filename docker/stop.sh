#!/bin/bash

# Navigate to project root
cd "$(dirname "$0")/.."

# Stop containers
docker-compose down

echo "Containers stopped successfully" 
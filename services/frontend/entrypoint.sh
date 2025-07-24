#!/bin/sh
set -e

# Print environment for debugging
echo "Starting frontend service..."
echo "Environment: PORT=${PORT:-not set}"

# Use PORT from environment or default to 3000
PORT="${PORT:-3000}"
echo "Using port: $PORT"

# Start the static file server
exec serve -s build -l "$PORT"

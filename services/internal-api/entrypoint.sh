#!/bin/sh
set -e

# Print environment for debugging
echo "Starting internal-api service..."
echo "Environment: PORT=${PORT:-not set}"

# Use PORT from environment or default to 8000
PORT="${PORT:-8000}"
echo "Using port: $PORT"

# Start the FastAPI application with uvicorn
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

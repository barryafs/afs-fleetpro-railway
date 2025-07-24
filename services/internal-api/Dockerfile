FROM python:3.12-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -s /bin/bash appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port for the application
EXPOSE 8000

# Command to run the application
# Use shell form so that the PORT environment variable provided by Railway
# is expanded at runtime. Fallback to 8000 when PORT is not set (local dev).
CMD sh -c 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

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

# -----------------------------------------------------------------------------
# Runtime bootstrap
# -----------------------------------------------------------------------------
# Copy the Python bootstrap script that resolves the PORT env-var and starts
# the FastAPI application with uvicorn.  Using a Python script avoids the
# issue where Railway injected a literal “$PORT” into shell-based commands.
COPY start.py /start.py

# Create non-root user
RUN useradd -m -s /bin/bash appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port for the application
EXPOSE 8000

# ─────────────────────────────────────────────────────────────────────────────
# Launch service
# ─────────────────────────────────────────────────────────────────────────────
# Use the Python bootstrap script as the container entrypoint.  It prints
# debugging information, resolves the PORT value, then execs uvicorn.
ENTRYPOINT ["python", "/start.py"]

# --------------------------------------------------------------------
# Temporarily disable the container-level health check.
# Railway may be marking the deployment as failed before the app
# finishes initialising or before the framework has mounted the
# /health endpoint.  Commenting this out lets us confirm whether the
# health-check itself is the culprit.  Once the service deploys and
# runs correctly, we can re-enable (or adjust) the probe.
# --------------------------------------------------------------------
# HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
#     CMD curl -f http://localhost:8000/health || exit 1

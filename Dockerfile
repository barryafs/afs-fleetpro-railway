# Multi-stage Dockerfile for AFS FleetPro
# Builds all services in the monorepo
# Usage: docker build --build-arg SERVICE=<service-name> -t afs-fleetpro-<service-name> .

# -----------------------------------------------------------------------------
# Base Python stage - shared by all backend services
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS python-base

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install common system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# -----------------------------------------------------------------------------
# Base Node stage - for frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS node-base

WORKDIR /app

# Install common dependencies
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN adduser -D appuser

# -----------------------------------------------------------------------------
# Backend common dependencies
# -----------------------------------------------------------------------------
FROM python-base AS backend-deps

COPY services/common/requirements.txt /app/common-requirements.txt
RUN pip install --no-cache-dir -r /app/common-requirements.txt

# -----------------------------------------------------------------------------
# Internal API
# -----------------------------------------------------------------------------
FROM backend-deps AS internal-api-builder

COPY services/internal-api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/common/ /app/common/
COPY services/internal-api/ /app/

# -----------------------------------------------------------------------------
# Portal API
# -----------------------------------------------------------------------------
FROM backend-deps AS portal-api-builder

COPY services/portal-api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/common/ /app/common/
COPY services/portal-api/ /app/

# -----------------------------------------------------------------------------
# Comms API
# -----------------------------------------------------------------------------
FROM backend-deps AS comms-api-builder

COPY services/comms-api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/common/ /app/common/
COPY services/comms-api/ /app/

# -----------------------------------------------------------------------------
# Frontend builder
# -----------------------------------------------------------------------------
FROM node-base AS frontend-builder

# Copy package files
COPY services/frontend/package*.json /app/

# Install dependencies
RUN npm ci

# Copy source code
COPY services/frontend/ /app/

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Production stage - Python services
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS python-prod

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Copy from builder stage
ONBUILD COPY --from=internal-api-builder --chown=appuser:appuser /app /app
ONBUILD COPY --from=portal-api-builder --chown=appuser:appuser /app /app
ONBUILD COPY --from=comms-api-builder --chown=appuser:appuser /app /app

# Switch to non-root user
USER appuser

# Expose port for the application
EXPOSE 8000

# -----------------------------------------------------------------------------
# Production stage - Frontend
# -----------------------------------------------------------------------------
FROM nginx:alpine AS frontend-prod

# Copy built assets from builder stage
COPY --from=frontend-builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# -----------------------------------------------------------------------------
# Final stage - Select service based on build arg
# -----------------------------------------------------------------------------
FROM scratch AS final

ARG SERVICE=internal-api
ENV SERVICE_NAME=${SERVICE}

# Select the appropriate service
FROM ${SERVICE}-builder AS selected-builder
FROM ${SERVICE}-prod AS selected-prod

# Copy the built application
COPY --from=selected-builder /app /app

# Set the entrypoint based on service type
CMD if [ "$SERVICE_NAME" = "frontend" ]; then \
        nginx -g 'daemon off;'; \
    else \
        cd /app && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}; \
    fi

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD if [ "$SERVICE_NAME" = "frontend" ]; then \
            curl -f http://localhost:80/ || exit 1; \
        else \
            curl -f http://localhost:${PORT:-8000}/health || exit 1; \
        fi

# Multi-stage build for React frontend

# -----------------------------------------------------------------------------
# Build stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Production stage – use Node + `serve` instead of Nginx for Railway
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# Install lightweight static file server
RUN npm install -g serve

# Copy built static files from build stage
WORKDIR /app
COPY --from=build /app/build ./build

# Health check (optional: returns 200 if index.html is served)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:${PORT:-3000}/ || exit 1

# Expose port
EXPOSE 3000

# -----------------------------------------------------------------------------
# Runtime Entrypoint
# -----------------------------------------------------------------------------
# Use an entrypoint script so that the $PORT environment variable provided by
# Railway (or any other platform) is expanded at runtime in a shell context.
# This avoids issues where the variable is passed literally to `serve`.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Entrypoint launches the static server on the resolved port
ENTRYPOINT ["/entrypoint.sh"]

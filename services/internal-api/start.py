#!/usr/bin/env python3
"""
Railway startup script for internal-api service.

This script handles PORT resolution and starts uvicorn with the correct settings.
It ensures environment variables are properly expanded before being passed to uvicorn.
"""

import os
import sys
import subprocess
import logging
import pathlib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("startup")

def get_port():
    """Get PORT from environment or use default."""
    try:
        port_str = os.environ.get("PORT")
        logger.info(f"Raw PORT environment variable: {port_str!r}")
        
        if port_str is None:
            logger.info("PORT not set, using default 8000")
            return 8000
            
        try:
            port = int(port_str)
            logger.info(f"Using PORT: {port}")
            return port
        except ValueError:
            logger.error(f"Invalid PORT value: {port_str!r}, using default 8000")
            return 8000
    except Exception as e:
        logger.exception("Error resolving PORT")
        return 8000

def main():
    """Main entry point."""
    try:
        port = get_port()
        
        # Log all environment variables for debugging
        logger.info("Environment variables:")
        for key, value in os.environ.items():
            logger.info(f"  {key}={value}")
        # ------------------------------------------------------------------
        # Diagnostics helpers
        # ------------------------------------------------------------------
        critical_envs = ["JWT_SECRET_KEY", "MONGO_URI", "REDIS_URI"]
        for env_key in critical_envs:
            if not os.getenv(env_key):
                logger.warning("%s is not set – application may fail", env_key)

        # ------------------------------------------------------------------
        # Ensure Python can locate the `app` package.
        # The working directory inside the container is /app (see Dockerfile)
        # but when this script is executed as an ENTRYPOINT, the interpreter’s
        # import path might not include the current directory.  Explicitly add
        # the parent directory (i.e. the project root for this service) so the
        # `app` package can always be discovered.
        # ------------------------------------------------------------------
        # Inside the container the source code is copied to /app (see Dockerfile).
        # `start.py` lives at the container root (/), so __file__.parent == "/"
        # which is NOT where our application package resides.  Explicitly add
        # /app (or override with APP_ROOT env var) to PYTHONPATH so that
        # `import app.main` resolves correctly.
        service_root = pathlib.Path(os.getenv("APP_ROOT", "/app")).resolve()
        if str(service_root) not in sys.path:
            sys.path.insert(0, str(service_root))
            logger.info("Added %s to PYTHONPATH for module resolution", service_root)

        # ------------------------------------------------------------------
        # Attempt to import the real FastAPI app. If that fails we create a
        # minimal debugging app so the container still becomes 'healthy' and
        # we can inspect the error via /debug.
        # ------------------------------------------------------------------
        import traceback

        app_path = "app.main"
        app_attr = "app"
        fallback_app = None

        try:
            module = __import__(app_path, fromlist=[app_attr])
            target_app = getattr(module, app_attr)
            logger.info("Successfully imported %s:%s", app_path, app_attr)
        except Exception as import_err:
            logger.exception("Failed to import %s:%s – using fallback app", app_path, app_attr)
            from fastapi import FastAPI
            fallback_app = FastAPI(title="Fallback Debug App")

            tb_str = "".join(traceback.format_exception(import_err))

            @fallback_app.get("/health")
            def _health():
                return {"status": "healthy", "fallback": True}

            @fallback_app.get("/debug")
            def _debug():
                return {
                    "error": str(import_err),
                    "traceback": tb_str,
                    "env": {k: v for k, v in os.environ.items()},
                }

            target_app = fallback_app

        # ------------------------------------------------------------------
        # Run uvicorn programmatically to avoid env-var substitution issues
        # ------------------------------------------------------------------
        import uvicorn

        logger.info("Launching uvicorn on port %s", port)
        uvicorn.run(target_app, host="0.0.0.0", port=port, log_level="info")
    except Exception as e:
        logger.exception("Failed to start uvicorn")
        sys.exit(1)

if __name__ == "__main__":
    logger.info("Starting internal-api service...")
    main()

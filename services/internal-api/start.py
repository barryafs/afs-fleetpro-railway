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
        
        # Build the uvicorn command
        cmd = [
            "uvicorn",
            "app.main:app",
            "--host", "0.0.0.0",
            "--port", str(port)
        ]
        
        logger.info(f"Starting uvicorn with command: {' '.join(cmd)}")
        
        # Execute uvicorn
        os.execvp("uvicorn", cmd)
    except Exception as e:
        logger.exception("Failed to start uvicorn")
        sys.exit(1)

if __name__ == "__main__":
    logger.info("Starting internal-api service...")
    main()

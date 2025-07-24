#!/usr/bin/env node
/**
 * Railway startup script for frontend service.
 * 
 * This script handles PORT resolution and starts the static file server
 * with the correct settings. It ensures environment variables are properly
 * expanded before being passed to the serve command.
 */

const { spawn } = require('child_process');
const path = require('path');

// Configure logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - startup - ${message}`);
}

function getPort() {
  try {
    const portStr = process.env.PORT;
    log(`Raw PORT environment variable: ${JSON.stringify(portStr)}`);
    
    if (portStr === undefined || portStr === null) {
      log('PORT not set, using default 3000');
      return 3000;
    }
    
    try {
      const port = parseInt(portStr, 10);
      if (isNaN(port)) {
        log(`Invalid PORT value: ${JSON.stringify(portStr)}, using default 3000`);
        return 3000;
      }
      log(`Using PORT: ${port}`);
      return port;
    } catch (err) {
      log(`Error parsing PORT: ${err.message}, using default 3000`);
      return 3000;
    }
  } catch (err) {
    log(`Exception resolving PORT: ${err.message}`);
    return 3000;
  }
}

function main() {
  try {
    const port = getPort();
    
    // Log all environment variables for debugging
    log('Environment variables:');
    Object.entries(process.env).forEach(([key, value]) => {
      log(`  ${key}=${value}`);
    });
    
    // Build the serve command
    const serveArgs = ['-s', 'build', '-l', port.toString()];
    
    log(`Starting serve with command: serve ${serveArgs.join(' ')}`);
    
    // Execute serve using spawn
    const serveProcess = spawn('serve', serveArgs, {
      stdio: 'inherit'
    });
    
    serveProcess.on('error', (err) => {
      log(`Failed to start serve: ${err.message}`);
      process.exit(1);
    });
    
    serveProcess.on('close', (code) => {
      if (code !== 0) {
        log(`serve exited with code ${code}`);
        process.exit(code);
      }
    });
  } catch (err) {
    log(`Failed to start serve: ${err.message}`);
    process.exit(1);
  }
}

log('Starting frontend service...');
main();

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr() // Transform SVGs into React components
  ],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces for Docker/Railway
    port: 3000,
    strictPort: true, // Fail if port is already in use
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'build', // Output to 'build' directory to match React conventions
    sourcemap: true,
    chunkSizeWarningLimit: 1600, // Increase warning limit for larger chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code into separate chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@mui/x-data-grid'],
          'vendor-utils': ['axios', 'formik', 'yup', 'zustand', '@tanstack/react-query']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src') // Enable '@' imports
    }
  },
  // Handle environment variables for Railway
  define: {
    'process.env': {}
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@mui/material', 'axios'],
    exclude: ['@railway/cli'] // Exclude Railway CLI if it's used
  }
});

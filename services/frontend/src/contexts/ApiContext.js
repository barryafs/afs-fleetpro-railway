import React, { createContext, useContext } from 'react';
import axios from 'axios';

// Create API context
export const ApiContext = createContext(null);

/**
 * API Provider component
 * Sets up axios instances for each API and provides them through context
 */
export const ApiProvider = ({ children }) => {
  // Get API URLs from environment or fallback to defaults
  /**
   * Prefer URLs injected by Vite at build-time (import.meta.env),
   * fall back to the local defaults when running without env vars.
   *
   * NOTE:
   *  • VITE_INTERNAL_API_URL, VITE_PORTAL_API_URL, VITE_COMMS_API_URL
   *    are expected to be provided by Railway/Nixpacks or a local
   *    `.env` file in the frontend service.
   */
  const {
    VITE_INTERNAL_API_URL,
    VITE_PORTAL_API_URL,
    VITE_COMMS_API_URL
  } = import.meta.env;

  const internalApiUrl = VITE_INTERNAL_API_URL || 'http://localhost:5001';
  const portalApiUrl   = VITE_PORTAL_API_URL   || 'http://localhost:5002';
  const commsApiUrl    = VITE_COMMS_API_URL    || 'http://localhost:5003';

  // Create API instances
  const internalApi = axios.create({
    baseURL: internalApiUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const portalApi = axios.create({
    baseURL: portalApiUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const commsApi = axios.create({
    baseURL: commsApiUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth interceptor
  const addAuthHeader = (config) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  };

  internalApi.interceptors.request.use(addAuthHeader);
  portalApi.interceptors.request.use(addAuthHeader);
  commsApi.interceptors.request.use(addAuthHeader);

  return (
    <ApiContext.Provider value={{ internalApi, portalApi, commsApi }}>
      {children}
    </ApiContext.Provider>
  );
};

/**
 * Custom hook to use the API context
 * @returns {Object} API context value
 */
export const useApiContext = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiContext must be used within an ApiProvider');
  }
  return context;
};

export default ApiContext;

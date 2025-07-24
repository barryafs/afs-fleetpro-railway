import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Error handler for root level errors
const handleRootError = (error) => {
  console.error('Root level rendering error:', error);
  
  // Display a fallback UI when the root fails to render
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h2 style="color: #d32f2f;">Application Error</h2>
        <p>Sorry, the application failed to load. Please try refreshing the page.</p>
        <button onclick="window.location.reload()" style="padding: 8px 16px; background: #1a3c6e; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Refresh Page
        </button>
      </div>
    `;
  }
};

try {
  // Create root and render app
  const root = ReactDOM.createRoot(document.getElementById('root'));
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  handleRootError(error);
}

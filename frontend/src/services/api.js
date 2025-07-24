/**
 * AFS FleetPro API Service
 * 
 * Central service for all API interactions with the backend services.
 * Handles authentication, error handling, and provides methods for all CRUD operations.
 */

import axios from 'axios';

// Base URLs for the different services
// These are configured to work with Railway's production URLs
const INTERNAL_API_URL = import.meta.env.VITE_INTERNAL_API_URL || 'https://internal-api-production-3e4a.up.railway.app';
const CUSTOMER_API_URL = import.meta.env.VITE_CUSTOMER_API_URL || 'https://customer-api-production-3e4a.up.railway.app';
const PUBLIC_API_URL = import.meta.env.VITE_PUBLIC_API_URL || 'https://public-api-production-3e4a.up.railway.app';

// Create axios instances for each API
const internalApi = axios.create({
  baseURL: INTERNAL_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const customerApi = axios.create({
  baseURL: CUSTOMER_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const publicApi = axios.create({
  baseURL: PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
internalApi.interceptors.request.use(
  (config) => {
    // In a real app, get token from localStorage or auth context
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors
internalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with non-2xx status
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error:', error.request);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Apply the same interceptors to other API instances
customerApi.interceptors.request.use(internalApi.interceptors.request.handlers[0].fulfilled);
customerApi.interceptors.response.use(
  internalApi.interceptors.response.handlers[0].fulfilled,
  internalApi.interceptors.response.handlers[0].rejected
);

publicApi.interceptors.response.use(
  internalApi.interceptors.response.handlers[0].fulfilled,
  internalApi.interceptors.response.handlers[0].rejected
);

// Helper functions
const api = {
  /**
   * Parse comma-separated complaints into structured complaint objects
   * @param {string} complaintsText - Comma-separated complaints
   * @returns {Array} Array of complaint objects with IDs
   */
  parseMultipleComplaints: (complaintsText) => {
    if (!complaintsText) return [];
    
    // Split by commas, clean up whitespace, and filter out empty entries
    const complaints = complaintsText
      .split(',')
      .map(text => text.trim())
      .filter(text => text.length > 0);
    
    // Convert to structured objects with IDs
    return complaints.map((description, index) => ({
      id: index + 1,
      description,
      photos: []
    }));
  },

  /**
   * Format complaints array into comma-separated string for display
   * @param {Array} complaints - Array of complaint objects
   * @returns {string} Comma-separated complaints
   */
  formatComplaintsToString: (complaints) => {
    if (!complaints || !Array.isArray(complaints)) return '';
    return complaints.map(c => c.description).join(', ');
  },

  // =========================================================================
  // Service Orders API
  // =========================================================================

  serviceOrders: {
    /**
     * Get all service orders with optional filtering
     */
    getAll: async (filters = {}) => {
      const { status, customerId, vehicleId } = filters;
      let url = '/internal/v1/service-orders';
      
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (customerId) params.append('customer_id', customerId);
      if (vehicleId) params.append('vehicle_id', vehicleId);
      
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      const response = await internalApi.get(url);
      return response.data;
    },
    
    /**
     * Get a single service order by ID
     */
    getById: async (id) => {
      const response = await internalApi.get(`/internal/v1/service-orders/${id}`);
      return response.data;
    },
    
    /**
     * Create a new service order
     * @param {Object} data - Service order data with new structure
     */
    create: async (data) => {
      // Handle the case where complaints might come as a string instead of array
      if (typeof data.complaints === 'string') {
        data.complaints = api.parseMultipleComplaints(data.complaints);
      }
      
      // Ensure we have at least one complaint
      if (!data.complaints || data.complaints.length === 0) {
        throw new Error('At least one complaint is required');
      }
      
      const response = await internalApi.post('/internal/v1/service-orders', data);
      return response.data;
    },
    
    /**
     * Update an existing service order
     * @param {string} id - Service order ID
     * @param {Object} data - Updated service order data
     */
    update: async (id, data) => {
      // Handle the case where complaints might come as a string
      if (data.complaints && typeof data.complaints === 'string') {
        data.complaints = api.parseMultipleComplaints(data.complaints);
      }
      
      const response = await internalApi.patch(`/internal/v1/service-orders/${id}`, data);
      return response.data;
    },
    
    /**
     * Update just the status of a service order
     * @param {string} id - Service order ID
     * @param {string} status - New status
     */
    updateStatus: async (id, status) => {
      const response = await internalApi.patch(`/internal/v1/service-orders/${id}/status`, { status });
      return response.data;
    },
    
    /**
     * Delete a service order
     * @param {string} id - Service order ID
     */
    delete: async (id) => {
      const response = await internalApi.delete(`/internal/v1/service-orders/${id}`);
      return response.data;
    },
    
    /**
     * Create demo data
     */
    createDemoData: async () => {
      const response = await internalApi.post('/internal/v1/demo-data');
      return response.data;
    }
  },

  // =========================================================================
  // Action Items API
  // =========================================================================

  actionItems: {
    /**
     * Get all action items for a service order
     * @param {string} serviceOrderId - Service order ID
     */
    getAll: async (serviceOrderId) => {
      const response = await internalApi.get(`/internal/v1/service-orders/${serviceOrderId}/action-items`);
      return response.data;
    },
    
    /**
     * Get a single action item by ID
     * @param {string} actionItemId - Action item ID
     */
    getById: async (actionItemId) => {
      const response = await internalApi.get(`/internal/v1/action-items/${actionItemId}`);
      return response.data;
    },
    
    /**
     * Create a new action item for a service order
     * @param {string} serviceOrderId - Service order ID
     * @param {Object} data - Action item data with 3 C's structure
     */
    create: async (serviceOrderId, data) => {
      // Ensure the complaint (1st C) is provided
      if (!data.complaint) {
        throw new Error('Complaint is required for action items');
      }
      
      const response = await internalApi.post(`/internal/v1/service-orders/${serviceOrderId}/action-items`, data);
      return response.data;
    },
    
    /**
     * Update an action item
     * @param {string} actionItemId - Action item ID
     * @param {Object} data - Updated action item data
     */
    update: async (actionItemId, data) => {
      const response = await internalApi.patch(`/internal/v1/action-items/${actionItemId}`, data);
      return response.data;
    },
    
    /**
     * Delete an action item
     * @param {string} actionItemId - Action item ID
     */
    delete: async (actionItemId) => {
      const response = await internalApi.delete(`/internal/v1/action-items/${actionItemId}`);
      return response.data;
    },
    
    /**
     * Add a line item to an action item
     * @param {string} actionItemId - Action item ID
     * @param {Object} lineItem - Line item data (labor, part, or fee)
     */
    addLineItem: async (actionItemId, lineItem) => {
      // First get the current action item
      const actionItem = await api.actionItems.getById(actionItemId);
      
      // Add the new line item to the array
      const updatedLineItems = [...(actionItem.line_items || []), lineItem];
      
      // Update the action item with the new line items array
      return api.actionItems.update(actionItemId, { line_items: updatedLineItems });
    },
    
    /**
     * Update a line item in an action item
     * @param {string} actionItemId - Action item ID
     * @param {number} lineItemIndex - Index of the line item to update
     * @param {Object} lineItem - Updated line item data
     */
    updateLineItem: async (actionItemId, lineItemIndex, lineItem) => {
      // First get the current action item
      const actionItem = await api.actionItems.getById(actionItemId);
      
      // Make sure line_items exists and has the index
      if (!actionItem.line_items || !actionItem.line_items[lineItemIndex]) {
        throw new Error('Line item not found');
      }
      
      // Create a new array with the updated line item
      const updatedLineItems = [...actionItem.line_items];
      updatedLineItems[lineItemIndex] = { ...updatedLineItems[lineItemIndex], ...lineItem };
      
      // Update the action item with the new line items array
      return api.actionItems.update(actionItemId, { line_items: updatedLineItems });
    },
    
    /**
     * Remove a line item from an action item
     * @param {string} actionItemId - Action item ID
     * @param {number} lineItemIndex - Index of the line item to remove
     */
    removeLineItem: async (actionItemId, lineItemIndex) => {
      // First get the current action item
      const actionItem = await api.actionItems.getById(actionItemId);
      
      // Make sure line_items exists and has the index
      if (!actionItem.line_items || !actionItem.line_items[lineItemIndex]) {
        throw new Error('Line item not found');
      }
      
      // Create a new array without the removed line item
      const updatedLineItems = actionItem.line_items.filter((_, index) => index !== lineItemIndex);
      
      // Update the action item with the new line items array
      return api.actionItems.update(actionItemId, { line_items: updatedLineItems });
    }
  },

  // =========================================================================
  // Customers API
  // =========================================================================

  customers: {
    /**
     * Get all customers with optional search
     * @param {string} searchQuery - Optional search query
     */
    getAll: async (searchQuery = '') => {
      let url = '/internal/v1/customers';
      if (searchQuery) {
        url += `?q=${encodeURIComponent(searchQuery)}`;
      }
      const response = await internalApi.get(url);
      return response.data;
    },
    
    /**
     * Get a customer by ID
     * @param {string} id - Customer ID
     */
    getById: async (id) => {
      const response = await internalApi.get(`/internal/v1/customers/${id}`);
      return response.data;
    },
    
    /**
     * Create a new customer
     * @param {Object} data - Customer data
     */
    create: async (data) => {
      const response = await internalApi.post('/internal/v1/customers', data);
      return response.data;
    },
    
    /**
     * Update a customer
     * @param {string} id - Customer ID
     * @param {Object} data - Updated customer data
     */
    update: async (id, data) => {
      const response = await internalApi.patch(`/internal/v1/customers/${id}`, data);
      return response.data;
    },
    
    /**
     * Delete a customer
     * @param {string} id - Customer ID
     */
    delete: async (id) => {
      const response = await internalApi.delete(`/internal/v1/customers/${id}`);
      return response.data;
    },
    
    /**
     * Create a customer inline during service order creation
     * @param {Object} customerData - Basic customer data
     * @returns {Object} The created customer
     */
    createInline: async (customerData) => {
      // Validate minimum required fields
      if (!customerData.name) {
        throw new Error('Customer name is required');
      }
      
      // Create the customer
      return api.customers.create(customerData);
    }
  },

  // =========================================================================
  // Vehicles API
  // =========================================================================

  vehicles: {
    /**
     * Get all vehicles with optional customer filter
     * @param {string} customerId - Optional customer ID to filter by
     */
    getAll: async (customerId = null) => {
      let url = '/internal/v1/vehicles';
      if (customerId) {
        url += `?customer_id=${encodeURIComponent(customerId)}`;
      }
      const response = await internalApi.get(url);
      return response.data;
    },
    
    /**
     * Get a vehicle by ID
     * @param {string} id - Vehicle ID
     */
    getById: async (id) => {
      const response = await internalApi.get(`/internal/v1/vehicles/${id}`);
      return response.data;
    },
    
    /**
     * Create a new vehicle
     * @param {Object} data - Vehicle data
     */
    create: async (data) => {
      const response = await internalApi.post('/internal/v1/vehicles', data);
      return response.data;
    },
    
    /**
     * Update a vehicle
     * @param {string} id - Vehicle ID
     * @param {Object} data - Updated vehicle data
     */
    update: async (id, data) => {
      const response = await internalApi.patch(`/internal/v1/vehicles/${id}`, data);
      return response.data;
    },
    
    /**
     * Delete a vehicle
     * @param {string} id - Vehicle ID
     */
    delete: async (id) => {
      const response = await internalApi.delete(`/internal/v1/vehicles/${id}`);
      return response.data;
    },
    
    /**
     * Create a vehicle inline during service order creation
     * @param {Object} vehicleData - Vehicle data including customer_id
     * @returns {Object} The created vehicle
     */
    createInline: async (vehicleData) => {
      // Validate minimum required fields
      if (!vehicleData.customer_id) {
        throw new Error('Customer ID is required for vehicle creation');
      }
      
      if (!vehicleData.vin || !vehicleData.make || !vehicleData.model) {
        throw new Error('VIN, make, and model are required for vehicle creation');
      }
      
      // Create the vehicle
      return api.vehicles.create(vehicleData);
    }
  },

  // =========================================================================
  // Technicians API
  // =========================================================================

  technicians: {
    /**
     * Get all technicians
     */
    getAll: async () => {
      const response = await internalApi.get('/internal/v1/technicians');
      return response.data;
    },
    
    /**
     * Get a technician by ID
     * @param {string} id - Technician ID
     */
    getById: async (id) => {
      const response = await internalApi.get(`/internal/v1/technicians/${id}`);
      return response.data;
    }
  },

  // =========================================================================
  // Customer-facing API methods
  // =========================================================================

  customerPortal: {
    /**
     * Get service order status by public token
     * @param {string} token - Public tracker token
     */
    getServiceOrderStatus: async (token) => {
      const response = await publicApi.get(`/public/v1/service-tracker/${token}`);
      return response.data;
    }
  }
};

export default api;

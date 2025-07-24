/**
 * API Service Layer
 * 
 * This module provides functions to interact with the backend APIs.
 * It uses the axios instances from the ApiContext and handles authentication headers automatically.
 */

import { useContext } from 'react';
import { ApiContext } from '../contexts/ApiContext.jsx';

/**
 * Custom hook to use the API services
 * @returns {Object} API service functions
 */
export const useApi = () => {
  const { internalApi, portalApi, commsApi } = useContext(ApiContext);

  /**
   * Error handler wrapper for API calls
   * @param {Promise} apiCall - The API call promise
   * @returns {Promise} - Resolved with data or rejected with error
   */
  const handleApiCall = async (apiCall) => {
    try {
      const response = await apiCall;
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'An unknown error occurred';
      
      console.error('API Error:', errorMessage, error);
      throw new Error(errorMessage);
    }
  };

  // =========================================================================
  // Service Orders API
  // =========================================================================

  /**
   * Get all service orders with optional filters
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} - List of service orders
   */
  const getServiceOrders = (params = {}) => {
    return handleApiCall(internalApi.get('/internal/v1/service-orders', { params }));
  };

  /**
   * Get a service order by ID
   * @param {string} id - Service order ID
   * @returns {Promise<Object>} - Service order details
   */
  const getServiceOrder = (id) => {
    return handleApiCall(internalApi.get(`/internal/v1/service-orders/${id}`));
  };

  /**
   * Create a new service order
   * @param {Object} serviceOrder - Service order data
   * @returns {Promise<Object>} - Created service order
   */
  const createServiceOrder = (serviceOrder) => {
    return handleApiCall(internalApi.post('/internal/v1/service-orders', serviceOrder));
  };

  /**
   * Update a service order
   * @param {string} id - Service order ID
   * @param {Object} serviceOrder - Service order data to update
   * @returns {Promise<Object>} - Updated service order
   */
  const updateServiceOrder = (id, serviceOrder) => {
    return handleApiCall(internalApi.patch(`/internal/v1/service-orders/${id}`, serviceOrder));
  };

  /**
   * Delete a service order
   * @param {string} id - Service order ID
   * @returns {Promise<Object>} - Response data
   */
  const deleteServiceOrder = (id) => {
    return handleApiCall(internalApi.delete(`/internal/v1/service-orders/${id}`));
  };

  /**
   * Update service order status
   * @param {string} id - Service order ID
   * @param {string} status - New status
   * @returns {Promise<Object>} - Updated service order
   */
  const updateServiceOrderStatus = (id, status) => {
    return handleApiCall(internalApi.patch(`/internal/v1/service-orders/${id}/status`, { status }));
  };

  // =========================================================================
  // Customers API
  // =========================================================================

  /**
   * Get all customers with optional filters
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} - List of customers
   */
  const getCustomers = (params = {}) => {
    return handleApiCall(internalApi.get('/internal/v1/customers', { params }));
  };

  /**
   * Get a customer by ID
   * @param {string} id - Customer ID
   * @returns {Promise<Object>} - Customer details
   */
  const getCustomer = (id) => {
    return handleApiCall(internalApi.get(`/internal/v1/customers/${id}`));
  };

  /**
   * Create a new customer
   * @param {Object} customer - Customer data
   * @returns {Promise<Object>} - Created customer
   */
  const createCustomer = (customer) => {
    return handleApiCall(internalApi.post('/internal/v1/customers', customer));
  };

  /**
   * Update a customer
   * @param {string} id - Customer ID
   * @param {Object} customer - Customer data to update
   * @returns {Promise<Object>} - Updated customer
   */
  const updateCustomer = (id, customer) => {
    return handleApiCall(internalApi.patch(`/internal/v1/customers/${id}`, customer));
  };

  /**
   * Delete a customer
   * @param {string} id - Customer ID
   * @returns {Promise<Object>} - Response data
   */
  const deleteCustomer = (id) => {
    return handleApiCall(internalApi.delete(`/internal/v1/customers/${id}`));
  };

  // =========================================================================
  // Vehicles API
  // =========================================================================

  /**
   * Get all vehicles with optional filters
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} - List of vehicles
   */
  const getVehicles = (params = {}) => {
    return handleApiCall(internalApi.get('/internal/v1/vehicles', { params }));
  };

  /**
   * Get vehicles by customer ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<Array>} - List of vehicles
   */
  const getVehiclesByCustomer = (customerId) => {
    return handleApiCall(internalApi.get('/internal/v1/vehicles', { 
      params: { customer_id: customerId } 
    }));
  };

  /**
   * Get a vehicle by ID
   * @param {string} id - Vehicle ID
   * @returns {Promise<Object>} - Vehicle details
   */
  const getVehicle = (id) => {
    return handleApiCall(internalApi.get(`/internal/v1/vehicles/${id}`));
  };

  /**
   * Create a new vehicle
   * @param {Object} vehicle - Vehicle data
   * @returns {Promise<Object>} - Created vehicle
   */
  const createVehicle = (vehicle) => {
    return handleApiCall(internalApi.post('/internal/v1/vehicles', vehicle));
  };

  /**
   * Update a vehicle
   * @param {string} id - Vehicle ID
   * @param {Object} vehicle - Vehicle data to update
   * @returns {Promise<Object>} - Updated vehicle
   */
  const updateVehicle = (id, vehicle) => {
    return handleApiCall(internalApi.patch(`/internal/v1/vehicles/${id}`, vehicle));
  };

  /**
   * Delete a vehicle
   * @param {string} id - Vehicle ID
   * @returns {Promise<Object>} - Response data
   */
  const deleteVehicle = (id) => {
    return handleApiCall(internalApi.delete(`/internal/v1/vehicles/${id}`));
  };

  // =========================================================================
  // Technicians API
  // =========================================================================

  /**
   * Get all technicians
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} - List of technicians
   */
  const getTechnicians = (params = {}) => {
    return handleApiCall(internalApi.get('/internal/v1/technicians', { params }));
  };

  /**
   * Get a technician by ID
   * @param {string} id - Technician ID
   * @returns {Promise<Object>} - Technician details
   */
  const getTechnician = (id) => {
    return handleApiCall(internalApi.get(`/internal/v1/technicians/${id}`));
  };

  // =========================================================================
  // Demo Data API
  // =========================================================================

  /**
   * Create demo data for testing
   * @returns {Promise<Object>} - Result of demo data creation
   */
  const createDemoData = () => {
    return handleApiCall(internalApi.post('/internal/v1/demo-data'));
  };

  // =========================================================================
  // Messages API
  // =========================================================================

  /**
   * Get messages for a service order
   * @param {string} serviceOrderId - Service order ID
   * @returns {Promise<Array>} - List of messages
   */
  const getServiceOrderMessages = (serviceOrderId) => {
    return handleApiCall(commsApi.get(`/comms/v1/messages/service-order/${serviceOrderId}`));
  };

  /**
   * Send a message for a service order
   * @param {string} serviceOrderId - Service order ID
   * @param {string} message - Message content
   * @param {string} recipientType - Type of recipient (customer, technician)
   * @returns {Promise<Object>} - Created message
   */
  const sendServiceOrderMessage = (serviceOrderId, message, recipientType) => {
    return handleApiCall(commsApi.post('/comms/v1/messages', {
      service_order_id: serviceOrderId,
      content: message,
      recipient_type: recipientType
    }));
  };

  return {
    // Service Orders
    getServiceOrders,
    getServiceOrder,
    createServiceOrder,
    updateServiceOrder,
    deleteServiceOrder,
    updateServiceOrderStatus,
    
    // Customers
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    
    // Vehicles
    getVehicles,
    getVehiclesByCustomer,
    getVehicle,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    
    // Technicians
    getTechnicians,
    getTechnician,
    
    // Messages
    getServiceOrderMessages,
    sendServiceOrderMessage,
    
    // Demo Data
    createDemoData
  };
};

export default useApi;

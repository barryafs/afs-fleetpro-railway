import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';

// Create the context with a default empty value
const ApiContext = createContext({});

/**
 * ApiProvider - Centralized data management layer for AFS FleetPro
 * 
 * Provides:
 * - State management for service orders, customers, vehicles, and technicians
 * - Loading and error states for each entity type
 * - CRUD methods that update the central state
 * - Caching and data synchronization
 * - Support for filtering and searching
 */
export const ApiProvider = ({ children }) => {
  // =========================================================================
  // State Management
  // =========================================================================
  
  // Service Orders
  const [serviceOrders, setServiceOrders] = useState([]);
  const [serviceOrdersLoading, setServiceOrdersLoading] = useState(true);
  const [serviceOrdersError, setServiceOrdersError] = useState(null);
  const [serviceOrderFilters, setServiceOrderFilters] = useState({
    status: null,
    customerId: null,
    vehicleId: null
  });
  
  // Customers
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  
  // Vehicles
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState(null);
  const [vehicleFilters, setVehicleFilters] = useState({
    customerId: null
  });
  
  // Technicians
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(true);
  const [techniciansError, setTechniciansError] = useState(null);
  
  // Caching
  const [lastFetched, setLastFetched] = useState({
    serviceOrders: null,
    customers: null,
    vehicles: null,
    technicians: null
  });
  
  // Retry logic
  const [retryCount, setRetryCount] = useState({
    serviceOrders: 0,
    customers: 0,
    vehicles: 0,
    technicians: 0
  });
  
  const MAX_RETRY_COUNT = 3;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // =========================================================================
  // Data Fetching Methods
  // =========================================================================
  
  /**
   * Fetch service orders with optional filters
   */
  const fetchServiceOrders = useCallback(async (forceRefresh = false) => {
    // Check cache validity unless force refresh is requested
    if (!forceRefresh && 
        lastFetched.serviceOrders && 
        (Date.now() - lastFetched.serviceOrders) < CACHE_TTL) {
      return serviceOrders;
    }
    
    setServiceOrdersLoading(true);
    setServiceOrdersError(null);
    
    try {
      const data = await api.serviceOrders.getAll(serviceOrderFilters);
      setServiceOrders(data);
      setLastFetched(prev => ({ ...prev, serviceOrders: Date.now() }));
      setRetryCount(prev => ({ ...prev, serviceOrders: 0 }));
      return data;
    } catch (err) {
      console.error('Error fetching service orders:', err);
      setServiceOrdersError(`Failed to load service orders: ${err.message}`);
      
      // Implement retry logic
      if (retryCount.serviceOrders < MAX_RETRY_COUNT) {
        setRetryCount(prev => ({ ...prev, serviceOrders: prev.serviceOrders + 1 }));
        setTimeout(() => fetchServiceOrders(forceRefresh), 2000 * Math.pow(2, retryCount.serviceOrders));
      }
      
      return [];
    } finally {
      setServiceOrdersLoading(false);
    }
  }, [serviceOrderFilters, lastFetched.serviceOrders, retryCount.serviceOrders, serviceOrders]);
  
  /**
   * Fetch customers with optional search query
   */
  const fetchCustomers = useCallback(async (forceRefresh = false) => {
    // Check cache validity unless force refresh is requested
    if (!forceRefresh && 
        lastFetched.customers && 
        (Date.now() - lastFetched.customers) < CACHE_TTL) {
      return customers;
    }
    
    setCustomersLoading(true);
    setCustomersError(null);
    
    try {
      const data = await api.customers.getAll(customerSearchQuery);
      setCustomers(data);
      setLastFetched(prev => ({ ...prev, customers: Date.now() }));
      setRetryCount(prev => ({ ...prev, customers: 0 }));
      return data;
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomersError(`Failed to load customers: ${err.message}`);
      
      // Implement retry logic
      if (retryCount.customers < MAX_RETRY_COUNT) {
        setRetryCount(prev => ({ ...prev, customers: prev.customers + 1 }));
        setTimeout(() => fetchCustomers(forceRefresh), 2000 * Math.pow(2, retryCount.customers));
      }
      
      return [];
    } finally {
      setCustomersLoading(false);
    }
  }, [customerSearchQuery, lastFetched.customers, retryCount.customers, customers]);
  
  /**
   * Fetch vehicles with optional customer filter
   */
  const fetchVehicles = useCallback(async (forceRefresh = false) => {
    // Check cache validity unless force refresh is requested
    if (!forceRefresh && 
        lastFetched.vehicles && 
        (Date.now() - lastFetched.vehicles) < CACHE_TTL) {
      return vehicles;
    }
    
    setVehiclesLoading(true);
    setVehiclesError(null);
    
    try {
      const data = await api.vehicles.getAll(vehicleFilters.customerId);
      setVehicles(data);
      setLastFetched(prev => ({ ...prev, vehicles: Date.now() }));
      setRetryCount(prev => ({ ...prev, vehicles: 0 }));
      return data;
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      setVehiclesError(`Failed to load vehicles: ${err.message}`);
      
      // Implement retry logic
      if (retryCount.vehicles < MAX_RETRY_COUNT) {
        setRetryCount(prev => ({ ...prev, vehicles: prev.vehicles + 1 }));
        setTimeout(() => fetchVehicles(forceRefresh), 2000 * Math.pow(2, retryCount.vehicles));
      }
      
      return [];
    } finally {
      setVehiclesLoading(false);
    }
  }, [vehicleFilters, lastFetched.vehicles, retryCount.vehicles, vehicles]);
  
  /**
   * Fetch technicians
   */
  const fetchTechnicians = useCallback(async (forceRefresh = false) => {
    // Check cache validity unless force refresh is requested
    if (!forceRefresh && 
        lastFetched.technicians && 
        (Date.now() - lastFetched.technicians) < CACHE_TTL) {
      return technicians;
    }
    
    setTechniciansLoading(true);
    setTechniciansError(null);
    
    try {
      const data = await api.technicians.getAll();
      setTechnicians(data);
      setLastFetched(prev => ({ ...prev, technicians: Date.now() }));
      setRetryCount(prev => ({ ...prev, technicians: 0 }));
      return data;
    } catch (err) {
      console.error('Error fetching technicians:', err);
      setTechniciansError(`Failed to load technicians: ${err.message}`);
      
      // Implement retry logic
      if (retryCount.technicians < MAX_RETRY_COUNT) {
        setRetryCount(prev => ({ ...prev, technicians: prev.technicians + 1 }));
        setTimeout(() => fetchTechnicians(forceRefresh), 2000 * Math.pow(2, retryCount.technicians));
      }
      
      return [];
    } finally {
      setTechniciansLoading(false);
    }
  }, [lastFetched.technicians, retryCount.technicians, technicians]);
  
  // =========================================================================
  // CRUD Operations - Service Orders
  // =========================================================================
  
  /**
   * Create a new service order
   */
  const createServiceOrder = async (data) => {
    try {
      // Parse complaints if it's a string
      if (typeof data.complaints === 'string') {
        data.complaints = api.parseMultipleComplaints(data.complaints);
      }
      
      const result = await api.serviceOrders.create(data);
      
      // Update local state
      setServiceOrders(prev => [result, ...prev]);
      
      return result;
    } catch (err) {
      console.error('Error creating service order:', err);
      throw err;
    }
  };
  
  /**
   * Update an existing service order
   */
  const updateServiceOrder = async (id, data) => {
    try {
      // Parse complaints if it's a string
      if (data.complaints && typeof data.complaints === 'string') {
        data.complaints = api.parseMultipleComplaints(data.complaints);
      }
      
      const result = await api.serviceOrders.update(id, data);
      
      // Update local state
      setServiceOrders(prev => prev.map(so => so.id === id ? result : so));
      
      return result;
    } catch (err) {
      console.error('Error updating service order:', err);
      throw err;
    }
  };
  
  /**
   * Delete a service order
   */
  const deleteServiceOrder = async (id) => {
    try {
      await api.serviceOrders.delete(id);
      
      // Update local state
      setServiceOrders(prev => prev.filter(so => so.id !== id));
      
      return { success: true };
    } catch (err) {
      console.error('Error deleting service order:', err);
      throw err;
    }
  };
  
  /**
   * Update service order status
   */
  const updateServiceOrderStatus = async (id, status) => {
    try {
      const result = await api.serviceOrders.updateStatus(id, status);
      
      // Update local state
      setServiceOrders(prev => prev.map(so => so.id === id ? result : so));
      
      return result;
    } catch (err) {
      console.error('Error updating service order status:', err);
      throw err;
    }
  };
  
  // =========================================================================
  // CRUD Operations - Action Items
  // =========================================================================
  
  /**
   * Create a new action item
   */
  const createActionItem = async (serviceOrderId, data) => {
    try {
      const result = await api.actionItems.create(serviceOrderId, data);
      
      // Update local state
      setServiceOrders(prev => prev.map(so => {
        if (so.id === serviceOrderId) {
          return {
            ...so,
            action_items: [...(so.action_items || []), result]
          };
        }
        return so;
      }));
      
      return result;
    } catch (err) {
      console.error('Error creating action item:', err);
      throw err;
    }
  };
  
  /**
   * Update an action item
   */
  const updateActionItem = async (actionItemId, data) => {
    try {
      const result = await api.actionItems.update(actionItemId, data);
      
      // Update local state
      setServiceOrders(prev => prev.map(so => {
        if (so.action_items && so.action_items.some(item => item.id === actionItemId)) {
          return {
            ...so,
            action_items: so.action_items.map(item => item.id === actionItemId ? result : item)
          };
        }
        return so;
      }));
      
      return result;
    } catch (err) {
      console.error('Error updating action item:', err);
      throw err;
    }
  };
  
  /**
   * Delete an action item
   */
  const deleteActionItem = async (actionItemId) => {
    try {
      await api.actionItems.delete(actionItemId);
      
      // Update local state
      setServiceOrders(prev => prev.map(so => {
        if (so.action_items && so.action_items.some(item => item.id === actionItemId)) {
          return {
            ...so,
            action_items: so.action_items.filter(item => item.id !== actionItemId)
          };
        }
        return so;
      }));
      
      return { success: true };
    } catch (err) {
      console.error('Error deleting action item:', err);
      throw err;
    }
  };
  
  // =========================================================================
  // CRUD Operations - Customers
  // =========================================================================
  
  /**
   * Create a new customer
   */
  const createCustomer = async (data) => {
    try {
      const result = await api.customers.create(data);
      
      // Update local state
      setCustomers(prev => [...prev, result]);
      
      return result;
    } catch (err) {
      console.error('Error creating customer:', err);
      throw err;
    }
  };
  
  /**
   * Update a customer
   */
  const updateCustomer = async (id, data) => {
    try {
      const result = await api.customers.update(id, data);
      
      // Update local state
      setCustomers(prev => prev.map(customer => customer.id === id ? result : customer));
      
      return result;
    } catch (err) {
      console.error('Error updating customer:', err);
      throw err;
    }
  };
  
  /**
   * Delete a customer
   */
  const deleteCustomer = async (id) => {
    try {
      await api.customers.delete(id);
      
      // Update local state
      setCustomers(prev => prev.filter(customer => customer.id !== id));
      
      return { success: true };
    } catch (err) {
      console.error('Error deleting customer:', err);
      throw err;
    }
  };
  
  /**
   * Create a customer inline during service order creation
   */
  const createCustomerInline = async (data) => {
    try {
      const result = await api.customers.createInline(data);
      
      // Update local state
      setCustomers(prev => [...prev, result]);
      
      return result;
    } catch (err) {
      console.error('Error creating customer inline:', err);
      throw err;
    }
  };
  
  // =========================================================================
  // CRUD Operations - Vehicles
  // =========================================================================
  
  /**
   * Create a new vehicle
   */
  const createVehicle = async (data) => {
    try {
      const result = await api.vehicles.create(data);
      
      // Update local state
      setVehicles(prev => [...prev, result]);
      
      return result;
    } catch (err) {
      console.error('Error creating vehicle:', err);
      throw err;
    }
  };
  
  /**
   * Update a vehicle
   */
  const updateVehicle = async (id, data) => {
    try {
      const result = await api.vehicles.update(id, data);
      
      // Update local state
      setVehicles(prev => prev.map(vehicle => vehicle.id === id ? result : vehicle));
      
      return result;
    } catch (err) {
      console.error('Error updating vehicle:', err);
      throw err;
    }
  };
  
  /**
   * Delete a vehicle
   */
  const deleteVehicle = async (id) => {
    try {
      await api.vehicles.delete(id);
      
      // Update local state
      setVehicles(prev => prev.filter(vehicle => vehicle.id !== id));
      
      return { success: true };
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      throw err;
    }
  };
  
  /**
   * Create a vehicle inline during service order creation
   */
  const createVehicleInline = async (data) => {
    try {
      const result = await api.vehicles.createInline(data);
      
      // Update local state
      setVehicles(prev => [...prev, result]);
      
      return result;
    } catch (err) {
      console.error('Error creating vehicle inline:', err);
      throw err;
    }
  };
  
  // =========================================================================
  // Demo Data
  // =========================================================================
  
  /**
   * Initialize demo data
   */
  const initializeDemoData = async () => {
    try {
      const result = await api.serviceOrders.createDemoData();
      
      // Refresh all data
      await fetchServiceOrders(true);
      await fetchCustomers(true);
      await fetchVehicles(true);
      await fetchTechnicians(true);
      
      return result;
    } catch (err) {
      console.error('Error initializing demo data:', err);
      throw err;
    }
  };
  
  // =========================================================================
  // Filtering and Searching
  // =========================================================================
  
  /**
   * Set service order filters
   */
  const setServiceOrderFilter = (filterName, value) => {
    setServiceOrderFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };
  
  /**
   * Clear all service order filters
   */
  const clearServiceOrderFilters = () => {
    setServiceOrderFilters({
      status: null,
      customerId: null,
      vehicleId: null
    });
  };
  
  /**
   * Set customer search query
   */
  const searchCustomers = (query) => {
    setCustomerSearchQuery(query);
  };
  
  /**
   * Set vehicle filter by customer
   */
  const filterVehiclesByCustomer = (customerId) => {
    setVehicleFilters(prev => ({
      ...prev,
      customerId
    }));
  };
  
  // =========================================================================
  // Initial Data Loading
  // =========================================================================
  
  // Load data on component mount
  useEffect(() => {
    fetchServiceOrders();
    fetchCustomers();
    fetchVehicles();
    fetchTechnicians();
  }, [fetchServiceOrders, fetchCustomers, fetchVehicles, fetchTechnicians]);
  
  // Reload service orders when filters change
  useEffect(() => {
    fetchServiceOrders(true);
  }, [serviceOrderFilters, fetchServiceOrders]);
  
  // Reload customers when search query changes
  useEffect(() => {
    fetchCustomers(true);
  }, [customerSearchQuery, fetchCustomers]);
  
  // Reload vehicles when customer filter changes
  useEffect(() => {
    fetchVehicles(true);
  }, [vehicleFilters, fetchVehicles]);
  
  // =========================================================================
  // Computed Properties
  // =========================================================================
  
  // Filtered vehicles based on selected customer
  const filteredVehicles = useMemo(() => {
    if (!vehicleFilters.customerId) return vehicles;
    return vehicles.filter(vehicle => vehicle.customer_id === vehicleFilters.customerId);
  }, [vehicles, vehicleFilters.customerId]);
  
  // =========================================================================
  // Context Value
  // =========================================================================
  
  // Build the context value object
  const contextValue = {
    // Data
    serviceOrders,
    customers,
    vehicles,
    filteredVehicles,
    technicians,
    
    // Loading states
    loading: {
      serviceOrders: serviceOrdersLoading,
      customers: customersLoading,
      vehicles: vehiclesLoading,
      technicians: techniciansLoading,
      any: serviceOrdersLoading || customersLoading || vehiclesLoading || techniciansLoading
    },
    
    // Error states
    errors: {
      serviceOrders: serviceOrdersError,
      customers: customersError,
      vehicles: vehiclesError,
      technicians: techniciansError,
      any: serviceOrdersError || customersError || vehiclesError || techniciansError
    },
    
    // Fetch methods
    fetch: {
      serviceOrders: fetchServiceOrders,
      customers: fetchCustomers,
      vehicles: fetchVehicles,
      technicians: fetchTechnicians,
      all: async (forceRefresh = true) => {
        await Promise.all([
          fetchServiceOrders(forceRefresh),
          fetchCustomers(forceRefresh),
          fetchVehicles(forceRefresh),
          fetchTechnicians(forceRefresh)
        ]);
      }
    },
    
    // Service Order CRUD
    serviceOrdersApi: {
      create: createServiceOrder,
      update: updateServiceOrder,
      delete: deleteServiceOrder,
      updateStatus: updateServiceOrderStatus,
      setFilter: setServiceOrderFilter,
      clearFilters: clearServiceOrderFilters,
      filters: serviceOrderFilters
    },
    
    // Action Items CRUD
    actionItemsApi: {
      create: createActionItem,
      update: updateActionItem,
      delete: deleteActionItem
    },
    
    // Customers CRUD
    customersApi: {
      create: createCustomer,
      update: updateCustomer,
      delete: deleteCustomer,
      createInline: createCustomerInline,
      search: searchCustomers,
      searchQuery: customerSearchQuery
    },
    
    // Vehicles CRUD
    vehiclesApi: {
      create: createVehicle,
      update: updateVehicle,
      delete: deleteVehicle,
      createInline: createVehicleInline,
      filterByCustomer: filterVehiclesByCustomer
    },
    
    // Demo data
    demoData: {
      initialize: initializeDemoData
    },
    
    // Helper methods
    helpers: {
      parseMultipleComplaints: api.parseMultipleComplaints,
      formatComplaintsToString: api.formatComplaintsToString
    }
  };
  
  return (
    <ApiContext.Provider value={contextValue}>
      {children}
    </ApiContext.Provider>
  );
};

/**
 * Custom hook to use the API context
 */
export const useApi = () => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

export default ApiContext;

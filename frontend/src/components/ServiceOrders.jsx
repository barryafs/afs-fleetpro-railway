import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Card, CardContent, CircularProgress, Container, Dialog,
  DialogActions, DialogContent, DialogContentText, DialogTitle, Divider,
  Grid, IconButton, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography,
  Accordion, AccordionSummary, AccordionDetails, Chip, Tooltip, Alert, Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Engineering as EngineeringIcon,
  LocalShipping as TruckIcon,
  DirectionsCar as CarIcon,
  Build as BuildIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import api from '../services/api';

// Status chip colors
const statusColors = {
  service_requested: 'default',
  tech_assigned: 'info',
  tech_en_route: 'info',
  tech_arrived: 'info',
  diagnosis_in_progress: 'warning',
  awaiting_approval: 'warning',
  parts_being_sourced: 'warning',
  repair_in_progress: 'warning',
  quality_check: 'info',
  repair_complete: 'success',
  invoice_sent: 'success'
};

// Status display names
const statusNames = {
  service_requested: 'Service Requested',
  tech_assigned: 'Technician Assigned',
  tech_en_route: 'Technician En Route',
  tech_arrived: 'Technician On Site',
  diagnosis_in_progress: 'Diagnosis In Progress',
  awaiting_approval: 'Awaiting Approval',
  parts_being_sourced: 'Parts Being Sourced',
  repair_in_progress: 'Repair In Progress',
  quality_check: 'Quality Check',
  repair_complete: 'Repair Complete',
  invoice_sent: 'Invoice Sent'
};

// Service type display names
const serviceTypeNames = {
  shop_service: 'Shop Service',
  mobile_service: 'Mobile Service',
  roadside_emergency: 'Roadside Emergency'
};

// Urgency levels
const urgencyLevels = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

/**
 * ServiceOrders Component
 * 
 * Main component for managing service orders with the new industry-standard
 * architecture (Service Orders as containers with Action Items for actual work)
 */
const ServiceOrders = () => {
  // State for service orders list
  const [serviceOrders, setServiceOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for selected service order
  const [selectedServiceOrder, setSelectedServiceOrder] = useState(null);
  
  // State for form dialogs
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openActionItemDialog, setOpenActionItemDialog] = useState(false);
  
  // State for action items
  const [selectedActionItem, setSelectedActionItem] = useState(null);
  
  // State for customers and vehicles (for dropdowns)
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  
  // State for inline creation
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingVehicle, setCreatingVehicle] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact_email: '', contact_phone: '' });
  const [newVehicle, setNewVehicle] = useState({ customer_id: '', vin: '', year: new Date().getFullYear(), make: '', model: '' });
  
  // State for snackbar notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Form state for creating/editing service orders
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    complaints: '',
    current_mileage: '',
    current_hours: '',
    service_type: 'shop_service',
    initial_assessment: '',
    urgency: 'normal',
    vehicle_location: {
      current_address: '',
      location_name: '',
      cross_streets: ''
    }
  });
  
  // Form state for action items
  const [actionItemForm, setActionItemForm] = useState({
    title: '',
    complaint: '',
    cause: '',
    correction: '',
    status: 'pending',
    assigned_technicians: [],
    line_items: []
  });
  
  // Fetch service orders on component mount
  useEffect(() => {
    fetchServiceOrders();
    fetchCustomers();
    fetchTechnicians();
  }, []);
  
  // Filter vehicles when customer changes
  useEffect(() => {
    if (formData.customer_id) {
      fetchVehicles(formData.customer_id);
    } else {
      setFilteredVehicles([]);
    }
  }, [formData.customer_id]);
  
  // Fetch service orders from API
  const fetchServiceOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.serviceOrders.getAll();
      setServiceOrders(data);
    } catch (err) {
      console.error('Error fetching service orders:', err);
      setError('Failed to load service orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch customers for dropdown
  const fetchCustomers = async () => {
    try {
      const data = await api.customers.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setSnackbar({
        open: true,
        message: 'Failed to load customers. Please try again.',
        severity: 'error'
      });
    }
  };
  
  // Fetch vehicles for dropdown, filtered by customer
  const fetchVehicles = async (customerId) => {
    try {
      const data = await api.vehicles.getAll(customerId);
      setFilteredVehicles(data);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      setSnackbar({
        open: true,
        message: 'Failed to load vehicles. Please try again.',
        severity: 'error'
      });
    }
  };
  
  // Fetch all vehicles (for admin purposes)
  const fetchAllVehicles = async () => {
    try {
      const data = await api.vehicles.getAll();
      setVehicles(data);
    } catch (err) {
      console.error('Error fetching all vehicles:', err);
    }
  };
  
  // Fetch technicians for dropdown
  const fetchTechnicians = async () => {
    try {
      const data = await api.technicians.getAll();
      setTechnicians(data);
    } catch (err) {
      console.error('Error fetching technicians:', err);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      // Handle nested objects (like vehicle_location.current_address)
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  
  // Handle action item form input changes
  const handleActionItemInputChange = (e) => {
    const { name, value } = e.target;
    setActionItemForm({
      ...actionItemForm,
      [name]: value
    });
  };
  
  // Handle customer form input changes
  const handleCustomerInputChange = (e) => {
    const { name, value } = e.target;
    setNewCustomer({
      ...newCustomer,
      [name]: value
    });
  };
  
  // Handle vehicle form input changes
  const handleVehicleInputChange = (e) => {
    const { name, value } = e.target;
    setNewVehicle({
      ...newVehicle,
      [name]: value
    });
  };
  
  // Create a new service order
  const handleCreateServiceOrder = async () => {
    try {
      // Parse complaints from comma-separated string to array of objects
      const complaintsArray = api.parseMultipleComplaints(formData.complaints);
      
      // Prepare data for API
      const serviceOrderData = {
        ...formData,
        complaints: complaintsArray
      };
      
      // Remove empty location fields if not mobile/roadside
      if (formData.service_type === 'shop_service') {
        delete serviceOrderData.vehicle_location;
      }
      
      // Convert string numbers to actual numbers
      if (serviceOrderData.current_mileage) {
        serviceOrderData.current_mileage = parseInt(serviceOrderData.current_mileage, 10);
      }
      
      if (serviceOrderData.current_hours) {
        serviceOrderData.current_hours = parseInt(serviceOrderData.current_hours, 10);
      }
      
      const result = await api.serviceOrders.create(serviceOrderData);
      
      setServiceOrders([result, ...serviceOrders]);
      setOpenCreateDialog(false);
      resetForm();
      
      setSnackbar({
        open: true,
        message: `Service Order ${result.number} created successfully`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error creating service order:', err);
      setSnackbar({
        open: true,
        message: `Failed to create service order: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Update an existing service order
  const handleUpdateServiceOrder = async () => {
    try {
      // Parse complaints if it's a string
      let complaintsArray = formData.complaints;
      if (typeof formData.complaints === 'string') {
        complaintsArray = api.parseMultipleComplaints(formData.complaints);
      }
      
      // Prepare data for API
      const serviceOrderData = {
        ...formData,
        complaints: complaintsArray
      };
      
      // Remove empty location fields if not mobile/roadside
      if (formData.service_type === 'shop_service') {
        delete serviceOrderData.vehicle_location;
      }
      
      // Convert string numbers to actual numbers
      if (serviceOrderData.current_mileage) {
        serviceOrderData.current_mileage = parseInt(serviceOrderData.current_mileage, 10);
      }
      
      if (serviceOrderData.current_hours) {
        serviceOrderData.current_hours = parseInt(serviceOrderData.current_hours, 10);
      }
      
      const result = await api.serviceOrders.update(selectedServiceOrder.id, serviceOrderData);
      
      // Update the list with the updated service order
      setServiceOrders(serviceOrders.map(so => 
        so.id === result.id ? result : so
      ));
      
      setOpenEditDialog(false);
      resetForm();
      
      setSnackbar({
        open: true,
        message: `Service Order ${result.number} updated successfully`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error updating service order:', err);
      setSnackbar({
        open: true,
        message: `Failed to update service order: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Delete a service order
  const handleDeleteServiceOrder = async () => {
    try {
      await api.serviceOrders.delete(selectedServiceOrder.id);
      
      // Remove the deleted service order from the list
      setServiceOrders(serviceOrders.filter(so => so.id !== selectedServiceOrder.id));
      
      setOpenDeleteDialog(false);
      setSelectedServiceOrder(null);
      
      setSnackbar({
        open: true,
        message: 'Service order deleted successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error deleting service order:', err);
      setSnackbar({
        open: true,
        message: `Failed to delete service order: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Create a new action item
  const handleCreateActionItem = async () => {
    try {
      const result = await api.actionItems.create(selectedServiceOrder.id, actionItemForm);
      
      // Update the selected service order with the new action item
      const updatedServiceOrder = {
        ...selectedServiceOrder,
        action_items: [...selectedServiceOrder.action_items, result]
      };
      
      // Update the service orders list
      setServiceOrders(serviceOrders.map(so => 
        so.id === updatedServiceOrder.id ? updatedServiceOrder : so
      ));
      
      setSelectedServiceOrder(updatedServiceOrder);
      setOpenActionItemDialog(false);
      resetActionItemForm();
      
      setSnackbar({
        open: true,
        message: 'Action item created successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error creating action item:', err);
      setSnackbar({
        open: true,
        message: `Failed to create action item: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Update an existing action item
  const handleUpdateActionItem = async () => {
    try {
      const result = await api.actionItems.update(selectedActionItem.id, actionItemForm);
      
      // Update the action items list in the selected service order
      const updatedActionItems = selectedServiceOrder.action_items.map(item => 
        item.id === result.id ? result : item
      );
      
      const updatedServiceOrder = {
        ...selectedServiceOrder,
        action_items: updatedActionItems
      };
      
      // Update the service orders list
      setServiceOrders(serviceOrders.map(so => 
        so.id === updatedServiceOrder.id ? updatedServiceOrder : so
      ));
      
      setSelectedServiceOrder(updatedServiceOrder);
      setOpenActionItemDialog(false);
      setSelectedActionItem(null);
      resetActionItemForm();
      
      setSnackbar({
        open: true,
        message: 'Action item updated successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error updating action item:', err);
      setSnackbar({
        open: true,
        message: `Failed to update action item: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Delete an action item
  const handleDeleteActionItem = async (actionItemId) => {
    try {
      await api.actionItems.delete(actionItemId);
      
      // Remove the action item from the selected service order
      const updatedActionItems = selectedServiceOrder.action_items.filter(item => 
        item.id !== actionItemId
      );
      
      const updatedServiceOrder = {
        ...selectedServiceOrder,
        action_items: updatedActionItems
      };
      
      // Update the service orders list
      setServiceOrders(serviceOrders.map(so => 
        so.id === updatedServiceOrder.id ? updatedServiceOrder : so
      ));
      
      setSelectedServiceOrder(updatedServiceOrder);
      
      setSnackbar({
        open: true,
        message: 'Action item deleted successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error deleting action item:', err);
      setSnackbar({
        open: true,
        message: `Failed to delete action item: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Create a new customer inline
  const handleCreateCustomer = async () => {
    try {
      const result = await api.customers.createInline(newCustomer);
      
      // Add the new customer to the list
      setCustomers([...customers, result]);
      
      // Select the new customer
      setFormData({
        ...formData,
        customer_id: result.id
      });
      
      setCreatingCustomer(false);
      setNewCustomer({ name: '', contact_email: '', contact_phone: '' });
      
      setSnackbar({
        open: true,
        message: `Customer ${result.name} created successfully`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error creating customer:', err);
      setSnackbar({
        open: true,
        message: `Failed to create customer: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Create a new vehicle inline
  const handleCreateVehicle = async () => {
    try {
      // Set the customer_id from the form
      const vehicleData = {
        ...newVehicle,
        customer_id: formData.customer_id,
        year: parseInt(newVehicle.year, 10)
      };
      
      const result = await api.vehicles.createInline(vehicleData);
      
      // Add the new vehicle to the filtered list
      setFilteredVehicles([...filteredVehicles, result]);
      
      // Select the new vehicle
      setFormData({
        ...formData,
        vehicle_id: result.id
      });
      
      setCreatingVehicle(false);
      setNewVehicle({ customer_id: '', vin: '', year: new Date().getFullYear(), make: '', model: '' });
      
      setSnackbar({
        open: true,
        message: `Vehicle ${result.make} ${result.model} created successfully`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error creating vehicle:', err);
      setSnackbar({
        open: true,
        message: `Failed to create vehicle: ${err.message}`,
        severity: 'error'
      });
    }
  };
  
  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      customer_id: '',
      vehicle_id: '',
      complaints: '',
      current_mileage: '',
      current_hours: '',
      service_type: 'shop_service',
      initial_assessment: '',
      urgency: 'normal',
      vehicle_location: {
        current_address: '',
        location_name: '',
        cross_streets: ''
      }
    });
  };
  
  // Reset action item form
  const resetActionItemForm = () => {
    setActionItemForm({
      title: '',
      complaint: '',
      cause: '',
      correction: '',
      status: 'pending',
      assigned_technicians: [],
      line_items: []
    });
  };
  
  // Open create dialog
  const handleOpenCreateDialog = () => {
    resetForm();
    setOpenCreateDialog(true);
  };
  
  // Open edit dialog
  const handleOpenEditDialog = (serviceOrder) => {
    // Format complaints for display
    const complaintsString = api.formatComplaintsToString(serviceOrder.complaints);
    
    setFormData({
      ...serviceOrder,
      complaints: complaintsString
    });
    
    setSelectedServiceOrder(serviceOrder);
    setOpenEditDialog(true);
  };
  
  // Open delete dialog
  const handleOpenDeleteDialog = (serviceOrder) => {
    setSelectedServiceOrder(serviceOrder);
    setOpenDeleteDialog(true);
  };
  
  // Open action item dialog
  const handleOpenActionItemDialog = (serviceOrder, actionItem = null) => {
    setSelectedServiceOrder(serviceOrder);
    
    if (actionItem) {
      // Editing existing action item
      setSelectedActionItem(actionItem);
      setActionItemForm({
        title: actionItem.title,
        complaint: actionItem.complaint,
        cause: actionItem.cause || '',
        correction: actionItem.correction || '',
        status: actionItem.status,
        assigned_technicians: actionItem.assigned_technicians || [],
        line_items: actionItem.line_items || []
      });
    } else {
      // Creating new action item
      resetActionItemForm();
      setSelectedActionItem(null);
    }
    
    setOpenActionItemDialog(true);
  };
  
  // Close dialogs
  const handleCloseDialogs = () => {
    setOpenCreateDialog(false);
    setOpenEditDialog(false);
    setOpenDeleteDialog(false);
    setOpenActionItemDialog(false);
    setCreatingCustomer(false);
    setCreatingVehicle(false);
    resetForm();
    resetActionItemForm();
  };
  
  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };
  
  // DataGrid columns for service orders
  const columns = [
    { 
      field: 'number', 
      headerName: 'Order #', 
      width: 130,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold">
          {params.value}
        </Typography>
      )
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 160,
      renderCell: (params) => (
        <Chip 
          label={statusNames[params.value] || params.value} 
          color={statusColors[params.value] || 'default'} 
          size="small" 
        />
      )
    },
    {
      field: 'service_type',
      headerName: 'Type',
      width: 140,
      renderCell: (params) => (
        <Chip
          icon={params.value === 'shop_service' ? <BuildIcon /> : <TruckIcon />}
          label={serviceTypeNames[params.value] || params.value}
          variant="outlined"
          size="small"
        />
      )
    },
    {
      field: 'complaints',
      headerName: 'Complaints',
      flex: 1,
      renderCell: (params) => {
        if (!params.value || !Array.isArray(params.value)) return '-';
        return (
          <Tooltip title={params.value.map(c => c.description).join(', ')}>
            <Typography variant="body2" noWrap>
              {params.value.map(c => c.description).join(', ')}
            </Typography>
          </Tooltip>
        );
      }
    },
    {
      field: 'urgency',
      headerName: 'Urgency',
      width: 120,
      renderCell: (params) => {
        const urgencyColors = {
          low: 'success',
          normal: 'info',
          high: 'warning',
          critical: 'error'
        };
        
        return (
          <Chip 
            label={params.value.charAt(0).toUpperCase() + params.value.slice(1)} 
            color={urgencyColors[params.value] || 'default'} 
            size="small" 
            variant="outlined"
          />
        );
      }
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 170,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return format(new Date(params.value), 'MMM d, yyyy h:mm a');
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenEditDialog(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add Action Item">
            <IconButton size="small" onClick={() => handleOpenActionItemDialog(params.row)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => handleOpenDeleteDialog(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ];
  
  // Render the component
  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1">
            Service Orders
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={fetchServiceOrders}
            >
              Refresh
            </Button>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={handleOpenCreateDialog}
            >
              New Service Order
            </Button>
          </Stack>
        </Stack>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper sx={{ height: 650, width: '100%' }}>
            <DataGrid
              rows={serviceOrders}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              disableSelectionOnClick
              getRowId={(row) => row.id}
              components={{
                NoRowsOverlay: () => (
                  <Stack height="100%" alignItems="center" justifyContent="center">
                    <Typography variant="h6" color="text.secondary">
                      No service orders found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create a new service order to get started
                    </Typography>
                  </Stack>
                )
              }}
              getDetailPanelContent={({ row }) => (
                <ServiceOrderDetailPanel 
                  serviceOrder={row} 
                  customers={customers}
                  vehicles={vehicles}
                  technicians={technicians}
                  onEditActionItem={(actionItem) => handleOpenActionItemDialog(row, actionItem)}
                  onDeleteActionItem={handleDeleteActionItem}
                />
              )}
              getDetailPanelHeight={() => 'auto'}
            />
          </Paper>
        )}
      </Box>
      
      {/* Create Service Order Dialog */}
      <Dialog 
        open={openCreateDialog} 
        onClose={handleCloseDialogs}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Create New Service Order</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Customer Selection */}
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Customer Information
                </Typography>
                {!creatingCustomer ? (
                  <>
                    <TextField
                      select
                      fullWidth
                      label="Select Customer"
                      name="customer_id"
                      value={formData.customer_id}
                      onChange={handleInputChange}
                      required
                      margin="normal"
                    >
                      {customers.map((customer) => (
                        <MenuItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button 
                      size="small" 
                      onClick={() => setCreatingCustomer(true)}
                      sx={{ mt: 1 }}
                    >
                      + Create New Customer
                    </Button>
                  </>
                ) : (
                  <Box sx={{ mt: 2, p: 2, border: '1px dashed grey', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      New Customer
                    </Typography>
                    <TextField
                      fullWidth
                      label="Customer Name"
                      name="name"
                      value={newCustomer.name}
                      onChange={handleCustomerInputChange}
                      required
                      margin="dense"
                    />
                    <TextField
                      fullWidth
                      label="Contact Email"
                      name="contact_email"
                      value={newCustomer.contact_email}
                      onChange={handleCustomerInputChange}
                      margin="dense"
                    />
                    <TextField
                      fullWidth
                      label="Contact Phone"
                      name="contact_phone"
                      value={newCustomer.contact_phone}
                      onChange={handleCustomerInputChange}
                      margin="dense"
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        onClick={() => setCreatingCustomer(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="contained" 
                        size="small" 
                        onClick={handleCreateCustomer}
                        disabled={!newCustomer.name}
                      >
                        Save Customer
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Box>
              
              {/* Vehicle Selection */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Vehicle Information
                </Typography>
                {!creatingVehicle ? (
                  <>
                    <TextField
                      select
                      fullWidth
                      label="Select Vehicle"
                      name="vehicle_id"
                      value={formData.vehicle_id}
                      onChange={handleInputChange}
                      required
                      margin="normal"
                      disabled={!formData.customer_id}
                    >
                      {filteredVehicles.map((vehicle) => (
                        <MenuItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.vin})
                        </MenuItem>
                      ))}
                    </TextField>
                    {formData.customer_id && (
                      <Button 
                        size="small" 
                        onClick={() => setCreatingVehicle(true)}
                        sx={{ mt: 1 }}
                      >
                        + Add New Vehicle
                      </Button>
                    )}
                  </>
                ) : (
                  <Box sx={{ mt: 2, p: 2, border: '1px dashed grey', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      New Vehicle
                    </Typography>
                    <TextField
                      fullWidth
                      label="VIN"
                      name="vin"
                      value={newVehicle.vin}
                      onChange={handleVehicleInputChange}
                      required
                      margin="dense"
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          label="Year"
                          name="year"
                          type="number"
                          value={newVehicle.year}
                          onChange={handleVehicleInputChange}
                          required
                          margin="dense"
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          label="Make"
                          name="make"
                          value={newVehicle.make}
                          onChange={handleVehicleInputChange}
                          required
                          margin="dense"
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          label="Model"
                          name="model"
                          value={newVehicle.model}
                          onChange={handleVehicleInputChange}
                          required
                          margin="dense"
                        />
                      </Grid>
                    </Grid>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        onClick={() => setCreatingVehicle(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="contained" 
                        size="small" 
                        onClick={handleCreateVehicle}
                        disabled={!newVehicle.vin || !newVehicle.make || !newVehicle.model}
                      >
                        Save Vehicle
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Box>
            </Grid>
            
            {/* Service Order Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Service Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Current Mileage"
                    name="current_mileage"
                    type="number"
                    value={formData.current_mileage}
                    onChange={handleInputChange}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Engine Hours"
                    name="current_hours"
                    type="number"
                    value={formData.current_hours}
                    onChange={handleInputChange}
                    margin="normal"
                  />
                </Grid>
              </Grid>
              
              <TextField
                select
                fullWidth
                label="Service Type"
                name="service_type"
                value={formData.service_type}
                onChange={handleInputChange}
                required
                margin="normal"
              >
                <MenuItem value="shop_service">Shop Service</MenuItem>
                <MenuItem value="mobile_service">Mobile Service</MenuItem>
                <MenuItem value="roadside_emergency">Roadside Emergency</MenuItem>
              </TextField>
              
              <TextField
                select
                fullWidth
                label="Urgency"
                name="urgency"
                value={formData.urgency}
                onChange={handleInputChange}
                required
                margin="normal"
              >
                {urgencyLevels.map((level) => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </TextField>
              
              <TextField
                fullWidth
                label="Initial Assessment"
                name="initial_assessment"
                value={formData.initial_assessment}
                onChange={handleInputChange}
                multiline
                rows={2}
                margin="normal"
              />
            </Grid>
            
            {/* Complaints - Full Width */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Complaints
              </Typography>
              <TextField
                fullWidth
                label="Complaints (separate multiple with commas)"
                name="complaints"
                value={formData.complaints}
                onChange={handleInputChange}
                required
                multiline
                rows={3}
                margin="normal"
                helperText="Example: Engine check light on, Loss of power when accelerating, Unusual noise from transmission"
              />
            </Grid>
            
            {/* Location Information (only for mobile/roadside) */}
            {(formData.service_type === 'mobile_service' || formData.service_type === 'roadside_emergency') && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Vehicle Location
                </Typography>
                <TextField
                  fullWidth
                  label="Current Address"
                  name="vehicle_location.current_address"
                  value={formData.vehicle_location?.current_address || ''}
                  onChange={handleInputChange}
                  required
                  margin="normal"
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Location Name"
                      name="vehicle_location.location_name"
                      value={formData.vehicle_location?.location_name || ''}
                      onChange={handleInputChange}
                      margin="normal"
                      helperText="E.g., Customer's North Yard, Truck Stop"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Cross Streets"
                      name="vehicle_location.cross_streets"
                      value={formData.vehicle_location?.cross_streets || ''}
                      onChange={handleInputChange}
                      margin="normal"
                      helperText="E.g., Between Main St and 2nd Ave"
                    />
                  </Grid>
                </Grid>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button 
            onClick={handleCreateServiceOrder} 
            variant="contained"
            disabled={!formData.customer_id || !formData.vehicle_id || !formData.complaints}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Service Order Dialog */}
      <Dialog 
        open={openEditDialog} 
        onClose={handleCloseDialogs}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Edit Service Order #{selectedServiceOrder?.number}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Customer & Vehicle Info (read-only in edit mode) */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Customer & Vehicle Information
              </Typography>
              <TextField
                select
                fullWidth
                label="Customer"
                name="customer_id"
                value={formData.customer_id}
                onChange={handleInputChange}
                required
                margin="normal"
                disabled
              >
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Vehicle"
                name="vehicle_id"
                value={formData.vehicle_id}
                onChange={handleInputChange}
                required
                margin="normal"
                disabled
              >
                {filteredVehicles.map((vehicle) => (
                  <MenuItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.vin})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            {/* Service Order Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Service Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Current Mileage"
                    name="current_mileage"
                    type="number"
                    value={formData.current_mileage}
                    onChange={handleInputChange}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Engine Hours"
                    name="current_hours"
                    type="number"
                    value={formData.current_hours}
                    onChange={handleInputChange}
                    margin="normal"
                  />
                </Grid>
              </Grid>
              
              <TextField
                select
                fullWidth
                label="Service Type"
                name="service_type"
                value={formData.service_type}
                onChange={handleInputChange}
                required
                margin="normal"
              >
                <MenuItem value="shop_service">Shop Service</MenuItem>
                <MenuItem value="mobile_service">Mobile Service</MenuItem>
                <MenuItem value="roadside_emergency">Roadside Emergency</MenuItem>
              </TextField>
              
              <TextField
                select
                fullWidth
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                required
                margin="normal"
              >
                {Object.entries(statusNames).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              
              <TextField
                select
                fullWidth
                label="Urgency"
                name="urgency"
                value={formData.urgency}
                onChange={handleInputChange}
                required
                margin="normal"
              >
                {urgencyLevels.map((level) => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            {/* Complaints - Full Width */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Complaints
              </Typography>
              <TextField
                fullWidth
                label="Complaints (separate multiple with commas)"
                name="complaints"
                value={formData.complaints}
                onChange={handleInputChange}
                required
                multiline
                rows={3}
                margin="normal"
                helperText="Example: Engine check light on, Loss of power when accelerating, Unusual noise from transmission"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Initial Assessment"
                name="initial_assessment"
                value={formData.initial_assessment}
                onChange={handleInputChange}
                multiline
                rows={2}
                margin="normal"
              />
            </Grid>
            
            {/* Location Information (only for mobile/roadside) */}
            {(formData.service_type === 'mobile_service' || formData.service_type === 'roadside_emergency') && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Vehicle Location
                </Typography>
                <TextField
                  fullWidth
                  label="Current Address"
                  name="vehicle_location.current_address"
                  value={formData.vehicle_location?.current_address || ''}
                  onChange={handleInputChange}
                  required
                  margin="normal"
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Location Name"
                      name="vehicle_location.location_name"
                      value={formData.vehicle_location?.location_name || ''}
                      onChange={handleInputChange}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Cross Streets"
                      name="vehicle_location.cross_streets"
                      value={formData.vehicle_location?.cross_streets || ''}
                      onChange={handleInputChange}
                      margin="normal"
                    />
                  </Grid>
                </Grid>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button 
            onClick={handleUpdateServiceOrder} 
            variant="contained"
            disabled={!formData.complaints}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Service Order Dialog */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDialogs}>
        <DialogTitle>Delete Service Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete service order #{selectedServiceOrder?.number}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button onClick={handleDeleteServiceOrder} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Action Item Dialog */}
      <Dialog 
        open={openActionItemDialog} 
        onClose={handleCloseDialogs}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {selectedActionItem ? 'Edit Action Item' : 'Create New Action Item'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                name="title"
                value={actionItemForm.title}
                onChange={handleActionItemInputChange}
                required
                margin="normal"
              />
            </Grid>
            
            {/* 3 C's - Complaint, Cause, Correction */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                3 C's Structure
              </Typography>
              <TextField
                fullWidth
                label="Complaint (Required - 1st C)"
                name="complaint"
                value={actionItemForm.complaint}
                onChange={handleActionItemInputChange}
                required
                multiline
                rows={2}
                margin="normal"
                helperText="What is the issue reported by the customer?"
              />
              <TextField
                fullWidth
                label="Cause (2nd C)"
                name="cause"
                value={actionItemForm.cause}
                onChange={handleActionItemInputChange}
                multiline
                rows={2}
                margin="normal"
                helperText="What is causing the issue? (Can be filled after diagnosis)"
              />
              <TextField
                fullWidth
                label="Correction (3rd C)"
                name="correction"
                value={actionItemForm.correction}
                onChange={handleActionItemInputChange}
                multiline
                rows={2}
                margin="normal"
                helperText="How was the issue fixed? (Can be filled after repair)"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Status"
                name="status"
                value={actionItemForm.status}
                onChange={handleActionItemInputChange}
                required
                margin="normal"
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button 
            onClick={selectedActionItem ? handleUpdateActionItem : handleCreateActionItem} 
            variant="contained"
            disabled={!actionItemForm.title || !actionItemForm.complaint}
          >
            {selectedActionItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

/**
 * Detail Panel Component for Service Orders
 * 
 * Displays detailed information about a service order including action items
 */
const ServiceOrderDetailPanel = ({ 
  serviceOrder, 
  customers, 
  vehicles, 
  technicians,
  onEditActionItem,
  onDeleteActionItem
}) => {
  // Find customer and vehicle names
  const customer = customers.find(c => c.id === serviceOrder.customer_id);
  const vehicle = vehicles.find(v => v.id === serviceOrder.vehicle_id);
  
  // Format dates
  const createdAt = serviceOrder.created_at 
    ? format(new Date(serviceOrder.created_at), 'MMM d, yyyy h:mm a')
    : 'N/A';
  
  const updatedAt = serviceOrder.updated_at
    ? format(new Date(serviceOrder.updated_at), 'MMM d, yyyy h:mm a')
    : 'N/A';
  
  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Service Order Overview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Service Order Details
              </Typography>
              <Typography variant="body2">
                <strong>Order #:</strong> {serviceOrder.number}
              </Typography>
              <Typography variant="body2">
                <strong>Customer:</strong> {customer?.name || 'Unknown'}
              </Typography>
              <Typography variant="body2">
                <strong>Vehicle:</strong> {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown'}
              </Typography>
              <Typography variant="body2">
                <strong>VIN:</strong> {vehicle?.vin || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Mileage:</strong> {serviceOrder.current_mileage?.toLocaleString() || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Engine Hours:</strong> {serviceOrder.current_hours?.toLocaleString() || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Created:</strong> {createdAt}
              </Typography>
              <Typography variant="body2">
                <strong>Last Updated:</strong> {updatedAt}
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong> {statusNames[serviceOrder.status] || serviceOrder.status}
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {serviceTypeNames[serviceOrder.service_type] || serviceOrder.service_type}
              </Typography>
              <Typography variant="body2">
                <strong>Urgency:</strong> {serviceOrder.urgency}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Complaints List */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Complaints
              </Typography>
              {serviceOrder.complaints && serviceOrder.complaints.length > 0 ? (
                <Box component="ul" sx={{ pl: 2 }}>
                  {serviceOrder.complaints.map((complaint, index) => (
                    <Typography component="li" variant="body2" key={index}>
                      {complaint.description}
                    </Typography>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No complaints recorded
                </Typography>
              )}
              
              {serviceOrder.initial_assessment && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>
                    Initial Assessment
                  </Typography>
                  <Typography variant="body2">
                    {serviceOrder.initial_assessment}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Location Info (for mobile/roadside) */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {serviceOrder.service_type === 'shop_service' ? 'Shop Information' : 'Location Information'}
              </Typography>
              
              {(serviceOrder.service_type === 'mobile_service' || serviceOrder.service_type === 'roadside_emergency') && serviceOrder.vehicle_location ? (
                <>
                  <Typography variant="body2">
                    <strong>Address:</strong> {serviceOrder.vehicle_location.current_address || 'N/A'}
                  </Typography>
                  {serviceOrder.vehicle_location.location_name && (
                    <Typography variant="body2">
                      <strong>Location Name:</strong> {serviceOrder.vehicle_location.location_name}
                    </Typography>
                  )}
                  {serviceOrder.vehicle_location.cross_streets && (
                    <Typography variant="body2">
                      <strong>Cross Streets:</strong> {serviceOrder.vehicle_location.cross_streets}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2">
                  Shop service - vehicle is at the repair facility
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Action Items */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Action Items
          </Typography>
          
          {serviceOrder.action_items && serviceOrder.action_items.length > 0 ? (
            serviceOrder.action_items.map((actionItem) => (
              <Accordion key={actionItem.id} sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Grid container alignItems="center">
                    <Grid item xs={8}>
                      <Typography variant="subtitle1">
                        {actionItem.title}
                      </Typography>
                    </Grid>
                    <Grid item xs={2}>
                      <Chip 
                        label={actionItem.status} 
                        color={
                          actionItem.status === 'completed' ? 'success' :
                          actionItem.status === 'in_progress' ? 'warning' :
                          'default'
                        } 
                        size="small" 
                      />
                    </Grid>
                    <Grid item xs={2}>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditActionItem(actionItem);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteActionItem(actionItem.id);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Grid>
                  </Grid>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* 3 C's Structure */}
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        3 C's Structure
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Complaint (1st C):
                        </Typography>
                        <Typography variant="body1">
                          {actionItem.complaint}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Cause (2nd C):
                        </Typography>
                        <Typography variant="body1">
                          {actionItem.cause || 'Not yet determined'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Correction (3rd C):
                        </Typography>
                        <Typography variant="body1">
                          {actionItem.correction || 'Not yet completed'}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {/* Assigned Technicians */}
                    {actionItem.assigned_technicians && actionItem.assigned_technicians.length > 0 && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Assigned Technicians
                        </Typography>
                        <Box component="ul" sx={{ pl: 2 }}>
                          {actionItem.assigned_technicians.map((assignment, index) => {
                            const tech = technicians.find(t => t.id === assignment.tech_id);
                            return (
                              <Typography component="li" variant="body2" key={index}>
                                {tech?.name || 'Unknown'} ({assignment.percentage}%)
                                {assignment.is_lead && ' - Lead Tech'}
                              </Typography>
                            );
                          })}
                        </Box>
                      </Grid>
                    )}
                    
                    {/* Line Items */}
                    {actionItem.line_items && actionItem.line_items.length > 0 && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Line Items
                        </Typography>
                        <Box sx={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Type</th>
                                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Description</th>
                                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Qty</th>
                                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Hours</th>
                                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Rate</th>
                                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {actionItem.line_items.map((item, index) => (
                                <tr key={index}>
                                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                  </td>
                                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                                    {item.description}
                                    {item.part_number && ` (${item.part_number})`}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>
                                    {item.quantity || '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>
                                    {item.hours || '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>
                                    {item.rate ? `$${item.rate.toFixed(2)}` : '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>
                                    {item.price ? `$${item.price.toFixed(2)}` : 
                                     (item.hours && item.rate) ? `$${(item.hours * item.rate).toFixed(2)}` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No action items have been created yet
            </Typography>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ServiceOrders;

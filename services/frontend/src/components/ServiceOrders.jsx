import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  useMediaQuery,
  useTheme,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { useApi } from '../services/api';
import { format } from 'date-fns';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';

// Service Order Status Options with colors
const SERVICE_ORDER_STATUSES = [
  { value: 'service_requested', label: 'Service Requested', color: '#3498db' },
  { value: 'tech_assigned', label: 'Tech Assigned', color: '#9b59b6' },
  { value: 'tech_en_route', label: 'Tech En Route', color: '#2ecc71' },
  { value: 'tech_arrived', label: 'Tech Arrived', color: '#1abc9c' },
  { value: 'diagnosis_in_progress', label: 'Diagnosis In Progress', color: '#f1c40f' },
  { value: 'awaiting_approval', label: 'Awaiting Approval', color: '#e67e22' },
  { value: 'parts_being_sourced', label: 'Parts Being Sourced', color: '#d35400' },
  { value: 'repair_in_progress', label: 'Repair In Progress', color: '#e74c3c' },
  { value: 'quality_check', label: 'Quality Check', color: '#16a085' },
  { value: 'repair_complete', label: 'Repair Complete', color: '#27ae60' },
  { value: 'invoice_sent', label: 'Invoice Sent', color: '#2980b9' }
];

// Service Order urgency options
const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

// Service type options
const SERVICE_TYPE_OPTIONS = [
  { value: 'shop', label: 'Shop Service' },
  { value: 'mobile', label: 'Mobile Service' },
  { value: 'roadside', label: 'Roadside Assistance' }
];

// Create Service Order Validation Schema
const serviceOrderSchema = Yup.object().shape({
  customer_id: Yup.string().required('Customer is required'),
  vehicle_id: Yup.string().required('Vehicle is required'),
  complaint: Yup.string().required('Complaint is required').min(5, 'Complaint must be at least 5 characters'),
  service_type: Yup.string().required('Service type is required'),
  urgency: Yup.string().required('Urgency is required')
});

// Edit Service Order Validation Schema
const serviceOrderEditSchema = Yup.object().shape({
  complaint: Yup.string().required('Complaint is required').min(5, 'Complaint must be at least 5 characters'),
  cause: Yup.string(),
  correction: Yup.string(),
  status: Yup.string().required('Status is required')
});

/**
 * Status Chip Component
 * Displays a status with appropriate color
 */
const StatusChip = ({ status }) => {
  const statusObj = SERVICE_ORDER_STATUSES.find(s => s.value === status) || 
    { value: status, label: status.replace(/_/g, ' '), color: '#7f8c8d' };
  
  return (
    <Chip 
      label={statusObj.label} 
      sx={{ 
        backgroundColor: `${statusObj.color}20`, // 20% opacity
        color: statusObj.color,
        borderColor: statusObj.color,
        fontWeight: 'medium',
        border: '1px solid'
      }}
    />
  );
};

/**
 * Service Orders Component
 * Manages the list, creation, editing, and deletion of service orders
 */
const ServiceOrders = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const api = useApi();
  
  // State for service orders and related data
  const [serviceOrders, setServiceOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for modal dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedServiceOrder, setSelectedServiceOrder] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // State for notifications
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // State for filtering
  const [filterModel, setFilterModel] = useState({
    status: '',
    customer: '',
    searchQuery: ''
  });
  
  // Fetch service orders on component mount
  useEffect(() => {
    fetchServiceOrders();
    fetchCustomers();
    fetchVehicles();
  }, []);

  // Fetch customer vehicles when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerVehicles(selectedCustomerId);
    } else {
      setCustomerVehicles([]);
    }
  }, [selectedCustomerId]);

  // Fetch service orders from API
  const fetchServiceOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getServiceOrders();
      setServiceOrders(data);
    } catch (err) {
      setError(err.message);
      showSnackbar('Failed to load service orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers from API
  const fetchCustomers = async () => {
    try {
      const data = await api.getCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  // Fetch vehicles from API
  const fetchVehicles = async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data || []);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    }
  };

  // Fetch vehicles for a specific customer
  const fetchCustomerVehicles = async (customerId) => {
    try {
      const data = await api.getVehiclesByCustomer(customerId);
      setCustomerVehicles(data || []);
    } catch (err) {
      console.error('Failed to fetch customer vehicles:', err);
      setCustomerVehicles([]);
    }
  };

  // Handle create service order
  const handleCreateServiceOrder = async (values, { setSubmitting, resetForm }) => {
    try {
      await api.createServiceOrder(values);
      showSnackbar('Service order created successfully', 'success');
      setCreateDialogOpen(false);
      resetForm();
      fetchServiceOrders();
    } catch (err) {
      showSnackbar(`Failed to create service order: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit service order
  const handleEditServiceOrder = async (values, { setSubmitting }) => {
    try {
      await api.updateServiceOrder(selectedServiceOrder.id, values);
      showSnackbar('Service order updated successfully', 'success');
      setEditDialogOpen(false);
      fetchServiceOrders();
    } catch (err) {
      showSnackbar(`Failed to update service order: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete service order
  const handleDeleteServiceOrder = async () => {
    try {
      await api.deleteServiceOrder(selectedServiceOrder.id);
      showSnackbar('Service order deleted successfully', 'success');
      setDeleteDialogOpen(false);
      fetchServiceOrders();
    } catch (err) {
      showSnackbar(`Failed to delete service order: ${err.message}`, 'error');
    }
  };

  // Handle status update
  const handleStatusUpdate = async () => {
    try {
      await api.updateServiceOrderStatus(selectedServiceOrder.id, selectedStatus);
      showSnackbar('Status updated successfully', 'success');
      setStatusDialogOpen(false);
      fetchServiceOrders();
    } catch (err) {
      showSnackbar(`Failed to update status: ${err.message}`, 'error');
    }
  };

  // Show snackbar notification
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Open edit dialog with selected service order
  const openEditDialog = (serviceOrder) => {
    setSelectedServiceOrder(serviceOrder);
    setEditDialogOpen(true);
  };

  // Open delete dialog with selected service order
  const openDeleteDialog = (serviceOrder) => {
    setSelectedServiceOrder(serviceOrder);
    setDeleteDialogOpen(true);
  };

  // Open status dialog with selected service order
  const openStatusDialog = (serviceOrder) => {
    setSelectedServiceOrder(serviceOrder);
    setSelectedStatus(serviceOrder.status);
    setStatusDialogOpen(true);
  };

  // Handle customer change in create form
  const handleCustomerChange = (event, setFieldValue) => {
    const customerId = event.target.value;
    setSelectedCustomerId(customerId);
    setFieldValue('customer_id', customerId);
    setFieldValue('vehicle_id', '');
  };

  // Filter service orders based on filter model
  const filteredServiceOrders = useMemo(() => {
    return serviceOrders.filter(order => {
      // Filter by status
      if (filterModel.status && order.status !== filterModel.status) {
        return false;
      }
      
      // Filter by customer
      if (filterModel.customer && order.customer_id !== filterModel.customer) {
        return false;
      }
      
      // Search query (across multiple fields)
      if (filterModel.searchQuery) {
        const query = filterModel.searchQuery.toLowerCase();
        const matchesNumber = order.number.toLowerCase().includes(query);
        const matchesComplaint = order.complaint.toLowerCase().includes(query);
        
        // Find customer name
        const customer = customers.find(c => c.id === order.customer_id);
        const matchesCustomer = customer && customer.name.toLowerCase().includes(query);
        
        if (!matchesNumber && !matchesComplaint && !matchesCustomer) {
          return false;
        }
      }
      
      return true;
    });
  }, [serviceOrders, filterModel, customers]);

  // DataGrid columns definition
  const columns = [
    {
      field: 'number',
      headerName: 'Order #',
      flex: 0.8,
      minWidth: 120
    },
    {
      field: 'customer_name',
      headerName: 'Customer',
      flex: 1.5,
      minWidth: 180,
      valueGetter: (params) => {
        const customer = customers.find(c => c.id === params.row.customer_id);
        return customer ? customer.name : 'Unknown';
      }
    },
    {
      field: 'vehicle_info',
      headerName: 'Vehicle',
      flex: 1.5,
      minWidth: 180,
      valueGetter: (params) => {
        const vehicle = vehicles.find(v => v.id === params.row.vehicle_id);
        return vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown';
      }
    },
    {
      field: 'complaint',
      headerName: 'Complaint',
      flex: 2,
      minWidth: 200
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1.2,
      minWidth: 150,
      renderCell: (params) => <StatusChip status={params.value} />
    },
    {
      field: 'created_at',
      headerName: 'Created',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params) => format(new Date(params.value), 'MM/dd/yyyy')
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      minWidth: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEditDialog(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => openDeleteDialog(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Service Orders
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Service Order
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchServiceOrders}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              label="Search"
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                endAdornment: filterModel.searchQuery ? (
                  <IconButton 
                    size="small" 
                    onClick={() => setFilterModel({...filterModel, searchQuery: ''})}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ) : null
              }}
              value={filterModel.searchQuery}
              onChange={(e) => setFilterModel({...filterModel, searchQuery: e.target.value})}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={filterModel.status}
                label="Status"
                onChange={(e) => setFilterModel({...filterModel, status: e.target.value})}
              >
                <MenuItem value="">
                  <em>All Statuses</em>
                </MenuItem>
                {SERVICE_ORDER_STATUSES.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="customer-filter-label">Customer</InputLabel>
              <Select
                labelId="customer-filter-label"
                value={filterModel.customer}
                label="Customer"
                onChange={(e) => setFilterModel({...filterModel, customer: e.target.value})}
              >
                <MenuItem value="">
                  <em>All Customers</em>
                </MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12} md={3} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <Button
              variant="text"
              startIcon={<ClearIcon />}
              onClick={() => setFilterModel({ status: '', customer: '', searchQuery: '' })}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Data Grid */}
      <Paper sx={{ height: 'calc(100vh - 250px)', width: '100%', mb: 3 }}>
        <DataGrid
          rows={filteredServiceOrders}
          columns={columns}
          loading={loading}
          disableSelectionOnClick
          autoHeight={isMobile}
          getRowId={(row) => row.id}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 }
            },
            sorting: {
              sortModel: [{ field: 'created_at', sort: 'desc' }]
            }
          }}
          pageSizeOptions={[5, 10, 25, 50]}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none'
            }
          }}
          onRowClick={(params) => openEditDialog(params.row)}
        />
      </Paper>

      {/* Create Service Order Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Create New Service Order</DialogTitle>
        <Formik
          initialValues={{
            customer_id: '',
            vehicle_id: '',
            complaint: '',
            service_type: 'shop',
            urgency: 'normal'
          }}
          validationSchema={serviceOrderSchema}
          onSubmit={handleCreateServiceOrder}
        >
          {({ isSubmitting, values, errors, touched, handleChange, handleBlur, setFieldValue }) => (
            <Form>
              <DialogContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={touched.customer_id && Boolean(errors.customer_id)}>
                      <InputLabel id="customer-label">Customer</InputLabel>
                      <Select
                        labelId="customer-label"
                        name="customer_id"
                        value={values.customer_id}
                        label="Customer"
                        onChange={(e) => handleCustomerChange(e, setFieldValue)}
                        onBlur={handleBlur}
                      >
                        {customers.map((customer) => (
                          <MenuItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {touched.customer_id && errors.customer_id && (
                        <Typography color="error" variant="caption">
                          {errors.customer_id}
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={touched.vehicle_id && Boolean(errors.vehicle_id)}>
                      <InputLabel id="vehicle-label">Vehicle</InputLabel>
                      <Select
                        labelId="vehicle-label"
                        name="vehicle_id"
                        value={values.vehicle_id}
                        label="Vehicle"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={!values.customer_id}
                      >
                        {customerVehicles.map((vehicle) => (
                          <MenuItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.year} {vehicle.make} {vehicle.model} - {vehicle.vin}
                          </MenuItem>
                        ))}
                      </Select>
                      {touched.vehicle_id && errors.vehicle_id && (
                        <Typography color="error" variant="caption">
                          {errors.vehicle_id}
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="complaint"
                      label="Complaint / Issue Description"
                      multiline
                      rows={3}
                      value={values.complaint}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.complaint && Boolean(errors.complaint)}
                      helperText={touched.complaint && errors.complaint}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="service-type-label">Service Type</InputLabel>
                      <Select
                        labelId="service-type-label"
                        name="service_type"
                        value={values.service_type}
                        label="Service Type"
                        onChange={handleChange}
                        onBlur={handleBlur}
                      >
                        {SERVICE_TYPE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="urgency-label">Urgency</InputLabel>
                      <Select
                        labelId="urgency-label"
                        name="urgency"
                        value={values.urgency}
                        label="Urgency"
                        onChange={handleChange}
                        onBlur={handleBlur}
                      >
                        {URGENCY_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="primary" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <CircularProgress size={24} /> : 'Create Service Order'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* Edit Service Order Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Edit Service Order {selectedServiceOrder?.number}</DialogTitle>
        {selectedServiceOrder && (
          <Formik
            initialValues={{
              complaint: selectedServiceOrder.complaint || '',
              cause: selectedServiceOrder.cause || '',
              correction: selectedServiceOrder.correction || '',
              status: selectedServiceOrder.status || 'service_requested',
              technician_ids: selectedServiceOrder.technician_ids || []
            }}
            validationSchema={serviceOrderEditSchema}
            onSubmit={handleEditServiceOrder}
          >
            {({ isSubmitting, values, errors, touched, handleChange, handleBlur }) => (
              <Form>
                <DialogContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" color="text.secondary">
                          Customer: {customers.find(c => c.id === selectedServiceOrder.customer_id)?.name || 'Unknown'}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                          Vehicle: {vehicles.find(v => v.id === selectedServiceOrder.vehicle_id)?.make || 'Unknown'} {vehicles.find(v => v.id === selectedServiceOrder.vehicle_id)?.model || ''}
                        </Typography>
                      </Box>
                      <Divider sx={{ mb: 2 }} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        name="complaint"
                        label="Complaint / Issue Description"
                        multiline
                        rows={2}
                        value={values.complaint}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.complaint && Boolean(errors.complaint)}
                        helperText={touched.complaint && errors.complaint}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        name="cause"
                        label="Cause (Diagnosis)"
                        multiline
                        rows={2}
                        value={values.cause}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.cause && Boolean(errors.cause)}
                        helperText={touched.cause && errors.cause}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        name="correction"
                        label="Correction (Repair Details)"
                        multiline
                        rows={2}
                        value={values.correction}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.correction && Boolean(errors.correction)}
                        helperText={touched.correction && errors.correction}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth error={touched.status && Boolean(errors.status)}>
                        <InputLabel id="status-label">Status</InputLabel>
                        <Select
                          labelId="status-label"
                          name="status"
                          value={values.status}
                          label="Status"
                          onChange={handleChange}
                          onBlur={handleBlur}
                        >
                          {SERVICE_ORDER_STATUSES.map((status) => (
                            <MenuItem key={status.value} value={status.value}>
                              {status.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {touched.status && errors.status && (
                          <Typography color="error" variant="caption">
                            {errors.status}
                          </Typography>
                        )}
                      </FormControl>
                    </Grid>
                  </Grid>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    color="primary" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <CircularProgress size={24} /> : 'Update Service Order'}
                  </Button>
                </DialogActions>
              </Form>
            )}
          </Formik>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Service Order</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete service order #{selectedServiceOrder?.number}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteServiceOrder} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
      >
        <DialogTitle>Update Status</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Update status for service order #{selectedServiceOrder?.number}
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="status-update-label">Status</InputLabel>
            <Select
              labelId="status-update-label"
              value={selectedStatus}
              label="Status"
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              {SERVICE_ORDER_STATUSES.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleStatusUpdate} 
            color="primary" 
            variant="contained"
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ServiceOrders;

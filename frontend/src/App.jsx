import React, { useState, useEffect, useMemo, createContext, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Toolbar, Typography, IconButton, Drawer, List, ListItem,
  ListItemIcon, ListItemText, Container, Paper, Button, Divider, useMediaQuery,
  CircularProgress, Alert, Snackbar, Switch, FormControlLabel, CssBaseline,
  Tooltip, Menu, MenuItem, Avatar, Badge, Chip
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Build as BuildIcon,
  DirectionsCar as VehicleIcon,
  People as PeopleIcon,
  Engineering as TechnicianIcon,
  Settings as SettingsIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Notifications as NotificationsIcon,
  LocalShipping as TruckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

// Import our ApiContext provider
import { ApiProvider, useApi } from './contexts/ApiContext';

// Import components (these will be lazy loaded in production)
import ServiceOrders from './components/ServiceOrders';

// Define ErrorBoundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            m: 4, 
            textAlign: 'center',
            backgroundColor: (theme) => theme.palette.error.light,
            color: (theme) => theme.palette.error.contrastText
          }}
        >
          <WarningIcon sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            The application encountered an error. Please try refreshing the page.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => window.location.reload()}
          >
            Refresh Application
          </Button>
        </Paper>
      );
    }
    return this.props.children;
  }
}

// Create theme context
const ColorModeContext = createContext({ toggleColorMode: () => {} });

// Main App component
const App = () => {
  const [mode, setMode] = useState('light');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Color mode context
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
        // Save preference to localStorage
        localStorage.setItem('themeMode', mode === 'light' ? 'dark' : 'light');
      },
    }),
    [mode],
  );
  
  // Load saved theme preference on initial load
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode');
    if (savedMode) {
      setMode(savedMode);
    }
  }, []);

  // Create theme based on mode
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            // Deep blue for heavy-duty industry feel
            main: '#1a3c6e',
            light: '#4565a0',
            dark: '#0d1b3e',
            contrastText: '#ffffff',
          },
          secondary: {
            // Orange accent for alerts and highlights
            main: '#f57c00',
            light: '#ffad42',
            dark: '#bb4d00',
            contrastText: '#000000',
          },
          error: {
            main: '#d32f2f',
          },
          warning: {
            main: '#ffa000',
          },
          info: {
            main: '#0288d1',
          },
          success: {
            main: '#388e3c',
          },
          background: {
            default: mode === 'light' ? '#f5f5f7' : '#121212',
            paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
          },
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          h1: {
            fontWeight: 700,
          },
          h2: {
            fontWeight: 600,
          },
          h3: {
            fontWeight: 600,
          },
          h4: {
            fontWeight: 600,
          },
          h5: {
            fontWeight: 500,
          },
          h6: {
            fontWeight: 500,
          },
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 500,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: mode === 'light' 
                  ? '0px 2px 4px -1px rgba(0,0,0,0.1), 0px 4px 5px 0px rgba(0,0,0,0.07), 0px 1px 10px 0px rgba(0,0,0,0.06)'
                  : '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
        },
      }),
    [mode],
  );

  // Check if screen is mobile
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Handle drawer toggle
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Navigation items
  const navItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Service Orders', icon: <BuildIcon />, path: '/service-orders' },
    { text: 'Customers', icon: <PeopleIcon />, path: '/customers' },
    { text: 'Vehicles', icon: <VehicleIcon />, path: '/vehicles' },
    { text: 'Technicians', icon: <TechnicianIcon />, path: '/technicians' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  // Navigation drawer content
  const drawerContent = (
    <Box sx={{ width: 250, pt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TruckIcon sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h6" component="div">
            AFS FleetPro
          </Typography>
        </Box>
      </Box>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem 
            button 
            key={item.text} 
            component={NavLink} 
            to={item.path}
            onClick={() => isMobile && setDrawerOpen(false)}
            sx={{
              '&.active': {
                backgroundColor: (theme) => theme.palette.action.selected,
                borderLeft: (theme) => `4px solid ${theme.palette.primary.main}`,
                '& .MuiListItemIcon-root': {
                  color: (theme) => theme.palette.primary.main,
                },
              },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={mode === 'dark'}
              onChange={colorMode.toggleColorMode}
              icon={<LightModeIcon />}
              checkedIcon={<DarkModeIcon />}
            />
          }
          label={mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
        />
      </Box>
    </Box>
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ApiProvider>
          <Router>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              {/* App Bar */}
              <AppBar position="fixed">
                <Toolbar>
                  <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={toggleDrawer}
                    sx={{ mr: 2 }}
                  >
                    <MenuIcon />
                  </IconButton>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TruckIcon sx={{ mr: 1, fontSize: 28 }} />
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                      AFS FleetPro
                    </Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1 }} />
                  <DemoDataButton setSnackbar={setSnackbar} />
                  <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
                    <Tooltip title="Notifications">
                      <IconButton color="inherit">
                        <Badge badgeContent={3} color="secondary">
                          <NotificationsIcon />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                      <IconButton color="inherit" onClick={colorMode.toggleColorMode}>
                        {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                      </IconButton>
                    </Tooltip>
                    <Chip
                      avatar={<Avatar>U</Avatar>}
                      label="User"
                      sx={{ ml: 2, color: 'white' }}
                      variant="outlined"
                    />
                  </Box>
                </Toolbar>
              </AppBar>
              
              {/* Navigation Drawer */}
              <Drawer
                variant={isMobile ? 'temporary' : 'permanent'}
                open={isMobile ? drawerOpen : true}
                onClose={toggleDrawer}
                sx={{
                  width: 250,
                  flexShrink: 0,
                  '& .MuiDrawer-paper': {
                    width: 250,
                    boxSizing: 'border-box',
                    top: isMobile ? 0 : 64, // Below AppBar on desktop
                    height: isMobile ? '100%' : 'calc(100% - 64px)',
                  },
                }}
              >
                {drawerContent}
              </Drawer>
              
              {/* Main Content */}
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  p: 3,
                  mt: 8, // Space for AppBar
                  ml: { sm: 0, md: '250px' }, // Space for permanent drawer on desktop
                }}
              >
                <ErrorBoundary>
                  <Suspense fallback={
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                      <CircularProgress />
                    </Box>
                  }>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/service-orders" element={<ServiceOrders />} />
                      <Route path="/customers" element={<ComingSoon title="Customers" />} />
                      <Route path="/vehicles" element={<ComingSoon title="Vehicles" />} />
                      <Route path="/technicians" element={<ComingSoon title="Technicians" />} />
                      <Route path="/settings" element={<ComingSoon title="Settings" />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </Box>
              
              {/* Footer */}
              <Box
                component="footer"
                sx={{
                  py: 3,
                  px: 2,
                  mt: 'auto',
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'light'
                      ? theme.palette.grey[200]
                      : theme.palette.grey[800],
                  ml: { sm: 0, md: '250px' }, // Space for permanent drawer on desktop
                }}
              >
                <Container maxWidth="lg">
                  <Typography variant="body2" color="text.secondary" align="center">
                    AFS FleetPro © {new Date().getFullYear()} - Heavy-Duty Fleet Repair Management
                  </Typography>
                </Container>
              </Box>
            </Box>
          </Router>
          
          {/* Global Snackbar */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </ApiProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

// Demo Data Button Component
const DemoDataButton = ({ setSnackbar }) => {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  
  const handleInitializeDemoData = async () => {
    try {
      setLoading(true);
      await api.demoData.initialize();
      setSnackbar({
        open: true,
        message: 'Demo data initialized successfully!',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to initialize demo data: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button
      variant="contained"
      color="secondary"
      size="small"
      onClick={handleInitializeDemoData}
      disabled={loading}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
      sx={{ mr: 2 }}
    >
      {loading ? 'Loading...' : 'Init Demo Data'}
    </Button>
  );
};

// Dashboard Component
const Dashboard = () => {
  const api = useApi();
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" paragraph>
          Welcome to AFS FleetPro - Heavy-Duty Fleet Repair Management System
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          This is a development version. Use the navigation to explore available features.
        </Alert>
        
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Stats
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Paper sx={{ p: 2, flexGrow: 1, bgcolor: 'primary.light', color: 'white' }}>
              <Typography variant="h4">{api.serviceOrders.length}</Typography>
              <Typography variant="body2">Service Orders</Typography>
            </Paper>
            <Paper sx={{ p: 2, flexGrow: 1, bgcolor: 'secondary.light', color: 'white' }}>
              <Typography variant="h4">{api.customers.length}</Typography>
              <Typography variant="body2">Customers</Typography>
            </Paper>
            <Paper sx={{ p: 2, flexGrow: 1, bgcolor: 'success.light', color: 'white' }}>
              <Typography variant="h4">{api.vehicles.length}</Typography>
              <Typography variant="body2">Vehicles</Typography>
            </Paper>
          </Box>
        </Paper>
        
        <Button
          variant="contained"
          color="primary"
          component={NavLink}
          to="/service-orders"
          startIcon={<BuildIcon />}
        >
          Go to Service Orders
        </Button>
      </Box>
    </Container>
  );
};

// Coming Soon Component
const ComingSoon = ({ title }) => {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Paper sx={{ p: 4, my: 4, bgcolor: 'info.light', color: 'white' }}>
          <Typography variant="h5" gutterBottom>
            Coming Soon
          </Typography>
          <Typography variant="body1">
            This feature is under development and will be available soon.
          </Typography>
        </Paper>
        <Button
          variant="contained"
          component={NavLink}
          to="/"
        >
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
};

// Not Found Component
const NotFound = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          404 - Page Not Found
        </Typography>
        <Paper sx={{ p: 4, my: 4, bgcolor: 'error.light', color: 'white' }}>
          <Typography variant="h5" gutterBottom>
            The page you're looking for doesn't exist.
          </Typography>
          <Typography variant="body1">
            Please check the URL or navigate back to the dashboard.
          </Typography>
        </Paper>
        <Button
          variant="contained"
          component={NavLink}
          to="/"
        >
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
};

export default App;

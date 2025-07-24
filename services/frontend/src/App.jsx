import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, CssBaseline, Drawer, AppBar, Toolbar, Typography, Divider, 
  List, ListItem, ListItemIcon, ListItemText, IconButton, Container, 
  CircularProgress, Button, useMediaQuery, useTheme } from '@mui/material';
import { 
  Menu as MenuIcon, 
  Dashboard as DashboardIcon,
  Assignment as ServiceOrderIcon,
  DirectionsCar as VehicleIcon,
  Business as CustomerIcon,
  Person as TechnicianIcon,
  Message as MessageIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';

// New context & provider
import { ApiProvider, ApiContext } from './contexts/ApiContext';

// Real Service Orders component
import ServiceOrders from './components/ServiceOrders';

// Mock authentication - in production use proper auth
const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate authentication check
    const checkAuth = async () => {
      try {
        // In production, validate token with backend
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    // Simulate login request
    try {
      // In production, call actual login API
      const mockUser = {
        id: 'user-123',
        name: 'Demo User',
        role: 'admin',
        token: 'mock-jwt-token'
      };
      
      localStorage.setItem('user', JSON.stringify(mockUser));
      setUser(mockUser);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, user, loading, login, logout };
};

// Auth context
const AuthContext = React.createContext(null);

// Auth provider component
const AuthProvider = ({ children }) => {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = React.useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Layout components
const drawerWidth = 240;

const DashboardLayout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = React.useContext(AuthContext);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Service Orders', icon: <ServiceOrderIcon />, path: '/service-orders' },
    { text: 'Vehicles', icon: <VehicleIcon />, path: '/vehicles' },
    { text: 'Customers', icon: <CustomerIcon />, path: '/customers' },
    { text: 'Technicians', icon: <TechnicianIcon />, path: '/technicians' },
    { text: 'Messages', icon: <MessageIcon />, path: '/messages' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const drawer = (
    <div>
      <Toolbar sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'primary.dark',
        color: 'white',
        py: 1
      }}>
        <Typography variant="h6" noWrap component="div">
          AFS FleetPro
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem button key={item.text} component="a" href={item.path}>
            <ListItemIcon sx={{ color: 'primary.main' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem button onClick={logout}>
          <ListItemIcon sx={{ color: 'error.main' }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            AFS FleetPro
          </Typography>
          <IconButton color="inherit">
            <SearchIcon />
          </IconButton>
          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>
          <Typography variant="body1" sx={{ ml: 2 }}>
            {user?.name || 'User'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: 'background.default',
          minHeight: '100vh'
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Container maxWidth="xl">
          {children}
        </Container>
      </Box>
    </Box>
  );
};

// Page components (placeholders)
const Dashboard = () => (
  <Box>
    <Typography variant="h4" gutterBottom>Dashboard</Typography>
    <Typography paragraph>
      Welcome to AFS FleetPro - your complete fleet repair management solution.
    </Typography>
    {/* Dashboard content would go here */}
  </Box>
);

const Login = () => {
  const { login } = React.useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  
  const handleLogin = async () => {
    setLoading(true);
    const success = await login({ username: 'demo', password: 'password' });
    setLoading(false);
    
    if (success) {
      const origin = location.state?.from?.pathname || '/dashboard';
      window.location.href = origin;
    }
  };
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        backgroundColor: 'background.default',
        p: 3
      }}
    >
      <Box 
        sx={{ 
          maxWidth: 400, 
          width: '100%', 
          p: 4, 
          borderRadius: 2, 
          boxShadow: 3,
          backgroundColor: 'white',
          textAlign: 'center'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          AFS FleetPro
        </Typography>
        <Typography variant="h6" gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Demo Mode - Click the button below to sign in
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          fullWidth 
          size="large"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
        </Button>
      </Box>
    </Box>
  );
};

// Customer portal tracker demo
const TrackerDemo = () => {
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { portalApi } = React.useContext(ApiContext);
  
  useEffect(() => {
    const fetchTracker = async () => {
      try {
        // Demo token hardcoded for Railway deployment
        const response = await portalApi.get('/portal/v1/tracker/demo1234567890abcdef1234567890ab');
        setTracker(response.data);
      } catch (err) {
        console.error('Error fetching tracker:', err);
        setError('Could not load tracker data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTracker();
  }, [portalApi]);
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ 
      maxWidth: 600, 
      mx: 'auto', 
      p: 3, 
      mt: 5, 
      borderRadius: 2, 
      boxShadow: 3,
      backgroundColor: 'white'
    }}>
      <Typography variant="h4" gutterBottom>Service Tracker</Typography>
      {tracker && (
        <>
          <Typography variant="h6">Vehicle: {tracker.vehicle.year} {tracker.vehicle.make} {tracker.vehicle.model}</Typography>
          <Typography variant="body1">Status: {tracker.status}</Typography>
          <Typography variant="body1">ETA: {tracker.eta || 'Not available'}</Typography>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6">Status Updates</Typography>
            {tracker.events?.map((event, index) => (
              <Box key={index} sx={{ mt: 1, p: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                <Typography variant="body2">
                  {event.status} - {new Date(event.timestamp).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

// Main App component
function App() {
  return (
    <AuthProvider>
      <ApiProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/tracker" element={<TrackerDemo />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/service-orders" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ServiceOrders />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          {/* Redirect root to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ApiProvider>
    </AuthProvider>
  );
}

export default App;

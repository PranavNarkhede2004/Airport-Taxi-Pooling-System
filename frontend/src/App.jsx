import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './router/ProtectedRoute'

// Layout Components
import Layout from './components/Layout'

// Page Components
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import BookRide from './pages/BookRide'
import RideTracking from './pages/RideTracking'
import RideHistory from './pages/RideHistory'
import Profile from './pages/Profile'
import TestTailwind from './TestTailwind'
import MinimalTest from './MinimalTest'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPools from './pages/admin/AdminPools'
import AdminRides from './pages/admin/AdminRides'
import AdminSurge from './pages/admin/AdminSurge'
import AdminDrivers from './pages/admin/AdminDrivers'

// Driver Pages
import DriverDashboard from './pages/driver/DriverDashboard'

// Loading Component
import { Loader2 } from 'lucide-react'

function App() {
  const { checkAuth, isAuthenticated, isLoading } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Airport Pooling</h2>
          <p className="text-gray-600">Please wait while we prepare your experience...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        } 
      />
      <Route 
        path="/register" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
        } 
      />

      {/* Protected Passenger Routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        
        <Route 
          path="dashboard" 
          element={
            <ProtectedRoute requiredRole="passenger">
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="book" 
          element={
            <ProtectedRoute requiredRole="passenger">
              <BookRide />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="rides/:id" 
          element={
            <ProtectedRoute requiredRole="passenger">
              <RideTracking />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="rides/history" 
          element={
            <ProtectedRoute requiredRole="passenger">
              <RideHistory />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* Protected Driver Routes */}
      <Route path="/driver" element={<Layout />}>
        <Route 
          index 
          element={
            <ProtectedRoute requiredRole="driver">
              <Navigate to="/driver/dashboard" replace />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="dashboard" 
          element={
            <ProtectedRoute requiredRole="driver">
              <DriverDashboard />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/admin" element={<Layout />}>
        <Route 
          index 
          element={
            <ProtectedRoute requiredRole="admin">
              <Navigate to="/admin/dashboard" replace />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="dashboard" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="pools" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPools />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="rides" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRides />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="surge" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSurge />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="drivers" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDrivers />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* 404 Route */}
      <Route 
        path="*" 
        element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
              <p className="text-gray-600 mb-8">Page not found</p>
              <a 
                href="/dashboard" 
                className="btn btn-primary"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        } 
      />
    </Routes>
  )
}

export default App

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader2 } from 'lucide-react'

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user, isLoading, checkAuth } = useAuthStore()

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // If role is required and user doesn't have it, redirect
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect based on user role
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />
    } else if (user?.role === 'driver') {
      return <Navigate to="/driver/dashboard" replace />
    } else {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}

export default ProtectedRoute

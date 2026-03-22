import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useSocket } from '../hooks/useSocket'
import {
  Home,
  Car,
  Clock,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  Users,
  TrendingUp,
  Zap,
  Shield
} from 'lucide-react'

const Layout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAdmin, getGreeting, getUserInitials } = useAuthStore()
  const { isConnected } = useSocket()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState(0)

  const passengerNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Book Ride', href: '/book', icon: Car },
    { name: 'Ride History', href: '/rides/history', icon: Clock },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const adminNavigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: Home },
    { name: 'Active Pools', href: '/admin/pools', icon: Users },
    { name: 'All Rides', href: '/admin/rides', icon: Car },
    { name: 'Surge Control', href: '/admin/surge', icon: Zap },
    { name: 'Driver Management', href: '/admin/drivers', icon: Shield },
    { name: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
  ]

  const driverNavigation = [
    { name: 'Driver Dashboard', href: '/driver/dashboard', icon: Home },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const navigation = isAdmin() ? adminNavigation : (user?.role === 'driver' ? driverNavigation : passengerNavigation)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    // Close sidebar when route changes
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">Airport Pooling</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 font-medium">
                {getUserInitials()}
              </span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Greeting */}
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900">
                {getGreeting()}
              </h1>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Connection status */}
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500 hidden sm:block">
                  {isConnected ? 'Connected' : 'Offline'}
                </span>
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-gray-500">
                <Bell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {/* User menu */}
              <div className="relative">
                <button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-medium text-sm">
                      {getUserInitials()}
                    </span>
                  </div>
                </button>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-500"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout

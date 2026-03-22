import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSocket } from '../hooks/useSocket'
import { ridesAPI } from '../api/rides'
import {
  Car,
  Clock,
  MapPin,
  Users,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  ArrowRight
} from 'lucide-react'

const Dashboard = () => {
  const { user, getGreeting } = useAuthStore()
  const { joinRide } = useSocket()

  // Fetch active rides
  const { data: activeRidesData, isLoading: isLoadingActive } = useQuery({
    queryKey: ['active-rides'],
    queryFn: ridesAPI.getActiveRides,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch ride history
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['ride-history', { page: 1, limit: 3 }],
    queryFn: () => ridesAPI.getRideHistory({ page: 1, limit: 3 }),
  })

  const activeRides = activeRidesData?.data?.rides || []
  const recentRides = historyData?.data?.rides || []

  // Join socket rooms for active rides
  React.useEffect(() => {
    activeRides.forEach(ride => {
      joinRide(ride._id)
    })
  }, [activeRides, joinRide])

  const getStatusColor = (status) => {
    const colors = {
      requested: 'bg-blue-100 text-blue-800',
      matched: 'bg-purple-100 text-purple-800',
      assigned: 'bg-orange-100 text-orange-800',
      in_progress: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h1 className="text-4xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {getGreeting()}
            </h1>
            <p className="mt-2 text-lg text-gray-600">Manage your airport rides and track your journeys</p>
            <div key={ride._id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-4">
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(ride.status)}`} />
                    <span className="font-medium">{getStatusText(ride.status)}</span>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ride.status)}`}>
                    {ride.isPool ? 'Pool' : 'Solo'}
                  </span>
                </div>

                {/* Route Info */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">From: </span>
                    <span className="ml-1 font-medium">{ride.pickup.address}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">To: </span>
                    <span className="ml-1 font-medium">{ride.destination.name}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Scheduled: </span>
                    <span className="ml-1 font-medium">{formatDate(ride.scheduledTime)}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Passengers: </span>
                    <span className="ml-1 font-medium">{ride.passengers}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Link
                    to={`/rides/${ride._id}`}
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex-1"
                  >
                    Track Ride
                  </Link>
                  {['requested', 'matched'].includes(ride.status) && (
                    <button className="inline-flex items-center justify-center px-4 py-2 border-2 border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/book"
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-200 group"
          >
            <div className="p-6">
              <Car className="w-8 h-8 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 mb-2">Book a Ride</h3>
              <p className="text-sm text-gray-600">Request a new airport ride</p>
            </div>
          </Link>
          <Link
            to="/rides/history"
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-200 group"
          >
            <div className="p-6">
              <Clock className="w-8 h-8 text-green-600 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 mb-2">Ride History</h3>
              <p className="text-sm text-gray-600">View your past rides</p>
            </div>
          </Link>
          <Link
            to="/profile"
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-200 group"
          >
            <div className="p-6">
              <Users className="w-8 h-8 text-purple-600 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 mb-2">Profile</h3>
              <p className="text-sm text-gray-600">Manage your account</p>
            </div>
          </Link>
          <Link
            to="/support"
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-200 group"
          >
            <div className="p-6">
              <AlertCircle className="w-8 h-8 text-orange-600 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 mb-2">Support</h3>
              <p className="text-sm text-gray-600">Get help & contact us</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Rides */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Rides</h2>
          <Link
            to="/rides/history"
            className="text-blue-600 hover:text-blue-500 text-sm font-medium flex items-center"
          >
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {isLoadingHistory ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : recentRides.length > 0 ? (
          <div className="space-y-4">
            {recentRides.map((ride) => (
              <div key={ride._id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-200">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(ride.status)}`} />
                        <span className="font-medium text-gray-900">
                          {ride.destination.name}
                        </span>
                        {ride.isPool && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">Pool</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(ride.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ₹{ride.pricing?.total || 0}
                      </div>
                      <Link
                        to={`/rides/${ride._id}`}
                        className="text-primary-600 hover:text-primary-500 text-sm"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="card-body text-center py-8">
              <Car className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No rides yet</h3>
              <p className="text-gray-600 mb-4">Book your first airport ride to get started</p>
              <Link to="/book" className="btn btn-primary">
                Book a Ride
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

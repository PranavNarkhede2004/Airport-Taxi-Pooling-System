import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ridesAPI } from '../api/rides'
import { Calendar, MapPin, Users, DollarSign, Eye } from 'lucide-react'

const RideHistory = () => {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['ride-history'],
    queryFn: () => ridesAPI.getRideHistory(),
  })

  const rides = historyData?.data?.rides || []

  const getStatusColor = (status) => {
    const colors = {
      requested: 'text-blue-600 bg-blue-100',
      matched: 'text-purple-600 bg-purple-100',
      assigned: 'text-orange-600 bg-orange-100',
      in_progress: 'text-green-600 bg-green-100',
      completed: 'text-gray-600 bg-gray-100',
      cancelled: 'text-red-600 bg-red-100',
    }
    return colors[status] || 'text-gray-600 bg-gray-100'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ride History</h1>
        <p className="mt-2 text-gray-600">View your past airport rides</p>
      </div>

      {rides.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rides yet</h3>
            <p className="text-gray-600 mb-6">You haven't taken any rides yet. Book your first ride to get started!</p>
            <Link to="/book" className="btn btn-primary">
              Book a Ride
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => (
            <div key={ride._id} className="card hover:shadow-medium transition-shadow">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className={`badge ${getStatusColor(ride.status)} mr-3`}>
                        {ride.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {ride.isPool && (
                        <span className="badge badge-primary">
                          Pool
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-900 font-medium">{ride.destination.address}</span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        {formatDate(ride.createdAt)}
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        {ride.passengers} passenger{ride.passengers > 1 ? 's' : ''}
                        {ride.luggage > 0 && ` • ${ride.luggage} luggage`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900 mb-2">
                      ₹{ride.pricing?.total || 0}
                    </div>
                    <Link
                      to={`/rides/${ride._id}`}
                      className="btn btn-outline btn-sm"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RideHistory

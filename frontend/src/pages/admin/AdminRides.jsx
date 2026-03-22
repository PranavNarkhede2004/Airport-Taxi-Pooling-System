import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminAPI } from '../../api/admin'
import { Car, MapPin, Calendar, Users, DollarSign } from 'lucide-react'

const AdminRides = () => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    airportCode: '',
    startDate: '',
    endDate: '',
  })

  const { data: ridesData, isLoading } = useQuery({
    queryKey: ['admin-rides', filters],
    queryFn: () => adminAPI.rides.getAllRides(filters),
    refetchInterval: 30000,
  })

  const rides = ridesData?.data?.rides || []
  const pagination = ridesData?.data?.pagination

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Rides</h1>
        <p className="mt-2 text-gray-600">Monitor and manage all ride requests</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input"
              >
                <option value="">All Status</option>
                <option value="requested">Requested</option>
                <option value="matched">Matched</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Airport</label>
              <select
                value={filters.airportCode}
                onChange={(e) => handleFilterChange('airportCode', e.target.value)}
                className="input"
              >
                <option value="">All Airports</option>
                <option value="BOM">Mumbai (BOM)</option>
                <option value="DEL">Delhi (DEL)</option>
                <option value="BLR">Bangalore (BLR)</option>
                <option value="HYD">Hyderabad (HYD)</option>
                <option value="MAA">Chennai (MAA)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rides List */}
      <div className="space-y-4">
        {rides.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No rides found</h3>
              <p className="text-gray-600">No rides match the current filters.</p>
            </div>
          </div>
        ) : (
          rides.map((ride) => (
            <div key={ride._id} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className={`badge ${getStatusColor(ride.status)}`}>
                      {ride.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {ride.isPool && (
                      <span className="badge badge-primary">POOL</span>
                    )}
                    <h3 className="font-semibold text-gray-900">
                      {ride.destination.name}
                    </h3>
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(ride.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm mb-4">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">From:</span>
                    <span className="ml-auto font-medium truncate" title={ride.pickup.address}>
                      {ride.pickup.address}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Scheduled:</span>
                    <span className="ml-auto font-medium">
                      {new Date(ride.scheduledTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Passengers:</span>
                    <span className="ml-auto font-medium">{ride.passengers}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Luggage:</span>
                    <span className="ml-auto font-medium">{ride.luggage}</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Price:</span>
                    <span className="ml-auto font-medium">₹{ride.pricing?.total || 0}</span>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <strong>Customer:</strong> {ride.userId?.name} ({ride.userId?.email}) | 
                  <strong> Flight:</strong> {ride.flightNumber}
                </div>

                <div className="flex space-x-3">
                  <button className="btn btn-outline btn-sm">
                    View Details
                  </button>
                  <button className="btn btn-outline btn-sm">
                    Track Ride
                  </button>
                  {['requested', 'matched'].includes(ride.status) && (
                    <button className="btn btn-danger btn-sm">
                      Cancel Ride
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => handleFilterChange('page', pagination.page - 1)}
              className="btn btn-outline btn-sm"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => handleFilterChange('page', pagination.page + 1)}
              className="btn btn-outline btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminRides

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminAPI } from '../../api/admin'
import { Users, MapPin, Clock, DollarSign } from 'lucide-react'

const AdminPools = () => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    airportCode: '',
  })

  const { data: poolsData, isLoading } = useQuery({
    queryKey: ['admin-pools', filters],
    queryFn: () => adminAPI.pools.getActivePools(filters),
    refetchInterval: 30000,
  })

  const pools = poolsData?.data?.pools || []
  const pagination = poolsData?.data?.pagination

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const getStatusColor = (status) => {
    const colors = {
      forming: 'text-blue-600 bg-blue-100',
      locked: 'text-orange-600 bg-orange-100',
      assigned: 'text-green-600 bg-green-100',
      completed: 'text-gray-600 bg-gray-100',
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
        <h1 className="text-3xl font-bold text-gray-900">Active Pools</h1>
        <p className="mt-2 text-gray-600">Monitor and manage active ride pools</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input"
              >
                <option value="">All Status</option>
                <option value="forming">Forming</option>
                <option value="locked">Locked</option>
                <option value="assigned">Assigned</option>
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
          </div>
        </div>
      </div>

      {/* Pools List */}
      <div className="space-y-4">
        {pools.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active pools</h3>
              <p className="text-gray-600">There are no active pools at the moment.</p>
            </div>
          </div>
        ) : (
          pools.map((pool) => (
            <div key={pool._id} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className={`badge ${getStatusColor(pool.status)}`}>
                      {pool.status.toUpperCase()}
                    </span>
                    <h3 className="font-semibold text-gray-900">
                      Pool to {pool.airportCode}
                    </h3>
                  </div>
                  <div className="text-sm text-gray-600">
                    Created: {new Date(pool.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Rides:</span>
                    <span className="ml-auto font-medium">{pool.rides?.length || 0}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Seats:</span>
                    <span className="ml-auto font-medium">{pool.totalSeats}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Deviation:</span>
                    <span className="ml-auto font-medium">{pool.totalDeviation} min</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Revenue:</span>
                    <span className="ml-auto font-medium">₹{pool.metrics?.totalRevenue || 0}</span>
                  </div>
                </div>

                <div className="mt-4 flex space-x-3">
                  <button className="btn btn-outline btn-sm">
                    View Details
                  </button>
                  <button className="btn btn-outline btn-sm">
                    Track Pool
                  </button>
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

export default AdminPools

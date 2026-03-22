import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '../../api/admin'
import { Car, Phone, Star, Users, Activity } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminDrivers = () => {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    search: '',
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState(null)

  const { data: driversData, isLoading } = useQuery({
    queryKey: ['admin-drivers', filters],
    queryFn: () => adminAPI.drivers.getAllDrivers(filters),
    refetchInterval: 30000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['driver-stats'],
    queryFn: adminAPI.drivers.getDriverStats,
    refetchInterval: 60000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ driverId, status }) => adminAPI.drivers.updateDriverStatus(driverId, { status }),
    onSuccess: () => {
      toast.success('Driver status updated successfully')
      queryClient.invalidateQueries(['admin-drivers'])
      queryClient.invalidateQueries(['driver-stats'])
    },
    onError: (error) => {
      toast.error('Failed to update driver status')
    },
  })

  const drivers = driversData?.data?.drivers || []
  const pagination = driversData?.data?.pagination
  const stats = statsData?.data

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handleStatusUpdate = (driverId, status) => {
    updateStatusMutation.mutate({ driverId, status })
  }

  const getStatusColor = (status) => {
    const colors = {
      available: 'text-green-600 bg-green-100',
      busy: 'text-orange-600 bg-orange-100',
      offline: 'text-gray-600 bg-gray-100',
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
        <h1 className="text-3xl font-bold text-gray-900">Driver Management</h1>
        <p className="mt-2 text-gray-600">Manage drivers and their availability</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Total Drivers</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats?.totalDrivers || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Available</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats?.availableDrivers || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Car className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Busy</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats?.busyDrivers || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Avg Rating</dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats?.averageRating ? stats.averageRating.toFixed(1) : 'N/A'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="input"
                >
                  <option value="">All Status</option>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search by name, phone, or plate"
                  className="input"
                />
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary"
            >
              Add Driver
            </button>
          </div>
        </div>
      </div>

      {/* Drivers List */}
      <div className="space-y-4">
        {drivers.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers found</h3>
              <p className="text-gray-600">No drivers match the current filters.</p>
            </div>
          </div>
        ) : (
          drivers.map((driver) => (
            <div key={driver._id} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className={`badge ${getStatusColor(driver.status)}`}>
                      {driver.status.toUpperCase()}
                    </span>
                    <h3 className="font-semibold text-gray-900">{driver.name}</h3>
                    {driver.verified && (
                      <span className="badge badge-success">VERIFIED</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Joined: {new Date(driver.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-auto font-medium">{driver.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <Car className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Vehicle:</span>
                    <span className="ml-auto font-medium">{driver.vehicle?.type}</span>
                  </div>
                  <div className="flex items-center">
                    <Car className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Plate:</span>
                    <span className="ml-auto font-medium">{driver.vehicle?.plate}</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Rating:</span>
                    <span className="ml-auto font-medium">
                      {driver.rating ? `${driver.rating.toFixed(1)} ⭐` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <strong>Vehicle Details:</strong> {driver.vehicle?.make} {driver.vehicle?.model} ({driver.vehicle?.year}) - 
                  {driver.vehicle?.maxSeats} seats, {driver.vehicle?.maxLuggage} luggage capacity
                </div>

                <div className="flex space-x-3">
                  <select
                    value={driver.status}
                    onChange={(e) => handleStatusUpdate(driver._id, e.target.value)}
                    className="input btn-sm"
                    disabled={updateStatusMutation.isLoading}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                  <button className="btn btn-outline btn-sm">
                    View Details
                  </button>
                  <button className="btn btn-outline btn-sm">
                    Edit Driver
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

export default AdminDrivers

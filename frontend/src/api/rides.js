import api from './axios'

// Rides API functions
export const ridesAPI = {
  // Create a new ride request
  createRide: async (rideData) => {
    const response = await api.post('/rides/request', rideData)
    return response.data
  },

  // Get price estimate without creating a ride
  getEstimate: async (estimateData) => {
    const response = await api.post('/rides/estimate', estimateData)
    return response.data
  },

  // Get ride history for current user
  getRideHistory: async (params = {}) => {
    const response = await api.get('/rides/history', { params })
    return response.data
  },

  // Get single ride by ID
  getRideById: async (rideId) => {
    const response = await api.get(`/rides/${rideId}`)
    return response.data
  },

  // Cancel a ride
  cancelRide: async (rideId, reason = '') => {
    const response = await api.delete(`/rides/${rideId}/cancel`, { data: { reason } })
    return response.data
  },

  // Update ride status (driver/system use)
  updateRideStatus: async (rideId, statusData) => {
    const response = await api.put(`/rides/${rideId}/status`, statusData)
    return response.data
  },

  // Get active rides for current user
  getActiveRides: async () => {
    const response = await api.get('/rides/active')
    return response.data
  },

  // Get nearby rides (for drivers)
  getNearbyRides: async (params) => {
    const response = await api.get('/rides/nearby', { params })
    return response.data
  },

  // Assign driver to ride
  assignDriver: async (rideId, driverId) => {
    const response = await api.put(`/rides/${rideId}/assign-driver`, { driverId })
    return response.data
  },

  // Admin functions
  admin: {
    // Get ride statistics
    getRideStats: async (params = {}) => {
      const response = await api.get('/rides/admin/stats', { params })
      return response.data
    },

    // Get rides by status
    getRidesByStatus: async (params = {}) => {
      const response = await api.get('/rides/admin/list', { params })
      return response.data
    },

    // Force cancel any ride
    forceCancelRide: async (rideId, data) => {
      const response = await api.delete(`/rides/admin/rides/${rideId}/cancel`, { data })
      return response.data
    },
  },
}

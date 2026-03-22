import api from './axios'

// Admin API functions
export const adminAPI = {
  // Pools
  pools: {
    // Get all active pools
    getActivePools: async (params = {}) => {
      const response = await api.get('/admin/pools', { params })
      return response.data
    },

    // Get pool details
    getPoolDetails: async (poolId) => {
      const response = await api.get(`/admin/pools/${poolId}`)
      return response.data
    },
  },

  // Rides
  rides: {
    // Get all rides with filters
    getAllRides: async (params = {}) => {
      const response = await api.get('/admin/rides', { params })
      return response.data
    },

    // Force cancel any ride
    forceCancelRide: async (rideId, data) => {
      const response = await api.delete(`/admin/rides/${rideId}/cancel`, { data })
      return response.data
    },
  },

  // Analytics
  analytics: {
    // Get KPIs and analytics
    getAnalytics: async (params = {}) => {
      const response = await api.get('/admin/analytics', { params })
      return response.data
    },

    // Get dashboard overview
    getDashboardOverview: async () => {
      const response = await api.get('/admin/dashboard')
      return response.data
    },
  },

  // Surge Configuration
  surge: {
    // Get surge config for all airports
    getSurgeConfigs: async () => {
      const response = await api.get('/admin/surge')
      return response.data
    },

    // Update surge multiplier
    updateSurgeConfig: async (airportCode, configData) => {
      const response = await api.put(`/admin/surge/${airportCode}`, configData)
      return response.data
    },
  },

  // Drivers
  drivers: {
    // Get all drivers
    getAllDrivers: async (params = {}) => {
      const response = await api.get('/admin/drivers', { params })
      return response.data
    },

    // Add new driver
    addDriver: async (driverData) => {
      const response = await api.post('/admin/drivers', driverData)
      return response.data
    },

    // Update driver status
    updateDriverStatus: async (driverId, statusData) => {
      const response = await api.put(`/admin/drivers/${driverId}/status`, statusData)
      return response.data
    },

    // Get driver statistics
    getDriverStats: async () => {
      const response = await api.get('/admin/drivers/stats')
      return response.data
    },
  },
}

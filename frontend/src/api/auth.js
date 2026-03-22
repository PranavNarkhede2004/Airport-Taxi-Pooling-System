import api from './axios'

// Auth API functions
export const authAPI = {
  // Register new user
  register: async (userData) => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },

  // Login user
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  // Get current user profile
  getProfile: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },

  // Update user profile
  updateProfile: async (userData) => {
    const response = await api.put('/auth/me', userData)
    return response.data
  },

  // Change password
  changePassword: async (passwordData) => {
    const response = await api.put('/auth/me/password', passwordData)
    return response.data
  },

  // Deactivate account
  deactivateAccount: async () => {
    const response = await api.delete('/auth/me/deactivate')
    return response.data
  },

  // Refresh token
  refreshToken: async (refreshToken) => {
    const response = await api.post('/auth/refresh', { refreshToken })
    return response.data
  },

  // Admin functions
  admin: {
    // Get all users
    getAllUsers: async (params = {}) => {
      const response = await api.get('/auth/admin/users', { params })
      return response.data
    },

    // Update user status
    updateUserStatus: async (userId, statusData) => {
      const response = await api.put(`/auth/admin/users/${userId}/status`, statusData)
      return response.data
    },

    // Reactivate user account
    reactivateAccount: async (userId) => {
      const response = await api.put(`/auth/admin/users/${userId}/reactivate`)
      return response.data
    },

    // Delete user
    deleteUser: async (userId) => {
      const response = await api.delete(`/auth/admin/users/${userId}`)
      return response.data
    },

    // Get user statistics
    getUserStats: async () => {
      const response = await api.get('/auth/admin/stats')
      return response.data
    },
  },
}

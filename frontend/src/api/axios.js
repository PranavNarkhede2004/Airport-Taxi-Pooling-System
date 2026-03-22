import axios from 'axios'

// Create axios instance with default configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('airport_pool_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      localStorage.removeItem('airport_pool_token')
      localStorage.removeItem('airport_pool_user')
      window.location.href = '/login'
    }
    
    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data)
    }
    
    // Handle 429 Rate Limit
    if (error.response?.status === 429) {
      console.warn('Rate limit exceeded:', error.response.data)
    }
    
    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response.data)
    }
    
    return Promise.reject(error)
  }
)

export default api

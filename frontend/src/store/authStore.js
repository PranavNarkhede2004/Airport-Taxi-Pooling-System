import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '../api/auth'
import toast from 'react-hot-toast'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      // Actions
      login: async (credentials) => {
        set({ isLoading: true })
        try {
          const response = await authAPI.login(credentials)
          const { user, token } = response.data

          // Store token and user
          localStorage.setItem('airport_pool_token', token)
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })

          toast.success('Login successful!')
          return response
        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Login failed'
          toast.error(message)
          throw error
        }
      },

      register: async (userData) => {
        set({ isLoading: true })
        try {
          const response = await authAPI.register(userData)
          const { user, token } = response.data

          // Store token and user
          localStorage.setItem('airport_pool_token', token)
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })

          toast.success('Registration successful!')
          return response
        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Registration failed'
          toast.error(message)
          throw error
        }
      },

      logout: () => {
        // Clear localStorage
        localStorage.removeItem('airport_pool_token')
        localStorage.removeItem('airport_pool_user')
        
        // Clear state
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        })

        toast.success('Logged out successfully')
      },

      updateProfile: async (userData) => {
        set({ isLoading: true })
        try {
          const response = await authAPI.updateProfile(userData)
          const { user } = response.data

          set({
            user,
            isLoading: false,
          })

          toast.success('Profile updated successfully!')
          return response
        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Profile update failed'
          toast.error(message)
          throw error
        }
      },

      changePassword: async (passwordData) => {
        set({ isLoading: true })
        try {
          await authAPI.changePassword(passwordData)
          set({ isLoading: false })
          toast.success('Password changed successfully!')
        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Password change failed'
          toast.error(message)
          throw error
        }
      },

      fetchProfile: async () => {
        try {
          const response = await authAPI.getProfile()
          const { user } = response.data
          set({ user })
          return response
        } catch (error) {
          // If token is invalid, logout
          if (error.response?.status === 401) {
            get().logout()
          }
          throw error
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem('airport_pool_token')
        if (!token) {
          return false
        }

        try {
          await get().fetchProfile()
          set({ isAuthenticated: true })
          return true
        } catch (error) {
          get().logout()
          return false
        }
      },

      // Admin actions
      adminLogout: () => {
        get().logout()
      },

      // Getters
      isAdmin: () => {
        const { user } = get()
        return user?.role === 'admin'
      },

      isDriver: () => {
        const { user } = get()
        return user?.role === 'driver'
      },

      isPassenger: () => {
        const { user } = get()
        return user?.role === 'passenger'
      },

      getUserInitials: () => {
        const { user } = get()
        if (!user?.name) return ''
        return user.name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      },

      getGreeting: () => {
        const { user } = get()
        if (!user?.name) return 'Welcome'
        
        const hour = new Date().getHours()
        let greeting = 'Good '
        
        if (hour < 12) greeting += 'morning'
        else if (hour < 18) greeting += 'afternoon'
        else greeting += 'evening'
        
        return `${greeting}, ${user.name.split(' ')[0]}!`
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export { useAuthStore }

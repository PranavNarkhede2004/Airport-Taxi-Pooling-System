import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export const useSocket = () => {
  const { token, user } = useAuthStore()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!token || !user) return

    // Initialize socket connection
    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    setSocket(newSocket)

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to server')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
    })

    newSocket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Ride events
    newSocket.on('ride:updated', (data) => {
      console.log('Ride updated:', data)
      // Handle ride status updates
      if (data.status === 'matched') {
        toast.success('🎉 Your ride has been matched!')
      } else if (data.status === 'assigned') {
        toast.success('🚗 Driver assigned to your ride!')
      } else if (data.status === 'in_progress') {
        toast.info('🚕 Your ride is in progress')
      } else if (data.status === 'completed') {
        toast.success('✅ Ride completed successfully!')
      }
    })

    newSocket.on('pool:matched', (data) => {
      console.log('Pool matched:', data)
      toast.success(`🎉 You've been matched with a pool! ${data.coPassengers?.length || 0} co-passengers`)
    })

    newSocket.on('ride:cancelled', (data) => {
      console.log('Ride cancelled:', data)
      toast.error(`❌ Ride cancelled: ${data.reason || 'No reason provided'}`)
    })

    newSocket.on('ride:new-request', (data) => {
      console.log('New ride request received from backend:', data)
      if (user.role === 'driver') {
        toast.success(`🔔 New ride request available at ${data.ride?.destination?.airportCode || 'Airport'}!`)
        // Dispatch custom event so Dashboard can refetch if needed
        window.dispatchEvent(new CustomEvent('ride:new-request-arrived', { detail: data }))
      }
    })

    newSocket.on('surge:updated', (data) => {
      console.log('Surge updated:', data)
      if (data.multiplier > 1.2) {
        toast.warning(`⚠️ Surge pricing active for ${data.airportCode}: ${data.multiplier}x`)
      }
    })

    newSocket.on('driver:assigned', (data) => {
      console.log('Driver assigned:', data)
      toast.success(`🚗 Driver ${data.driverInfo?.name || 'assigned'} to your ride!`)
    })

    newSocket.on('pool:updated', (data) => {
      console.log('Pool updated:', data)
      // Handle pool updates
    })

    // Admin events
    if (user.role === 'admin') {
      newSocket.on('job:failed', (data) => {
        console.error('Job failed:', data)
        toast.error(`⚠️ Job failed: ${data.jobName}`)
      })

      newSocket.on('pools:matched', (data) => {
        console.log('New pools matched:', data)
        toast.success(`🎉 ${data.createdPools} new pools created!`)
      })
    }

    // Cleanup on unmount
    return () => {
      newSocket.disconnect()
      setSocket(null)
    }
  }, [token, user])

  // Join ride room
  const joinRide = (rideId) => {
    if (socket) {
      socket.emit('join-ride', { rideId })
    }
  }

  // Leave ride room
  const leaveRide = (rideId) => {
    if (socket) {
      socket.emit('leave-ride', { rideId })
    }
  }

  // Join pool room
  const joinPool = (poolId) => {
    if (socket) {
      socket.emit('join-pool', { poolId })
    }
  }

  // Leave pool room
  const leavePool = (poolId) => {
    if (socket) {
      socket.emit('leave-pool', { poolId })
    }
  }

  // Share driver location (for drivers)
  const shareLocation = (location, rideId) => {
    if (socket && user?.role === 'driver') {
      socket.emit('driver-location', { location, rideId })
    }
  }

  // Ping server for connection health
  const ping = () => {
    if (socket) {
      socket.emit('ping')
    }
  }

  return {
    socket,
    isConnected: socket?.connected || false,
    joinRide,
    leaveRide,
    joinPool,
    leavePool,
    shareLocation,
    ping,
  }
}

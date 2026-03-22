import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ridesAPI } from '../../api/rides'
import { useAuthStore } from '../../store/authStore'
import { useSocket } from '../../hooks/useSocket'
import { Car, MapPin, Clock, Users, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const airports = [
  { code: 'BOM', name: 'Mumbai (BOM)' },
  { code: 'DEL', name: 'Delhi (DEL)' },
  { code: 'BLR', name: 'Bangalore (BLR)' },
  { code: 'HYD', name: 'Hyderabad (HYD)' },
  { code: 'MAA', name: 'Chennai (MAA)' },
]

const DriverDashboard = () => {
  const { getGreeting } = useAuthStore()
  const { socket } = useSocket()
  const [selectedAirport, setSelectedAirport] = useState('BOM')
  const [ignoredRides, setIgnoredRides] = useState([])

  const handleRejectRide = (rideId) => {
    setIgnoredRides(prev => [...prev, rideId])
  }

  const { data: nearbyRidesData, isLoading: isLoadingNearby, refetch } = useQuery({
    queryKey: ['nearby-rides', selectedAirport],
    queryFn: () => ridesAPI.getNearbyRides({ airportCode: selectedAirport }),
    refetchInterval: 30000,
  })

  // We reuse getActiveRides although it fetches User's rides. In a complete system, 
  // this would fetch Driver's active rides based on their Driver profile.
  const { data: activeRidesData } = useQuery({
    queryKey: ['active-rides', 'driver'],
    queryFn: ridesAPI.getActiveRides,
  })

  const nearbyRides = nearbyRidesData?.data?.rides || []
  const activeRides = activeRidesData?.data?.rides || []

  // Listen for real-time ride requests via the global window event dispatched by useSocket
  useEffect(() => {
    const handleNewRideRequest = (e) => {
      const data = e.detail
      // If the ride is at the currently selected airport, refresh the list immediately
      if (data.ride?.destination?.airportCode === selectedAirport) {
        refetch()
      }
    }

    window.addEventListener('ride:new-request-arrived', handleNewRideRequest)
    
    return () => {
      window.removeEventListener('ride:new-request-arrived', handleNewRideRequest)
    }
  }, [selectedAirport, refetch])

  const handleAcceptRide = async (rideId) => {
    // In a fully integrated system, the driver id would come from the auth profile.
    // Since Driver schema is separate, we're calling updateRideStatus just to show interaction.
    try {
      await ridesAPI.updateRideStatus(rideId, { 
        status: 'assigned',
        actualPickupTime: new Date().toISOString()
      })
      toast.success('Ride accepted successfully!')
      refetch()
    } catch (error) {
      toast.error('Failed to accept ride. Admin assignment might be required.')
    }
  }

  const handleCompleteRide = async (rideId) => {
    try {
      await ridesAPI.updateRideStatus(rideId, { 
        status: 'completed',
        actualDropoffTime: new Date().toISOString()
      })
      toast.success('Ride marked as completed!')
      refetch()
    } catch (error) {
      toast.error('Failed to complete ride')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              {getGreeting()}
            </h1>
            <p className="mt-2 text-gray-600">Driver Portal - Find nearby airport rides</p>
          </div>
        </div>

        {/* Active Rides */}
        {activeRides.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Active Rides</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeRides.map(ride => (
                <div key={ride._id} className="bg-white rounded-xl shadow-md border border-green-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 bg-green-50">
                    <div className="flex justify-between items-center mb-2">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                         {ride.status.replace('_', ' ').toUpperCase()}
                       </span>
                       <span className="text-sm font-semibold text-gray-700">₹{ride.pricing?.total}</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-start text-sm">
                      <MapPin className="w-5 h-5 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <p className="text-gray-500 text-xs">Pickup Airport</p>
                        <p className="font-medium text-gray-900">{ride.pickup.name}</p>
                      </div>
                    </div>
                    <div className="flex items-start text-sm">
                      <MapPin className="w-5 h-5 text-indigo-400 mr-2 mt-0.5" />
                      <div>
                        <p className="text-gray-500 text-xs">Dropoff</p>
                        <p className="font-medium text-gray-900">{ride.destination.address}</p>
                      </div>
                    </div>
                    
                    {ride.status === 'in_progress' ? (
                      <button 
                        onClick={() => handleCompleteRide(ride._id)}
                        className="w-full mt-4 btn btn-success"
                      >
                        Mark Completed
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleCompleteRide(ride._id)}
                        className="w-full mt-4 btn btn-primary"
                      >
                        Update Status
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nearby Rides */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">Available Requests</h2>
            <select
              value={selectedAirport}
              onChange={(e) => setSelectedAirport(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {airports.map(apt => (
                <option key={apt.code} value={apt.code}>{apt.name}</option>
              ))}
            </select>
          </div>

          {isLoadingNearby ? (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {[1,2,3].map(i => (
                 <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-48 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                 </div>
               ))}
             </div>
          ) : nearbyRides.filter(r => !ignoredRides.includes(r._id)).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {nearbyRides.filter(r => !ignoredRides.includes(r._id)).map(ride => (
                <div key={ride._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                  <div className="p-5 border-b border-gray-100 flex-1">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-lg font-bold text-gray-900">₹{ride.pricing?.total}</span>
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ride.isPool ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                         {ride.isPool ? 'Pool Request' : 'Private Ride'}
                       </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      {new Date(ride.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="p-5 space-y-3 bg-gray-50">
                    <div className="flex items-start text-sm">
                      <MapPin className="w-5 h-5 text-gray-400 mr-2 mt-0.5 min-w-[20px]" />
                      <p className="font-medium text-gray-700 line-clamp-2">Dropoff: {ride.destination.address}</p>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      {ride.passengers} Passengers • {ride.luggage} Luggage
                    </div>
                    
                    <div className="flex space-x-2 pt-2">
                      <button 
                        onClick={() => handleRejectRide(ride._id)}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleAcceptRide(ride._id)}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Car className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No rides available</h3>
              <p className="mt-2 text-gray-500">There are currently no ride requests for {selectedAirport}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DriverDashboard

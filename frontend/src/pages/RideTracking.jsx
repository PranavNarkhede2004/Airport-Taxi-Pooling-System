import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ridesAPI } from '../api/rides'
import { MapPin, Clock, Users, Car, Phone } from 'lucide-react'

const RideTracking = () => {
  const { id } = useParams()

  const { data: rideData, isLoading } = useQuery({
    queryKey: ['ride', id],
    queryFn: () => ridesAPI.getRideById(id),
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  const ride = rideData?.data?.ride

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!ride) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ride not found</h2>
          <p className="text-gray-600">The ride you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const getStatusColor = (status) => {
    const colors = {
      requested: 'text-blue-600',
      matched: 'text-purple-600',
      assigned: 'text-orange-600',
      in_progress: 'text-green-600',
      completed: 'text-gray-600',
      cancelled: 'text-red-600',
    }
    return colors[status] || 'text-gray-600'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ride Tracking</h1>
        <p className="mt-2 text-gray-600">Track your airport ride in real-time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Tracking Card */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Ride to {ride.destination.address}
                </h2>
                <span className={`text-sm font-medium ${getStatusColor(ride.status)}`}>
                  {ride.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Route */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <div>
                    <p className="font-medium">Pickup Airport</p>
                    <p className="text-sm text-gray-600">{ride.pickup.name}</p>
                  </div>
                </div>
                
                <div className="border-l-2 border-gray-300 ml-1.5 h-8"></div>
                
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                  <div>
                    <p className="font-medium">Destination</p>
                    <p className="text-sm text-gray-600">{ride.destination.address}</p>
                  </div>
                </div>
              </div>

              {/* Driver Info */}
              {ride.driverId && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Driver Details</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Driver Name</p>
                      <p className="text-sm text-gray-600">Vehicle: {ride.driverId.vehicle?.make} {ride.driverId.vehicle?.model}</p>
                      <p className="text-sm text-gray-600">Plate: {ride.driverId.vehicle?.plate}</p>
                    </div>
                    <button className="btn btn-outline">
                      <Phone className="w-4 h-4 mr-2" />
                      Call Driver
                    </button>
                  </div>
                </div>
              )}

              {/* Map Placeholder */}
              <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Live tracking map</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Ride Details */}
          <div className="card">
            <div className="card-body">
              <h3 className="font-medium text-gray-900 mb-4">Ride Details</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Clock className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Scheduled:</span>
                  <span className="ml-auto font-medium">
                    {new Date(ride.scheduledTime).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <Users className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Passengers:</span>
                  <span className="ml-auto font-medium">{ride.passengers}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Car className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-auto font-medium">
                    {ride.isPool ? 'Pool' : 'Solo'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="card">
            <div className="card-body">
              <h3 className="font-medium text-gray-900 mb-4">Pricing</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Fare:</span>
                  <span>₹{ride.pricing?.baseFare || 0}</span>
                </div>
                {ride.pricing?.surgeMultiplier > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Surge:</span>
                    <span>₹{ride.pricing?.surgeAmount || 0}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Luggage:</span>
                  <span>₹{ride.pricing?.luggageFee || 0}</span>
                </div>
                {ride.isPool && ride.pricing?.poolDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Pool Discount:</span>
                    <span>-₹{ride.pricing?.poolDiscount}</span>
                  </div>
                )}
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>₹{ride.pricing?.total || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {['requested', 'matched'].includes(ride.status) && (
              <button className="btn btn-danger w-full">
                Cancel Ride
              </button>
            )}
            <button className="btn btn-outline w-full">
              Get Help
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RideTracking

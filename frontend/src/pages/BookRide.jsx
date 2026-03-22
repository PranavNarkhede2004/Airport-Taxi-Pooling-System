import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ridesAPI } from '../api/rides'
import { MapPin, Calendar, Users, Luggage, Car, Clock } from 'lucide-react'
import MapPicker from '../components/MapPicker'
import toast from 'react-hot-toast'

const rideSchema = z.object({
  pickup: z.object({
    airportCode: z.enum(['BOM', 'DEL', 'BLR', 'HYD', 'MAA']),
    name: z.string().min(1, 'Pickup airport is required'),
    coordinates: z.array(z.number()).length(2),
  }),
  destination: z.object({
    address: z.string().min(1, 'Destination is required'),
    coordinates: z.array(z.number()).length(2),
  }),
  flightNumber: z.string().regex(/^[A-Z]{2}\d{3,4}$/, 'Invalid flight number format'),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  passengers: z.number().min(1).max(6),
  luggage: z.number().min(0).max(5),
  isPool: z.boolean(),
  detourTolerance: z.number().min(0).max(60),
})

const airports = [
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport, Mumbai' },
  { code: 'DEL', name: 'Indira Gandhi International Airport, Delhi' },
  { code: 'BLR', name: 'Kempegowda International Airport, Bangalore' },
  { code: 'HYD', name: 'Rajiv Gandhi International Airport, Hyderabad' },
  { code: 'MAA', name: 'Chennai International Airport, Chennai' },
]

const BookRide = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [estimate, setEstimate] = useState(null)
  const [isBooking, setIsBooking] = useState(false)

  const getInitialScheduledTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 30) // Default to 30 mins from now
    // Create local ISO string suitable for datetime-local input
    const tzOffset = now.getTimezoneOffset() * 60000
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16)
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      passengers: 1,
      luggage: 1,
      isPool: true,
      detourTolerance: 15,
      scheduledTime: getInitialScheduledTime(),
      pickup: { airportCode: 'BOM', name: airports[0].name, coordinates: [72.8679, 19.0896] },
      destination: { address: '', coordinates: [72.8777, 19.0760] }, // Default Mumbai coordinates
    },
  })

  const watchedValues = watch()

  const getEstimate = async (data) => {
    try {
      const response = await ridesAPI.getEstimate(data)
      setEstimate(response.data)
      setCurrentStep(2)
    } catch (error) {
      toast.error('Failed to get estimate')
    }
  }

  const bookRide = async (data) => {
    setIsBooking(true)
    try {
      const response = await ridesAPI.createRide(data)
      toast.success('Ride booked successfully!')
      navigate(`/rides/${response.data.ride._id}`)
    } catch (error) {
      toast.error('Failed to book ride')
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Book Your Airport Ride</h1>
        <p className="mt-2 text-gray-600">Share rides to airports and save money</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {step}
            </div>
            {step < 3 && (
              <div className={`w-16 h-1 mx-2 ${
                currentStep > step ? 'bg-primary-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          {currentStep === 1 && (
            <form onSubmit={handleSubmit(getEstimate)} className="space-y-6">
              {/* Pickup Airport */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Airport
                </label>
                <select
                  {...register('pickup.airportCode', {
                    onChange: (e) => {
                      const airport = airports.find(a => a.code === e.target.value)
                      setValue('pickup.name', airport.name)
                      setValue('pickup.coordinates', [72.8679, 19.0896]) // Default coordinates
                    }
                  })}
                  className="input"
                >
                  {airports.map((airport) => (
                    <option key={airport.code} value={airport.code}>
                      {airport.name}
                    </option>
                  ))}
                </select>
                {errors.pickup?.airportCode && (
                  <p className="mt-1 text-sm text-red-600">{errors.pickup.airportCode.message}</p>
                )}
              </div>

              {/* Destination & Map Location */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destination Location & Map
                </label>
                <MapPicker 
                  defaultPos={watchedValues.destination?.coordinates || [72.8777, 19.0760]}
                  initialAddress={watchedValues.destination?.address || ''}
                  onAddressSelect={(pos, addr) => {
                    setValue('destination.coordinates', pos, { shouldValidate: true })
                    setValue('destination.address', addr, { shouldValidate: true })
                  }}
                />
                {/* Hidden input to register with form */}
                <input type="hidden" {...register('destination.address')} />
                {errors.destination?.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.destination.address.message}</p>
                )}
              </div>

              {/* Flight Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Flight Number
                  </label>
                  <input
                    {...register('flightNumber')}
                    className="input"
                    placeholder="e.g., AI123"
                  />
                  {errors.flightNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.flightNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Time
                  </label>
                  <input
                    {...register('scheduledTime')}
                    type="datetime-local"
                    className="input"
                  />
                  {errors.scheduledTime && (
                    <p className="mt-1 text-sm text-red-600">{errors.scheduledTime.message}</p>
                  )}
                </div>
              </div>

              {/* Passengers and Luggage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passengers
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      {...register('passengers', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      max="6"
                      className="input pl-10"
                    />
                  </div>
                  {errors.passengers && (
                    <p className="mt-1 text-sm text-red-600">{errors.passengers.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Luggage Count
                  </label>
                  <div className="relative">
                    <Luggage className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      {...register('luggage', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      max="5"
                      className="input pl-10"
                    />
                  </div>
                  {errors.luggage && (
                    <p className="mt-1 text-sm text-red-600">{errors.luggage.message}</p>
                  )}
                </div>
              </div>

              {/* Pool Option */}
              <div className="flex items-center">
                <input
                  {...register('isPool')}
                  type="checkbox"
                  id="isPool"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isPool" className="ml-2 block text-sm text-gray-700">
                  Share this ride (Pool) - Save up to 30%
                </label>
              </div>

              <button type="submit" className="btn btn-primary w-full">
                Get Price Estimate
              </button>
            </form>
          )}

          {currentStep === 2 && estimate && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Price Estimate</h2>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Base Fare:</span>
                    <span>₹{estimate.estimate.baseFare}</span>
                  </div>
                  {estimate.estimate.surgeMultiplier > 1 && (
                    <div className="flex justify-between">
                      <span>Surge ({estimate.estimate.surgeMultiplier}x):</span>
                      <span>₹{Math.round(estimate.estimate.subtotal * (estimate.estimate.surgeMultiplier - 1))}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Luggage Fee:</span>
                    <span>₹{estimate.estimate.luggageFee}</span>
                  </div>
                  {watchedValues.isPool && (
                    <div className="flex justify-between text-green-600">
                      <span>Pool Discount:</span>
                      <span>-₹{estimate.estimate.poolDiscount}</span>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>₹{estimate.estimate.total}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                  <div>
                    <h3 className="font-medium text-blue-900">Estimated Time</h3>
                    <p className="text-blue-700 text-sm">~{estimate.estimate.estimatedMinutes} minutes</p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="btn btn-outline flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit(bookRide)}
                  disabled={isBooking}
                  className="btn btn-primary flex-1"
                >
                  {isBooking ? 'Booking...' : 'Book Ride'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookRide

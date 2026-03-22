import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '../../api/admin'
import { Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminSurge = () => {
  const queryClient = useQueryClient()
  const [selectedAirport, setSelectedAirport] = useState('')
  const [multiplier, setMultiplier] = useState(1.0)
  const [isManual, setIsManual] = useState(false)
  const [updateReason, setUpdateReason] = useState('')

  const { data: surgeConfigs, isLoading } = useQuery({
    queryKey: ['surge-configs'],
    queryFn: adminAPI.surge.getSurgeConfigs,
    refetchInterval: 30000,
  })

  const updateSurgeMutation = useMutation({
    mutationFn: ({ airportCode, data }) => adminAPI.surge.updateSurgeConfig(airportCode, data),
    onSuccess: () => {
      toast.success('Surge configuration updated successfully')
      queryClient.invalidateQueries(['surge-configs'])
      setSelectedAirport('')
      setMultiplier(1.0)
      setIsManual(false)
      setUpdateReason('')
    },
    onError: (error) => {
      toast.error('Failed to update surge configuration')
    },
  })

  const handleUpdateSurge = (airportCode) => {
    if (!multiplier || multiplier < 1.0 || multiplier > 5.0) {
      toast.error('Please enter a valid multiplier (1.0 - 5.0)')
      return
    }

    updateSurgeMutation.mutate({
      airportCode,
      data: {
        multiplier,
        isManualOverride: isManual,
        updateReason,
      },
    })
  }

  const getSurgeLevel = (multiplier) => {
    if (multiplier <= 1.2) return { level: 'Normal', color: 'text-green-600 bg-green-100' }
    if (multiplier <= 1.5) return { level: 'Moderate', color: 'text-yellow-600 bg-yellow-100' }
    if (multiplier <= 2.0) return { level: 'High', color: 'text-orange-600 bg-orange-100' }
    return { level: 'Extreme', color: 'text-red-600 bg-red-100' }
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
        <h1 className="text-3xl font-bold text-gray-900">Surge Pricing Control</h1>
        <p className="mt-2 text-gray-600">Manage dynamic surge pricing for different airports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Surge Status */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Current Surge Status</h2>
          {surgeConfigs?.data?.surgeConfigs?.map((config) => {
            const surgeLevel = getSurgeLevel(config.multiplier)
            return (
              <div key={config.airportCode} className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{config.airportCode}</h3>
                      <p className="text-sm text-gray-600">Current Multiplier</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {config.multiplier.toFixed(1)}x
                      </div>
                      <span className={`badge ${surgeLevel.color}`}>
                        {surgeLevel.level}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Auto Surge:</span>
                      <span className={config.autoSurgeEnabled ? 'text-green-600' : 'text-gray-500'}>
                        {config.autoSurgeEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Manual Override:</span>
                      <span className={config.isManualOverride ? 'text-orange-600' : 'text-gray-500'}>
                        {config.isManualOverride ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {config.lastCalculatedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Updated:</span>
                        <span>{new Date(config.lastCalculatedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <button
                      onClick={() => {
                        setSelectedAirport(config.airportCode)
                        setMultiplier(config.multiplier)
                        setIsManual(config.isManualOverride)
                      }}
                      className="btn btn-outline btn-sm w-full"
                    >
                      Update Surge
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Update Surge Form */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Update Surge Pricing</h2>
          {selectedAirport ? (
            <div className="card">
              <div className="card-body">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Airport
                  </label>
                  <input
                    type="text"
                    value={selectedAirport}
                    disabled
                    className="input bg-gray-50"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Surge Multiplier (1.0 - 5.0)
                  </label>
                  <input
                    type="number"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={multiplier}
                    onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                    className="input"
                  />
                  <div className="mt-2">
                    <span className={`badge ${getSurgeLevel(multiplier).color}`}>
                      {getSurgeLevel(multiplier).level}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isManual}
                      onChange={(e) => setIsManual(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Manual Override (disables auto-surge)
                    </span>
                  </label>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Update Reason (Optional)
                  </label>
                  <textarea
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    rows={3}
                    className="input"
                    placeholder="Reason for surge update..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleUpdateSurge(selectedAirport)}
                    disabled={updateSurgeMutation.isLoading}
                    className="btn btn-primary flex-1"
                  >
                    {updateSurgeMutation.isLoading ? 'Updating...' : 'Update Surge'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAirport('')
                      setMultiplier(1.0)
                      setIsManual(false)
                      setUpdateReason('')
                    }}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center py-12">
                <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Airport</h3>
                <p className="text-gray-600">Choose an airport from the list to update its surge pricing.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Surge Guidelines */}
      <div className="mt-8">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Surge Pricing Guidelines</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Surge Levels</h4>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm">Normal (1.0x - 1.2x)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-sm">Moderate (1.3x - 1.5x)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                    <span className="text-sm">High (1.6x - 2.0x)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span className="text-sm">Extreme (2.1x - 5.0x)</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Best Practices</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Use manual override for special events only</li>
                  <li>• Keep surge multiplier reasonable (max 3.0x normally)</li>
                  <li>• Monitor demand patterns before adjusting</li>
                  <li>• Document reasons for manual changes</li>
                  <li>• Re-enable auto-surge when conditions normalize</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminSurge

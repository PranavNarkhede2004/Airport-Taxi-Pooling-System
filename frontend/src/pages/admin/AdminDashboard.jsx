import { useQuery } from '@tanstack/react-query'
import { adminAPI } from '../../api/admin'
import { Car, Users, TrendingUp, DollarSign, Activity } from 'lucide-react'

const AdminDashboard = () => {
  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: adminAPI.analytics.getDashboardOverview,
    refetchInterval: 30000,
  })

  const overview = overviewData?.data?.overview

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const stats = [
    {
      name: 'Rides Today',
      value: overview?.ridesToday || 0,
      icon: Car,
      change: '+12%',
      changeType: 'positive'
    },
    {
      name: 'Active Pools',
      value: overview?.activePools || 0,
      icon: Users,
      change: '+5%',
      changeType: 'positive'
    },
    {
      name: 'Revenue Today',
      value: `₹${overview?.revenueToday || 0}`,
      icon: DollarSign,
      change: '+18%',
      changeType: 'positive'
    },
    {
      name: 'Available Drivers',
      value: overview?.availableDrivers || 0,
      icon: Activity,
      change: '-2%',
      changeType: 'negative'
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">Monitor and manage the airport pooling system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
                      <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                        stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="card-body space-y-4">
            <a href="/admin/pools" className="btn btn-outline w-full">
              View Active Pools
            </a>
            <a href="/admin/rides" className="btn btn-outline w-full">
              Manage All Rides
            </a>
            <a href="/admin/surge" className="btn btn-outline w-full">
              Adjust Surge Pricing
            </a>
            <a href="/admin/drivers" className="btn btn-outline w-full">
              Manage Drivers
            </a>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">System Status</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">API Server</span>
                <span className="badge badge-success">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Database</span>
                <span className="badge badge-success">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Redis Cache</span>
                <span className="badge badge-warning">Disabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Queue System</span>
                <span className="badge badge-warning">Disabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard

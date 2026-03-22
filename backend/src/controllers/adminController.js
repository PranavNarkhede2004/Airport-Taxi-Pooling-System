const Pool = require('../models/Pool');
const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const SurgeConfig = require('../models/SurgeConfig');
const User = require('../models/User');
const { asyncHandler, AppError, NotFoundError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Get all active pools
 */
const getActivePools = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, airportCode, status } = req.query;
  const skip = (page - 1) * limit;

  // Build query
  const query = { status: { $in: ['forming', 'locked', 'assigned'] } };
  if (airportCode) query.airportCode = airportCode;
  if (status) query.status = status;

  const pools = await Pool.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('rides', 'userId pickup destination scheduledTime status pricing passengers luggage')
    .populate('driverId', 'name phone vehicle rating')
    .populate({
      path: 'rides',
      populate: {
        path: 'userId',
        select: 'name email phone'
      }
    });

  const total = await Pool.countDocuments(query);

  res.json({
    success: true,
    data: {
      pools,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * Get pool details with all passenger information
 */
const getPoolDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pool = await Pool.findById(id)
    .populate({
      path: 'rides',
      populate: [
        {
          path: 'userId',
          select: 'name email phone'
        },
        {
          path: 'driverId',
          select: 'name phone vehicle rating'
        }
      ]
    })
    .populate('driverId', 'name phone vehicle rating');

  if (!pool) {
    throw new NotFoundError('Pool');
  }

  // Calculate additional pool metrics
  const poolWithMetrics = {
    ...pool.toObject(),
    metrics: {
      totalRevenue: pool.rides.reduce((sum, ride) => sum + (ride.pricing?.total || 0), 0),
      avgDeviationPerRide: pool.rides.length > 0 ? pool.totalDeviation / pool.rides.length : 0,
      efficiency: pool.efficiency,
      totalPassengers: pool.totalPassengers
    }
  };

  res.json({
    success: true,
    data: { pool: poolWithMetrics }
  });
});

/**
 * Get all rides with filters
 */
const getAllRides = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    airportCode, 
    startDate, 
    endDate,
    userId,
    isPool 
  } = req.query;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};
  if (status) query.status = status;
  if (airportCode) query['pickup.airportCode'] = airportCode;
  if (userId) query.userId = userId;
  if (isPool !== undefined) query.isPool = isPool === 'true';
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const rides = await Ride.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'name email phone')
    .populate('poolId', 'status totalSeats totalLuggage')
    .populate('driverId', 'name phone vehicle rating');

  const total = await Ride.countDocuments(query);

  res.json({
    success: true,
    data: {
      rides,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * Force cancel any ride
 */
const forceCancelRide = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, adminNote } = req.body;

  const ride = await Ride.findById(id);
  if (!ride) {
    throw new NotFoundError('Ride');
  }

  // Update ride status
  await ride.updateStatus('cancelled', { 
    cancellationReason: reason || 'Cancelled by admin',
    adminNote 
  });

  // Handle pool logic if ride is in a pool
  if (ride.poolId) {
    const pool = await Pool.findById(ride.poolId);
    if (pool && pool.status === 'forming') {
      await pool.removeRide(ride._id);
      
      if (pool.rides.length < 2) {
        await Pool.findByIdAndDelete(pool._id);
        logger.info(`Pool ${pool._id} cancelled due to admin force cancellation`);
      }
    }
  }

  logger.info(`Ride ${id} force cancelled by admin ${req.userId}. Reason: ${reason}`);

  res.json({
    success: true,
    message: 'Ride force cancelled successfully',
    data: { ride }
  });
});

/**
 * Get analytics KPIs
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const { period = '24h' } = req.query;
  
  // Calculate date range based on period
  let startDate;
  const endDate = new Date();
  
  switch (period) {
    case '1h':
      startDate = new Date(Date.now() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  // Get basic metrics
  const [
    totalRides,
    completedRides,
    cancelledRides,
    activePools,
    totalRevenue,
    avgPoolSize
  ] = await Promise.all([
    Ride.countDocuments({ createdAt: { $gte: startDate } }),
    Ride.countDocuments({ 
      status: 'completed', 
      createdAt: { $gte: startDate } 
    }),
    Ride.countDocuments({ 
      status: 'cancelled', 
      createdAt: { $gte: startDate } 
    }),
    Pool.countDocuments({ 
      status: { $in: ['forming', 'locked', 'assigned'] },
      createdAt: { $gte: startDate }
    }),
    Ride.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]),
    Pool.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: null, avgSize: { $avg: { $size: '$rides' } } } }
    ])
  ]);

  // Get current surge information
  const surgeConfigs = await SurgeConfig.getAllConfigs();
  const highestSurge = surgeConfigs.reduce((max, config) => 
    config.multiplier > max.multiplier ? config : max, 
    { multiplier: 1.0, airportCode: 'N/A' }
  );

  // Get rides per hour (last 24 hours)
  const ridesPerHour = await Ride.aggregate([
    {
      $match: {
        createdAt: { 
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
        }
      }
    },
    {
      $group: {
        _id: {
          hour: { $hour: '$createdAt' },
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1, '_id.hour': 1 } }
  ]);

  // Get pool vs solo split
  const poolVsSolo = await Ride.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$isPool',
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.total' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      kpis: {
        totalRides,
        completedRides,
        cancelledRides,
        activePools,
        revenue: totalRevenue[0]?.total || 0,
        avgPoolSize: avgPoolSize[0]?.avgSize || 0,
        highestSurge: {
          multiplier: highestSurge.multiplier,
          airportCode: highestSurge.airportCode
        }
      },
      charts: {
        ridesPerHour,
        poolVsSolo
      }
    }
  });
});

/**
 * Get surge configuration for all airports
 */
const getSurgeConfigs = asyncHandler(async (req, res) => {
  const configs = await SurgeConfig.getAllConfigs();

  res.json({
    success: true,
    data: { surgeConfigs: configs }
  });
});

/**
 * Update surge multiplier for airport
 */
const updateSurgeConfig = asyncHandler(async (req, res) => {
  const { airportCode } = req.params;
  const { multiplier, isManualOverride, autoSurgeEnabled, updateReason } = req.body;

  const config = await SurgeConfig.getByAirport(airportCode);
  if (!config) {
    throw new NotFoundError('Surge configuration');
  }

  await config.updateMultiplier(
    multiplier, 
    isManualOverride, 
    req.userId, 
    updateReason
  );

  if (autoSurgeEnabled !== undefined) {
    config.autoSurgeEnabled = autoSurgeEnabled;
    await config.save();
  }

  logger.info(`Surge config updated for ${airportCode} by admin ${req.userId}: multiplier=${multiplier}, manual=${isManualOverride}`);

  res.json({
    success: true,
    message: 'Surge configuration updated successfully',
    data: { config }
  });
});

/**
 * Get all drivers
 */
const getAllDrivers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { 'vehicle.plate': { $regex: search, $options: 'i' } }
    ];
  }

  const drivers = await Driver.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Driver.countDocuments(query);

  res.json({
    success: true,
    data: {
      drivers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * Add new driver
 */
const addDriver = asyncHandler(async (req, res) => {
  const driverData = req.body;

  // Check if phone already exists
  const existingPhone = await Driver.findOne({ phone: driverData.phone });
  if (existingPhone) {
    throw new AppError('Phone number already registered', 400, 'PHONE_EXISTS');
  }

  const driver = new Driver(driverData);
  await driver.save();

  logger.info(`New driver added: ${driver.name} (${driver.phone}) by admin ${req.userId}`);

  res.status(201).json({
    success: true,
    message: 'Driver added successfully',
    data: { driver }
  });
});

/**
 * Update driver status
 */
const updateDriverStatus = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { status } = req.body;

  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new NotFoundError('Driver');
  }

  await driver.updateStatus(status);

  logger.info(`Driver ${driverId} status updated to ${status} by admin ${req.userId}`);

  res.json({
    success: true,
    message: 'Driver status updated successfully',
    data: { driver }
  });
});

/**
 * Get driver statistics
 */
const getDriverStats = asyncHandler(async (req, res) => {
  const stats = await Driver.getStatistics();

  const totalDrivers = await Driver.countDocuments();
  const availableDrivers = await Driver.countDocuments({ status: 'available' });
  const busyDrivers = await Driver.countDocuments({ status: 'busy' });
  const offlineDrivers = await Driver.countDocuments({ status: 'offline' });

  res.json({
    success: true,
    data: {
      totalDrivers,
      availableDrivers,
      busyDrivers,
      offlineDrivers,
      byStatus: stats
    }
  });
});

/**
 * Get dashboard overview
 */
const getDashboardOverview = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    todayRides,
    weekRides,
    activePools,
    totalRevenue,
    avgPoolSize,
    totalDrivers,
    availableDrivers
  ] = await Promise.all([
    Ride.countDocuments({ createdAt: { $gte: todayStart } }),
    Ride.countDocuments({ createdAt: { $gte: weekStart } }),
    Pool.countDocuments({ status: { $in: ['forming', 'locked', 'assigned'] } }),
    Ride.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]),
    Pool.aggregate([
      { $match: { status: { $in: ['forming', 'locked', 'assigned'] } } },
      { $group: { _id: null, avgSize: { $avg: { $size: '$rides' } } } }
    ]),
    Driver.countDocuments(),
    Driver.countDocuments({ status: 'available' })
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        ridesToday: todayRides,
        ridesThisWeek: weekRides,
        activePools,
        revenueToday: totalRevenue[0]?.total || 0,
        avgPoolSize: avgPoolSize[0]?.avgSize || 0,
        totalDrivers,
        availableDrivers
      }
    }
  });
});

module.exports = {
  getActivePools,
  getPoolDetails,
  getAllRides,
  forceCancelRide,
  getAnalytics,
  getSurgeConfigs,
  updateSurgeConfig,
  getAllDrivers,
  addDriver,
  updateDriverStatus,
  getDriverStats,
  getDashboardOverview
};

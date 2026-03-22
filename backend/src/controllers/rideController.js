const Ride = require('../models/Ride');
const Pool = require('../models/Pool');
const Driver = require('../models/Driver');
const SurgeConfig = require('../models/SurgeConfig');
const { getPricingEstimate } = require('../utils/pricing');
const { asyncHandler, AppError, ValidationError, NotFoundError } = require('../middlewares/errorHandler');
const distributedLock = require('../utils/distributedLock');
const logger = require('../utils/logger');

/**
 * Create a new ride request
 */
const createRide = asyncHandler(async (req, res) => {
  const rideData = req.body;
  
  // Get surge configuration for the airport
  const surgeConfig = await SurgeConfig.getByAirport(rideData.pickup.airportCode);
  
  // Calculate pricing
  const pricing = await getPricingEstimate(rideData, surgeConfig);
  
  // Create ride with calculated pricing
  const ride = new Ride({
    ...rideData,
    userId: req.userId,
    pricing: {
      baseFare: pricing.baseFare,
      surgeMultiplier: pricing.surgeMultiplier,
      luggageFee: pricing.luggageFee,
      poolDiscount: pricing.poolDiscount,
      total: pricing.total
    }
  });

  await ride.save();

  logger.info(`New ride request created: ${ride._id} by user ${req.userId}`);

  // Broadcast to drivers in real-time
  if (global.socketHandler) {
    global.socketHandler.emitNewRideRequest(ride);
  }

  res.status(201).json({
    success: true,
    message: 'Ride request created successfully',
    data: {
      ride,
      pricing
    }
  });
});

/**
 * Get price estimate without creating a ride
 */
const getEstimate = asyncHandler(async (req, res) => {
  const estimateData = req.body;
  
  // Get surge configuration for the airport
  const surgeConfig = await SurgeConfig.getByAirport(estimateData.pickup.airportCode);
  
  // Calculate pricing estimate
  const pricing = await getPricingEstimate(estimateData, surgeConfig);
  
  res.json({
    success: true,
    data: {
      estimate: pricing,
      surge: surgeConfig ? {
        multiplier: surgeConfig.multiplier,
        level: surgeConfig.surgeLevel,
        isManual: surgeConfig.isManualOverride
      } : null
    }
  });
});

/**
 * Get ride history for current user
 */
const getRideHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, airportCode } = req.query;
  const skip = (page - 1) * limit;

  // Build query
  const query = { userId: req.userId };
  if (status) query.status = status;
  if (airportCode) query['pickup.airportCode'] = airportCode;

  const rides = await Ride.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('poolId', 'status totalSeats totalLuggage routeOrder')
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
 * Get single ride by ID
 */
const getRideById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ride = await Ride.findOne({ _id: id, userId: req.userId })
    .populate('poolId', 'status totalSeats totalLuggage routeOrder rides')
    .populate('driverId', 'name phone vehicle rating')
    .populate('userId', 'name email phone');

  if (!ride) {
    throw new NotFoundError('Ride');
  }

  res.json({
    success: true,
    data: { ride }
  });
});

/**
 * Cancel a ride
 */
const cancelRide = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // Use distributed lock to prevent concurrent cancellations
  const result = await distributedLock.withRideStatusLock(id, async () => {
    const ride = await Ride.findOne({ _id: id, userId: req.userId });
    
    if (!ride) {
      throw new NotFoundError('Ride');
    }

    // Check if ride can be cancelled
    if (!ride.canCancel) {
      throw new AppError('Ride cannot be cancelled at this stage', 400, 'CANCELLATION_NOT_ALLOWED');
    }

    // Update ride status
    await ride.updateStatus('cancelled', { cancellationReason: reason });

    // If ride is part of a pool, handle pool logic
    if (ride.poolId) {
      const pool = await Pool.findById(ride.poolId);
      if (pool && pool.status === 'forming') {
        // Remove ride from forming pool
        await pool.removeRide(ride._id);
        
        // If pool has less than 2 rides, cancel the pool
        if (pool.rides.length < 2) {
          await Pool.findByIdAndDelete(pool._id);
          logger.info(`Pool ${pool._id} cancelled due to insufficient rides`);
        }
      }
    }

    logger.info(`Ride ${id} cancelled by user ${req.userId}. Reason: ${reason || 'Not provided'}`);
    
    return ride;
  });

  res.json({
    success: true,
    message: 'Ride cancelled successfully',
    data: { ride: result }
  });
});

/**
 * Update ride status (driver/system use)
 */
const updateRideStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, driverId, actualPickupTime, actualDropoffTime } = req.body;

  // Use distributed lock to prevent concurrent status updates
  const result = await distributedLock.withRideStatusLock(id, async () => {
    const ride = await Ride.findById(id);
    
    if (!ride) {
      throw new NotFoundError('Ride');
    }

    // Validate status transition
    const validTransitions = {
      'requested': ['matched', 'assigned', 'cancelled'],
      'matched': ['assigned', 'cancelled'],
      'assigned': ['in_progress', 'cancelled'],
      'in_progress': ['completed'],
      'cancelled': [],
      'completed': []
    };

    if (!validTransitions[ride.status].includes(status)) {
      throw new AppError(`Invalid status transition from ${ride.status} to ${status}`, 400, 'INVALID_TRANSITION');
    }

    // Update status with additional data
    const updateData = { status };
    if (driverId) {
      updateData.driverId = driverId;
    } else if (req.userRole === 'driver' && status === 'assigned') {
      // If a driver accepts a ride but didn't provide their explicit Driver profile ID, look it up
      const driver = await Driver.findOne({ userId: req.userId });
      if (driver) {
        updateData.driverId = driver._id;
        // Optionally update driver status
        await driver.updateStatus('busy', ride.poolId || ride._id);
      }
    }
    
    if (actualPickupTime) updateData.actualPickupTime = new Date(actualPickupTime);
    if (actualDropoffTime) updateData.actualDropoffTime = new Date(actualDropoffTime);

    await ride.updateStatus(status, updateData);

    logger.info(`Ride ${id} status updated to ${status}`);

    return ride;
  });

  res.json({
    success: true,
    message: 'Ride status updated successfully',
    data: { ride: result }
  });
});

/**
 * Get active rides for current user (or driver)
 */
const getActiveRides = asyncHandler(async (req, res) => {
  let query = {
    userId: req.userId,
    status: { $in: ['requested', 'matched', 'assigned', 'in_progress'] }
  };

  if (req.userRole === 'driver') {
    const driver = await Driver.findOne({ userId: req.userId });
    if (driver) {
      query = {
        $or: [
          { userId: req.userId },
          { driverId: driver._id }
        ],
        status: { $in: ['requested', 'matched', 'assigned', 'in_progress'] }
      };
    }
  }

  const rides = await Ride.find(query)
    .sort({ scheduledTime: 1 })
    .populate('poolId', 'status totalSeats totalLuggage routeOrder')
    .populate('driverId', 'name phone vehicle rating');

  res.json({
    success: true,
    data: { rides }
  });
});

/**
 * Get nearby rides (for drivers)
 */
const getNearbyRides = asyncHandler(async (req, res) => {
  const { airportCode, maxDistance = 50 } = req.query;
  
  // Get rides that need drivers
  const rides = await Ride.find({
    status: { $in: ['requested', 'matched', 'assigned'] },
    'pickup.airportCode': airportCode,
    scheduledTime: {
      // Show rides that are slightly in the past (e.g. up to 15 mins late) up to 2 hours ahead
      $gte: new Date(Date.now() - 15 * 60 * 1000),
      $lte: new Date(Date.now() + 2 * 60 * 60 * 1000) // Within next 2 hours
    },
    driverId: null
  })
    .populate('userId', 'name phone')
    .populate('poolId', 'totalSeats totalLuggage')
    .sort({ scheduledTime: 1 });

  res.json({
    success: true,
    data: { rides }
  });
});

/**
 * Assign driver to ride
 */
const assignDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body;

  // Use distributed lock to prevent concurrent assignments
  const result = await distributedLock.withRideStatusLock(id, async () => {
    const ride = await Ride.findById(id);
    
    if (!ride) {
      throw new NotFoundError('Ride');
    }

    if (ride.driverId) {
      throw new AppError('Ride already has a driver assigned', 400, 'DRIVER_ALREADY_ASSIGNED');
    }

    // Check driver availability
    const driver = await Driver.findById(driverId);
    if (!driver || driver.status !== 'available') {
      throw new AppError('Driver not available', 400, 'DRIVER_UNAVAILABLE');
    }

    // Update ride
    await ride.updateStatus('assigned', { driverId });

    // Update driver status
    await driver.updateStatus('busy', ride.poolId);

    logger.info(`Driver ${driverId} assigned to ride ${id}`);

    return { ride, driver };
  });

  res.json({
    success: true,
    message: 'Driver assigned successfully',
    data: result
  });
});

/**
 * Get ride statistics (admin only)
 */
const getRideStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, airportCode } = req.query;
  
  // Build date filter
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  // Build airport filter
  const airportFilter = airportCode ? { 'pickup.airportCode': airportCode } : {};

  const stats = await Ride.aggregate([
    { $match: { ...dateFilter, ...airportFilter } },
    {
      $group: {
        _id: null,
        totalRides: { $sum: 1 },
        completedRides: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelledRides: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        pooledRides: {
          $sum: { $cond: [{ $eq: ['$isPool', true] }, 1, 0] }
        },
        totalRevenue: { $sum: '$pricing.total' },
        avgFare: { $avg: '$pricing.total' },
        totalPassengers: { $sum: '$passengers' },
        totalLuggage: { $sum: '$luggage' }
      }
    }
  ]);

  const statusBreakdown = await Ride.aggregate([
    { $match: { ...dateFilter, ...airportFilter } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.total' }
      }
    }
  ]);

  const airportBreakdown = await Ride.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$pickup.airportCode',
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.total' },
        pooled: {
          $sum: { $cond: [{ $eq: ['$isPool', true] }, 1, 0] }
        }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      summary: stats[0] || {
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        pooledRides: 0,
        totalRevenue: 0,
        avgFare: 0,
        totalPassengers: 0,
        totalLuggage: 0
      },
      statusBreakdown,
      airportBreakdown
    }
  });
});

/**
 * Get rides by status (admin only)
 */
const getRidesByStatus = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, airportCode, startDate, endDate } = req.query;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};
  if (status) query.status = status;
  if (airportCode) query['pickup.airportCode'] = airportCode;
  
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

module.exports = {
  createRide,
  getEstimate,
  getRideHistory,
  getRideById,
  cancelRide,
  updateRideStatus,
  getActiveRides,
  getNearbyRides,
  assignDriver,
  getRideStats,
  getRidesByStatus
};

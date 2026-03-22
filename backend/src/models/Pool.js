const mongoose = require('mongoose');

const poolSchema = new mongoose.Schema({
  airportCode: {
    type: String,
    required: [true, 'Airport code is required'],
    uppercase: true,
    enum: ['BOM', 'DEL', 'BLR', 'HYD', 'MAA'],
    index: true
  },
  rides: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  }],
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  status: {
    type: String,
    enum: ['forming', 'locked', 'assigned', 'completed'],
    default: 'forming',
    index: true
  },
  totalSeats: {
    type: Number,
    required: true,
    min: [1, 'Pool must have at least 1 seat'],
    max: [6, 'Pool cannot exceed 6 seats']
  },
  totalLuggage: {
    type: Number,
    required: true,
    min: [0, 'Luggage cannot be negative'],
    max: [5, 'Pool cannot exceed 5 luggage pieces']
  },
  routeOrder: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride'
  }],
  totalDeviation: {
    type: Number,
    required: true,
    min: [0, 'Total deviation cannot be negative'],
    default: 0
  },
  estimatedDuration: {
    type: Number,
    min: 0
  },
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date
  },
  completionNotes: {
    type: String,
    maxlength: [1000, 'Completion notes cannot exceed 1000 characters'],
    trim: true
  }
}, {
  timestamps: true,
  versionKey: '__v' // Enable version key for optimistic concurrency
});

// Indexes
poolSchema.index({ airportCode: 1, status: 1 });
poolSchema.index({ status: 1, createdAt: -1 });
poolSchema.index({ createdAt: -1 });
poolSchema.index({ driverId: 1 });

// Virtual for checking if pool can accept more rides
poolSchema.virtual('canAcceptMoreRides').get(function() {
  return this.status === 'forming' && this.rides.length < 6;
});

// Virtual for pool efficiency
poolSchema.virtual('efficiency').get(function() {
  if (this.rides.length <= 1) return 0;
  return ((this.rides.length - 1) / this.rides.length) * 100; // Percentage of rides saved
});

// Virtual for total passengers
poolSchema.virtual('totalPassengers').get(function() {
  return this.rides.length; // Each ride represents at least 1 passenger
});

// Instance method to add ride to pool
poolSchema.methods.addRide = function(rideId) {
  if (this.status !== 'forming') {
    throw new Error('Cannot add ride to pool that is not in forming status');
  }
  
  if (this.rides.length >= 6) {
    throw new Error('Pool cannot exceed 6 rides');
  }
  
  this.rides.push(rideId);
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Instance method to remove ride from pool
poolSchema.methods.removeRide = function(rideId) {
  this.rides = this.rides.filter(ride => !ride.equals(rideId));
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Instance method to lock pool
poolSchema.methods.lockPool = function() {
  if (this.status !== 'forming') {
    throw new Error('Only forming pools can be locked');
  }
  
  this.status = 'locked';
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Instance method to assign driver
poolSchema.methods.assignDriver = function(driverId) {
  if (this.status !== 'locked') {
    throw new Error('Driver can only be assigned to locked pools');
  }
  
  this.driverId = driverId;
  this.status = 'assigned';
  this.actualStartTime = new Date();
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Instance method to complete pool
poolSchema.methods.completePool = function(notes = '') {
  if (!['assigned'].includes(this.status)) {
    throw new Error('Only assigned pools can be completed');
  }
  
  this.status = 'completed';
  this.actualEndTime = new Date();
  if (notes) this.completionNotes = notes;
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Static method to find active pools
poolSchema.statics.findActivePools = function() {
  return this.find({
    status: { $in: ['forming', 'locked', 'assigned'] }
  }).populate('rides', 'userId pickup destination scheduledTime status')
    .populate('driverId', 'name phone vehicle rating')
    .sort({ createdAt: -1 });
};

// Static method to find pools by airport
poolSchema.statics.findByAirport = function(airportCode, status = null) {
  const query = { airportCode };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('rides', 'userId pickup destination scheduledTime status pricing')
    .populate('driverId', 'name phone vehicle rating')
    .sort({ createdAt: -1 });
};

// Static method to get pool statistics
poolSchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgRides: { $avg: { $size: '$rides' } },
        avgDeviation: { $avg: '$totalDeviation' }
      }
    }
  ]);
};

module.exports = mongoose.model('Pool', poolSchema);

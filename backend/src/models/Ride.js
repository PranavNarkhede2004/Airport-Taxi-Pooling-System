const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  pickup: {
    airportCode: {
      type: String,
      required: [true, 'Airport code is required'],
      uppercase: true,
      enum: ['BOM', 'DEL', 'BLR', 'HYD', 'MAA'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Airport name is required'],
      trim: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Pickup coordinates are required'],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && 
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Invalid coordinates format. Expected [longitude, latitude]'
      }
    }
  },
  destination: {
    address: {
      type: String,
      required: [true, 'Destination address is required'],
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Destination coordinates are required'],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && 
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Invalid coordinates format. Expected [longitude, latitude]'
      }
    }
  },
  flightNumber: {
    type: String,
    required: [true, 'Flight number is required'],
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{2}\d{3,4}$/, 'Invalid flight number format (e.g., AI123)']
  },
  scheduledTime: {
    type: Date,
    required: [true, 'Scheduled pickup time is required'],
    index: true,
    validate: {
      validator: function(time) {
        return time > new Date();
      },
      message: 'Scheduled time must be in the future'
    }
  },
  passengers: {
    type: Number,
    required: [true, 'Number of passengers is required'],
    min: [1, 'At least 1 passenger is required'],
    max: [6, 'Maximum 6 passengers allowed']
  },
  luggage: {
    type: Number,
    required: [true, 'Number of luggage pieces is required'],
    min: [0, 'Luggage cannot be negative'],
    max: [5, 'Maximum 5 luggage pieces allowed']
  },
  status: {
    type: String,
    enum: ['requested', 'matched', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'requested',
    index: true
  },
  poolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pool',
    default: null,
    index: true
  },
  detourTolerance: {
    type: Number,
    default: 15,
    min: [0, 'Detour tolerance cannot be negative'],
    max: [60, 'Detour tolerance cannot exceed 60 minutes']
  },
  pricing: {
    baseFare: {
      type: Number,
      required: true,
      min: 0
    },
    surgeMultiplier: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    luggageFee: {
      type: Number,
      required: true,
      min: 0
    },
    poolDiscount: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  isPool: {
    type: Boolean,
    default: true,
    index: true
  },
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters'],
    trim: true
  },
  actualPickupTime: {
    type: Date
  },
  actualDropoffTime: {
    type: Date
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    trim: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  }
}, {
  timestamps: true,
  versionKey: '__v' // Enable version key for optimistic concurrency
});

// Indexes
rideSchema.index({ userId: 1, status: 1 });
rideSchema.index({ userId: 1, createdAt: -1 });
rideSchema.index({ status: 1, scheduledTime: 1 });
rideSchema.index({ 'pickup.airportCode': 1, status: 1 });
rideSchema.index({ poolId: 1 });
rideSchema.index({ isPool: 1, status: 1, scheduledTime: 1 });

// Virtual for calculating total duration
rideSchema.virtual('duration').get(function() {
  if (this.actualPickupTime && this.actualDropoffTime) {
    return Math.round((this.actualDropoffTime - this.actualPickupTime) / 60000); // minutes
  }
  return null;
});

// Virtual for checking if ride can be cancelled
rideSchema.virtual('canCancel').get(function() {
  return ['requested', 'matched'].includes(this.status);
});

// Instance method to update status
rideSchema.methods.updateStatus = function(newStatus, additionalData = {}) {
  this.status = newStatus;
  this.__v += 1; // Increment version for optimistic concurrency
  
  if (additionalData.driverId) this.driverId = additionalData.driverId;
  if (additionalData.actualPickupTime) this.actualPickupTime = additionalData.actualPickupTime;
  if (additionalData.actualDropoffTime) this.actualDropoffTime = additionalData.actualDropoffTime;
  if (additionalData.cancellationReason) this.cancellationReason = additionalData.cancellationReason;
  
  return this.save();
};

// Static method to find rides available for pooling
rideSchema.statics.findPoolableRides = function(airportCode) {
  return this.find({
    status: 'requested',
    isPool: true,
    'pickup.airportCode': airportCode,
    scheduledTime: {
      $gte: new Date(),
      $lte: new Date(Date.now() + 2 * 60 * 60 * 1000) // Within next 2 hours
    }
  }).populate('userId', 'name phone email').sort({ scheduledTime: 1 });
};

// Static method to get user ride history
rideSchema.statics.getUserHistory = function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('poolId', 'status totalSeats totalLuggage')
    .populate('driverId', 'name phone vehicle');
};

module.exports = mongoose.model('Ride', rideSchema);

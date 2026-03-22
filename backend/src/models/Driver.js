const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },
  vehicle: {
    type: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: ['sedan', 'suv', 'hatchback', 'luxury'],
      trim: true
    },
    plate: {
      type: String,
      required: [true, 'Vehicle plate number is required'],
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/, 'Invalid plate number format (e.g., MH12AB1234)']
    },
    maxSeats: {
      type: Number,
      required: [true, 'Maximum seats is required'],
      min: [1, 'Vehicle must have at least 1 seat'],
      max: [6, 'Vehicle cannot exceed 6 seats']
    },
    maxLuggage: {
      type: Number,
      required: [true, 'Maximum luggage capacity is required'],
      min: [0, 'Luggage capacity cannot be negative'],
      max: [5, 'Vehicle cannot exceed 5 luggage pieces']
    },
    make: {
      type: String,
      required: [true, 'Vehicle make is required'],
      trim: true,
      maxlength: [30, 'Make cannot exceed 30 characters']
    },
    model: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true,
      maxlength: [30, 'Model cannot exceed 30 characters']
    },
    color: {
      type: String,
      required: [true, 'Vehicle color is required'],
      trim: true,
      maxlength: [20, 'Color cannot exceed 20 characters']
    },
    year: {
      type: Number,
      required: [true, 'Vehicle year is required'],
      min: [2000, 'Vehicle year must be 2000 or newer'],
      max: [new Date().getFullYear() + 1, 'Vehicle year cannot be in the distant future']
    }
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline',
    index: true
  },
  currentPoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pool',
    default: null,
    index: true
  },
  rating: {
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5'],
    default: 5.0,
    set: val => Math.round(val * 10) / 10 // Round to 1 decimal place
  },
  totalRatings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTrips: {
    type: Number,
    default: 0,
    min: 0
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true,
    trim: true,
    match: [/^[A-Z]{2}\d{2}\d{4}\d{7}$/, 'Invalid license number format']
  },
  licenseExpiry: {
    type: Date,
    required: [true, 'License expiry date is required'],
    validate: {
      validator: function(date) {
        return date > new Date();
      },
      message: 'License must not be expired'
    }
  },
  profilePhoto: {
    type: String,
    default: null
  },
  documents: {
    licenseFront: {
      type: String,
      required: [true, 'License front photo is required']
    },
    licenseBack: {
      type: String,
      required: [true, 'License back photo is required']
    },
    vehicleRC: {
      type: String,
      required: [true, 'Vehicle RC is required']
    },
    insurance: {
      type: String,
      required: [true, 'Insurance document is required']
    }
  },
  verified: {
    type: Boolean,
    default: false
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  currentLocation: {
    type: [Number], // [longitude, latitude]
    default: null,
    validate: {
      validator: function(coords) {
        return !coords || (coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && 
                 coords[1] >= -90 && coords[1] <= 90);
      },
      message: 'Invalid coordinates format. Expected [longitude, latitude]'
    }
  }
}, {
  timestamps: true,
  versionKey: '__v' // Enable version key for optimistic concurrency
});

// Indexes
driverSchema.index({ phone: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ currentPoolId: 1 });
driverSchema.index({ rating: -1 });
driverSchema.index({ verified: 1 });
driverSchema.index({ lastActiveAt: -1 });

// Virtual for driver's full name with vehicle info
driverSchema.virtual('fullInfo').get(function() {
  return `${this.name} - ${this.vehicle.make} ${this.vehicle.model} (${this.vehicle.plate})`;
});

// Virtual for checking if driver is available for assignment
driverSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && this.verified && !this.currentPoolId;
});

// Instance method to update status
driverSchema.methods.updateStatus = function(newStatus, poolId = null) {
  const validTransitions = {
    'offline': ['available'],
    'available': ['busy', 'offline'],
    'busy': ['available', 'offline']
  };

  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;
  this.lastActiveAt = new Date();
  
  if (newStatus === 'busy' && poolId) {
    this.currentPoolId = poolId;
  } else if (newStatus === 'available') {
    this.currentPoolId = null;
  }
  
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Instance method to add rating
driverSchema.methods.addRating = function(rating) {
  const totalRatingPoints = this.rating * this.totalRatings + rating;
  this.totalRatings += 1;
  this.rating = totalRatingPoints / this.totalRatings;
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Instance method to increment trip count
driverSchema.methods.incrementTrips = function() {
  this.totalTrips += 1;
  this.__v += 1; // Increment version for optimistic concurrency
  return this.save();
};

// Static method to find available drivers
driverSchema.statics.findAvailable = function() {
  return this.find({
    status: 'available',
    verified: true,
    currentPoolId: null
  }).sort({ rating: -1, lastActiveAt: -1 });
};

// Static method to get driver statistics
driverSchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        totalTrips: { $sum: '$totalTrips' }
      }
    }
  ]);
};

// Pre-save middleware to validate phone uniqueness
driverSchema.pre('save', async function(next) {
  if (!this.isModified('phone')) return next();
  
  try {
    const existingDriver = await this.constructor.findOne({ 
      phone: this.phone, 
      _id: { $ne: this._id } 
    });
    
    if (existingDriver) {
      const error = new Error('Phone number already registered');
      error.name = 'ValidationError';
      return next(error);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Driver', driverSchema);

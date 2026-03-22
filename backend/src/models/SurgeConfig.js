const mongoose = require('mongoose');

const surgeConfigSchema = new mongoose.Schema({
  airportCode: {
    type: String,
    required: [true, 'Airport code is required'],
    uppercase: true,
    unique: true,
    enum: ['BOM', 'DEL', 'BLR', 'HYD', 'MAA'],
    index: true
  },
  multiplier: {
    type: Number,
    required: [true, 'Surge multiplier is required'],
    min: [1.0, 'Surge multiplier cannot be less than 1.0'],
    max: [5.0, 'Surge multiplier cannot exceed 5.0'],
    default: 1.0,
    set: val => Math.round(val * 10) / 10 // Round to 1 decimal place
  },
  isManualOverride: {
    type: Boolean,
    default: false
  },
  autoSurgeEnabled: {
    type: Boolean,
    default: true
  },
  demandThreshold: {
    type: Number,
    default: 1.0,
    min: [0.5, 'Demand threshold cannot be less than 0.5'],
    max: [5.0, 'Demand threshold cannot exceed 5.0']
  },
  lastCalculatedAt: {
    type: Date,
    default: Date.now
  },
  calculatedDemand: {
    type: Number,
    default: 0,
    min: 0
  },
  availableDrivers: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingRides: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updateReason: {
    type: String,
    maxlength: [200, 'Update reason cannot exceed 200 characters'],
    trim: true
  }
}, {
  timestamps: true,
  versionKey: '__v' // Enable version key for optimistic concurrency
});

// Indexes
surgeConfigSchema.index({ airportCode: 1 }, { unique: true });
surgeConfigSchema.index({ multiplier: -1 });
surgeConfigSchema.index({ autoSurgeEnabled: 1 });
surgeConfigSchema.index({ lastCalculatedAt: -1 });

// Virtual for surge level description
surgeConfigSchema.virtual('surgeLevel').get(function() {
  if (this.multiplier <= 1.2) return 'normal';
  if (this.multiplier <= 1.5) return 'moderate';
  if (this.multiplier <= 2.0) return 'high';
  return 'extreme';
});

// Virtual for surge color (for UI)
surgeConfigSchema.virtual('surgeColor').get(function() {
  if (this.multiplier <= 1.2) return 'green';
  if (this.multiplier <= 1.5) return 'yellow';
  if (this.multiplier <= 2.0) return 'orange';
  return 'red';
});

// Instance method to update multiplier
surgeConfigSchema.methods.updateMultiplier = function(newMultiplier, isManual = false, updatedBy = null, reason = '') {
  if (newMultiplier < 1.0 || newMultiplier > 5.0) {
    throw new Error('Multiplier must be between 1.0 and 5.0');
  }

  this.multiplier = newMultiplier;
  this.isManualOverride = isManual;
  this.lastUpdatedBy = updatedBy;
  this.updateReason = reason;
  this.__v += 1; // Increment version for optimistic concurrency
  
  return this.save();
};

// Instance method to calculate auto surge
surgeConfigSchema.methods.calculateAutoSurge = function(availableDrivers, pendingRides) {
  if (!this.autoSurgeEnabled || this.isManualOverride) {
    return this.multiplier;
  }

  this.availableDrivers = availableDrivers;
  this.pendingRides = pendingRides;
  this.lastCalculatedAt = new Date();

  let demand = 0;
  if (availableDrivers > 0) {
    demand = pendingRides / availableDrivers;
  } else if (pendingRides > 0) {
    demand = 5.0; // Max surge when no drivers available
  }
  
  this.calculatedDemand = demand;

  let newMultiplier = 1.0;
  
  if (demand < 1.0) {
    newMultiplier = 1.0;
  } else if (demand >= 1.0 && demand <= 2.0) {
    newMultiplier = 1.0 + (demand - 1.0) * 0.5;
  } else {
    newMultiplier = Math.min(2.5, 1.5 + (demand - 2.0) * 0.3);
  }

  // Apply demand threshold
  if (demand < this.demandThreshold) {
    newMultiplier = 1.0;
  }

  this.multiplier = Math.round(newMultiplier * 10) / 10;
  this.__v += 1; // Increment version for optimistic concurrency
  
  return this.save();
};

// Static method to get all airport configs
surgeConfigSchema.statics.getAllConfigs = function() {
  return this.find({}).sort({ airportCode: 1 });
};

// Static method to get config by airport
surgeConfigSchema.statics.getByAirport = function(airportCode) {
  return this.findOne({ airportCode: airportCode.toUpperCase() });
};

// Static method to get high surge airports
surgeConfigSchema.statics.getHighSurgeAirports = function() {
  return this.find({ 
    multiplier: { $gt: 1.5 } 
  }).sort({ multiplier: -1 });
};

// Static method to initialize default configs
surgeConfigSchema.statics.initializeDefaults = async function() {
  const airports = ['BOM', 'DEL', 'BLR', 'HYD', 'MAA'];
  const operations = airports.map(airportCode => ({
    updateOne: {
      filter: { airportCode },
      update: {
        $setOnInsert: {
          airportCode,
          multiplier: 1.0,
          isManualOverride: false,
          autoSurgeEnabled: true,
          demandThreshold: 1.0
        }
      },
      upsert: true
    }
  }));

  return this.bulkWrite(operations);
};

module.exports = mongoose.model('SurgeConfig', surgeConfigSchema);

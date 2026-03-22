const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Request validation middleware using Joi schemas
 */
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Include all errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert types automatically
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      logger.warn(`Validation error for ${property}:`, errors);

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors
      });
    }

    // Replace the request property with validated and cleaned data
    req[property] = value;
    next();
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // User registration
  register: Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    role: Joi.string().valid('passenger', 'driver', 'admin').default('passenger')
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // User profile update
  updateProfile: Joi.object({
    name: Joi.string().trim().min(2).max(50),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/),
    role: Joi.string().valid('passenger', 'driver', 'admin')
  }).min(1),

  // Password change
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(128).required()
  }),

  // Ride request
  rideRequest: Joi.object({
    pickup: Joi.object({
      airportCode: Joi.string().valid('BOM', 'DEL', 'BLR', 'HYD', 'MAA').required(),
      name: Joi.string().trim().required(),
      coordinates: Joi.array().items(Joi.number().min(-180).max(180)).length(2).required()
    }).required(),
    destination: Joi.object({
      address: Joi.string().trim().max(200).required(),
      coordinates: Joi.array().items(Joi.number().min(-180).max(180)).length(2).required()
    }).required(),
    flightNumber: Joi.string().pattern(/^[A-Z]{2}\d{3,4}$/).required(),
    scheduledTime: Joi.date().iso().required(),
    passengers: Joi.number().integer().min(1).max(6).required(),
    luggage: Joi.number().integer().min(0).max(5).required(),
    isPool: Joi.boolean().default(true),
    detourTolerance: Joi.number().integer().min(0).max(60).default(15),
    specialRequests: Joi.string().trim().max(500).allow('')
  }),

  // Ride estimate
  rideEstimate: Joi.object({
    pickup: Joi.object({
      airportCode: Joi.string().valid('BOM', 'DEL', 'BLR', 'HYD', 'MAA').required(),
      name: Joi.string().trim().required(),
      coordinates: Joi.array().items(Joi.number().min(-180).max(180)).length(2).required()
    }).required(),
    destination: Joi.object({
      address: Joi.string().trim().max(200).required(),
      coordinates: Joi.array().items(Joi.number().min(-180).max(180)).length(2).required()
    }).required(),
    passengers: Joi.number().integer().min(1).max(6).required(),
    luggage: Joi.number().integer().min(0).max(5).required(),
    isPool: Joi.boolean().default(true)
  }),

  // Ride cancellation
  rideCancellation: Joi.object({
    reason: Joi.string().trim().max(500).allow('')
  }),

  // Driver creation
  driverCreate: Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    vehicle: Joi.object({
      type: Joi.string().valid('sedan', 'suv', 'hatchback', 'luxury').required(),
      plate: Joi.string().pattern(/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/).required(),
      maxSeats: Joi.number().integer().min(1).max(6).required(),
      maxLuggage: Joi.number().integer().min(0).max(5).required(),
      make: Joi.string().trim().max(30).required(),
      model: Joi.string().trim().max(30).required(),
      color: Joi.string().trim().max(20).required(),
      year: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required()
    }).required(),
    licenseNumber: Joi.string().pattern(/^[A-Z]{2}\d{2}\d{4}\d{7}$/).required(),
    licenseExpiry: Joi.date().iso().min('now').required()
  }),

  // Driver status update
  driverStatusUpdate: Joi.object({
    status: Joi.string().valid('available', 'busy', 'offline').required()
  }),

  // Surge config update
  surgeConfigUpdate: Joi.object({
    multiplier: Joi.number().min(1.0).max(5.0).required(),
    isManualOverride: Joi.boolean().required(),
    autoSurgeEnabled: Joi.boolean().optional(),
    updateReason: Joi.string().trim().max(200).allow('')
  }),

  // Date range filter
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  }),

  // Query parameters for pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Ride filters
  rideFilters: Joi.object({
    status: Joi.string().valid('requested', 'matched', 'assigned', 'in_progress', 'completed', 'cancelled').optional(),
    airportCode: Joi.string().valid('BOM', 'DEL', 'BLR', 'HYD', 'MAA').optional(),
    isPool: Joi.boolean().optional(),
    userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
  }),

  // Pool filters
  poolFilters: Joi.object({
    status: Joi.string().valid('forming', 'locked', 'assigned', 'completed').optional(),
    airportCode: Joi.string().valid('BOM', 'DEL', 'BLR', 'HYD', 'MAA').optional()
  })
};

/**
 * Custom validation functions
 */
const customValidators = {
  // Validate coordinates are within valid ranges
  validateCoordinates: (value, helpers) => {
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return helpers.error('custom.coordinates');
    }
    return value;
  },

  // Validate future date with minimum lead time
  validateFutureDate: (minHours = 1) => {
    return (value, helpers) => {
      const minTime = new Date(Date.now() + minHours * 60 * 60 * 1000);
      if (new Date(value) < minTime) {
        return helpers.error('custom.futureDate', { minHours });
      }
      return value;
    };
  },

  // Validate phone number format
  validatePhone: (value, helpers) => {
    if (!/^[6-9]\d{9}$/.test(value)) {
      return helpers.error('custom.phone');
    }
    return value;
  }
};

/**
 * Error messages for custom validations
 */
const customErrorMessages = {
  'custom.coordinates': 'Invalid coordinates. Must be within valid longitude (-180 to 180) and latitude (-90 to 90) ranges',
  'custom.futureDate': 'Scheduled time must be at least {{#minHours}} hour(s) in the future',
  'custom.phone': 'Invalid phone number. Must be a 10-digit number starting with 6, 7, 8, or 9'
};

/**
 * Middleware to validate MongoDB ObjectId
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName}`,
        code: 'INVALID_ID',
        field: paramName
      });
    }

    next();
  };
};

/**
 * Middleware to handle file uploads (for documents, photos)
 */
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
        code: 'FILE_REQUIRED'
      });
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type',
        code: 'INVALID_FILE_TYPE',
        allowed: allowedTypes
      });
    }

    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: maxSize
      });
    }

    next();
  };
};

module.exports = {
  validateRequest,
  schemas,
  customValidators,
  customErrorMessages,
  validateObjectId,
  validateFileUpload
};

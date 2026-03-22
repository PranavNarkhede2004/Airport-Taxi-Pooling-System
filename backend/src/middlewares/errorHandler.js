const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * Centralized error handling for the application
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
    timestamp: new Date().toISOString()
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];

    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
      code: 'DUPLICATE_FIELD',
      field,
      value
    });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      code: 'INVALID_ID',
      field: err.path,
      value: err.value
    });
  }

  // Mongoose version error (optimistic concurrency)
  if (err.name === 'VersionError') {
    return res.status(409).json({
      success: false,
      message: 'Data was modified by another process. Please try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Redis connection errors
  if (err.code === 'ECONNREFUSED' && err.message.includes('Redis')) {
    return res.status(503).json({
      success: false,
      message: 'Cache service unavailable',
      code: 'REDIS_UNAVAILABLE'
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: err.retryAfter || 60
    });
  }

  // Bull queue errors
  if (err.name === 'BullError') {
    return res.status(503).json({
      success: false,
      message: 'Job queue service unavailable',
      code: 'QUEUE_UNAVAILABLE'
    });
  }

  // Socket.io errors
  if (err.name === 'SocketError') {
    return res.status(503).json({
      success: false,
      message: 'Real-time service unavailable',
      code: 'SOCKET_UNAVAILABLE'
    });
  }

  // Custom application errors
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      code: err.code || 'APPLICATION_ERROR',
      ...(err.details && { details: err.details })
    });
  }

  // Default server error
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Something went wrong';

  res.status(statusCode).json({
    success: false,
    message,
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to automatically catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom Error Classes
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APPLICATION_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR', { errors });
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Error handling utilities
 */
const errorUtils = {
  /**
   * Create standardized error response
   */
  createErrorResponse: (message, code = 'ERROR', statusCode = 500, details = null) => ({
    success: false,
    message,
    code,
    ...(details && { details }),
    ...(process.env.NODE_ENV !== 'production' && { timestamp: new Date().toISOString() })
  }),

  /**
   * Handle database transaction errors
   */
  handleTransactionError: (error, operation) => {
    logger.error(`Transaction error during ${operation}:`, error);
    
    if (error.name === 'MongoServerError' && error.code === 112) {
      throw new ConflictError('Transaction conflict. Please try again.');
    }
    
    throw new AppError(`Failed to ${operation}`, 500, 'TRANSACTION_ERROR');
  },

  /**
   * Handle Redis operation errors
   */
  handleRedisError: (error, operation) => {
    logger.error(`Redis error during ${operation}:`, error);
    throw new ServiceUnavailableError('Cache service');
  },

  /**
   * Handle Socket.io errors
   */
  handleSocketError: (error, operation) => {
    logger.error(`Socket error during ${operation}:`, error);
    throw new ServiceUnavailableError('Real-time service');
  }
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.userId,
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request Warning:', logData);
    } else {
      logger.info('HTTP Request:', logData);
    }
  });

  next();
};

/**
 * 404 Handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
  errorUtils,
  requestLogger,
  notFoundHandler
};

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Redis-backed Rate Limiting Configuration
 */
const createRateLimiter = (options = {}) => {
  const redisOptions = {};
  
  // Only use Redis store if Redis is connected and not disabled
  try {
    if (redisClient.isConnected && !redisClient.disabled) {
      redisOptions.store = new RedisStore({
        sendCommand: (...args) => redisClient.getClient().call(...args),
      });
    }
  } catch (error) {
    // Silently fall back to memory store
  }

  const defaultOptions = {
    ...redisOptions,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        userId: req.userId
      });

      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: res.get('Retry-After') || options.windowMs / 1000
      });
    }
  };

  const finalSkip = (req) => {
    const isLocalhost = ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(req.ip);
    if (isLocalhost) return true;
    if (options.skip) return options.skip(req);
    return false;
  };

  return rateLimit({ ...defaultOptions, ...options, skip: finalSkip });
};

/**
 * Global rate limiter for all endpoints
 */
const globalLimiter = createRateLimiter({
  windowMs: 10 * 1000, // 10 seconds
  max: 100, // 100 requests per 10 seconds per IP
  message: 'Too many requests from this IP. Please try again later.',
  keyGenerator: (req) => req.ip
});

/**
 * Authentication endpoints rate limiter
 */
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: 'Too many authentication attempts. Please try again later.',
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

/**
 * Login-specific rate limiter (more restrictive)
 */
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes per IP
  message: 'Too many login attempts. Please try again later.',
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * Registration rate limiter
 */
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: 'Too many registration attempts. Please try again later.',
  keyGenerator: (req) => req.ip
});

/**
 * Ride booking rate limiter
 */
const rideBookingLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 ride requests per minute per user
  message: 'Too many ride requests. Please wait before booking another ride.',
  keyGenerator: (req) => req.userId ? `user:${req.userId}` : req.ip
});

/**
 * Ride cancellation rate limiter
 */
const rideCancellationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 cancellations per minute per user
  message: 'Too many cancellation attempts. Please wait before canceling another ride.',
  keyGenerator: (req) => req.userId ? `user:${req.userId}` : req.ip
});

/**
 * Admin endpoints rate limiter
 */
const adminLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute per admin
  message: 'Too many admin requests. Please slow down.',
  keyGenerator: (req) => req.userId ? `admin:${req.userId}` : req.ip,
  skip: (req) => req.userRole !== 'admin' // Skip if user is not admin
});

/**
 * API estimate rate limiter
 */
const estimateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 estimates per minute per IP
  message: 'Too many estimate requests. Please try again later.',
  keyGenerator: (req) => req.ip
});

/**
 * Driver operations rate limiter
 */
const driverLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 driver operations per minute per admin
  message: 'Too many driver operations. Please slow down.',
  keyGenerator: (req) => req.userId ? `driver:${req.userId}` : req.ip,
  skip: (req) => req.userRole !== 'admin'
});

/**
 * Surge configuration rate limiter
 */
const surgeLimiter = createRateLimiter({
  windowMs: 30 * 1000, // 30 seconds
  max: 10, // 10 surge updates per 30 seconds per admin
  message: 'Too many surge configuration changes. Please wait.',
  keyGenerator: (req) => req.userId ? `surge:${req.userId}` : req.ip,
  skip: (req) => req.userRole !== 'admin'
});

/**
 * Custom rate limiter for specific operations
 */
const createCustomLimiter = (windowMs, max, keyPrefix, message) => {
  return createRateLimiter({
    windowMs,
    max,
    message: message || 'Rate limit exceeded. Please try again later.',
    keyGenerator: (req) => {
      const key = req.userId ? `${keyPrefix}:user:${req.userId}` : `${keyPrefix}:ip:${req.ip}`;
      return key;
    }
  });
};

/**
 * Rate limiting middleware that applies different limits based on user role
 */
const roleBasedLimiter = (req, res, next) => {
  // Apply different limits based on user role
  if (req.userRole === 'admin') {
    return adminLimiter(req, res, next);
  } else if (req.userRole === 'driver') {
    return driverLimiter(req, res, next);
  } else {
    return globalLimiter(req, res, next);
  }
};

/**
 * Rate limiting middleware for WebSocket connections
 */
const socketRateLimiter = (socket, next) => {
  const ip = socket.handshake.address;
  // Bypass rate limiting for localhost
  if (['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(ip)) {
    return next();
  }
  const key = `socket:${ip}`;
  
  // Simple in-memory rate limit for socket connections
  const maxConnections = 10; // Max 10 connections per IP
  const windowMs = 60 * 1000; // 1 minute window
  
  redisClient.getClient().get(key)
    .then(count => {
      const currentCount = parseInt(count) || 0;
      
      if (currentCount >= maxConnections) {
        return next(new Error('Too many socket connections'));
      }
      
      // Increment counter
      redisClient.getClient().incr(key);
      redisClient.getClient().expire(key, Math.ceil(windowMs / 1000));
      
      // Decrement counter on disconnect
      socket.on('disconnect', () => {
        redisClient.getClient().decr(key).catch(err => {
          logger.error('Error decrementing socket rate limit counter:', err);
        });
      });
      
      next();
    })
    .catch(err => {
      logger.error('Socket rate limiting error:', err);
      next(); // Allow connection if Redis fails
    });
};

/**
 * Rate limiting utilities
 */
const rateLimitUtils = {
  /**
   * Get current rate limit status for a key
   */
  getRateLimitStatus: async (key) => {
    try {
      const client = redisClient.getClient();
      const count = await client.get(key);
      const ttl = await client.ttl(key);
      
      return {
        count: parseInt(count) || 0,
        ttl: ttl > 0 ? ttl : null,
        key
      };
    } catch (error) {
      logger.error('Error getting rate limit status:', error);
      return null;
    }
  },

  /**
   * Reset rate limit for a specific key
   */
  resetRateLimit: async (key) => {
    try {
      const client = redisClient.getClient();
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Error resetting rate limit:', error);
      return false;
    }
  },

  /**
   * Check if IP is rate limited
   */
  isIpRateLimited: async (ip, endpoint = 'global') => {
    const key = `rl:${endpoint}:${ip}`;
    const status = await rateLimitUtils.getRateLimitStatus(key);
    
    return status && status.count > 0;
  }
};

module.exports = {
  globalLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  rideBookingLimiter,
  rideCancellationLimiter,
  adminLimiter,
  estimateLimiter,
  driverLimiter,
  surgeLimiter,
  createCustomLimiter,
  roleBasedLimiter,
  socketRateLimiter,
  rateLimitUtils,
  createRateLimiter
};

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Verifies Bearer token and attaches user to request object
 */
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user in database
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user',
        code: 'INVALID_USER'
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    logger.error('JWT Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Role-based Authorization Middleware
 * Checks if user has required role(s)
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user._id} with role ${req.user.role}. Required roles: ${allowedRoles.join(', ')}`);
      
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Optional Authentication Middleware
 * Attaches user if token is present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
      req.userRole = user.role;
    }

    next();
  } catch (error) {
    // Silently ignore authentication errors for optional auth
    next();
  }
};

/**
 * Generate JWT Token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify JWT Token (without database lookup)
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Refresh Token Handler
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const newToken = generateToken(user._id);
    
    res.json({
      success: true,
      data: {
        token: newToken,
        user: user.toPublicJSON()
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    logger.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
};

/**
 * Extract user info from token (for logging/middleware)
 */
const extractUserFromToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateJWT,
  authorizeRole,
  optionalAuth,
  generateToken,
  verifyToken,
  refreshToken,
  extractUserFromToken
};

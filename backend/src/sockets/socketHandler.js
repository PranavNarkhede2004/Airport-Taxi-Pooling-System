const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Socket.io Connection Handler
 * Manages real-time connections and events
 */
class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socket.id
    this.adminSockets = new Set(); // Set of admin socket IDs
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup authentication middleware for socket connections
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user in database
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.isActive) {
          return next(new Error('Invalid or inactive user'));
        }

        // Attach user to socket
        socket.user = user;
        socket.userId = user._id.toString();
        socket.userRole = user.role;

        logger.info(`Socket connected: ${socket.id} for user ${user.email} (${user.role})`);
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup main event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // Store socket connection
    this.connectedUsers.set(userId, socket.id);
    
    // Add admin sockets to admin set
    if (userRole === 'admin') {
      this.adminSockets.add(socket.id);
    }

    // Join user-specific room
    socket.join(`user:${userId}`);
    
    // Join admin room if admin
    if (userRole === 'admin') {
      socket.join('admin');
    }

    // Join driver room if driver
    if (userRole === 'driver') {
      socket.join('driver');
    }

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Airport Pooling System',
      userId,
      role: userRole,
      timestamp: new Date().toISOString()
    });

    // Setup event listeners for this socket
    this.setupSocketEventListeners(socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });

    logger.info(`User ${userId} connected with socket ${socket.id}`);
  }

  /**
   * Setup event listeners for individual socket
   */
  setupSocketEventListeners(socket) {
    // Join ride-specific room
    socket.on('join-ride', (data) => {
      this.handleJoinRide(socket, data);
    });

    // Leave ride-specific room
    socket.on('leave-ride', (data) => {
      this.handleLeaveRide(socket, data);
    });

    // Join pool-specific room
    socket.on('join-pool', (data) => {
      this.handleJoinPool(socket, data);
    });

    // Leave pool-specific room
    socket.on('leave-pool', (data) => {
      this.handleLeavePool(socket, data);
    });

    // Track driver location
    socket.on('driver-location', (data) => {
      this.handleDriverLocation(socket, data);
    });

    // Handle ping for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }

  /**
   * Handle joining ride-specific room
   */
  handleJoinRide(socket, data) {
    const { rideId } = data;
    
    if (!rideId) {
      socket.emit('error', { message: 'Ride ID is required' });
      return;
    }

    socket.join(`ride:${rideId}`);
    socket.emit('joined-ride', { rideId });
    
    logger.debug(`User ${socket.userId} joined ride room: ${rideId}`);
  }

  /**
   * Handle leaving ride-specific room
   */
  handleLeaveRide(socket, data) {
    const { rideId } = data;
    
    if (!rideId) {
      socket.emit('error', { message: 'Ride ID is required' });
      return;
    }

    socket.leave(`ride:${rideId}`);
    socket.emit('left-ride', { rideId });
    
    logger.debug(`User ${socket.userId} left ride room: ${rideId}`);
  }

  /**
   * Handle joining pool-specific room
   */
  handleJoinPool(socket, data) {
    const { poolId } = data;
    
    if (!poolId) {
      socket.emit('error', { message: 'Pool ID is required' });
      return;
    }

    socket.join(`pool:${poolId}`);
    socket.emit('joined-pool', { poolId });
    
    logger.debug(`User ${socket.userId} joined pool room: ${poolId}`);
  }

  /**
   * Handle leaving pool-specific room
   */
  handleLeavePool(socket, data) {
    const { poolId } = data;
    
    if (!poolId) {
      socket.emit('error', { message: 'Pool ID is required' });
      return;
    }

    socket.leave(`pool:${poolId}`);
    socket.emit('left-pool', { poolId });
    
    logger.debug(`User ${socket.userId} left pool room: ${poolId}`);
  }

  /**
   * Handle driver location updates
   */
  handleDriverLocation(socket, data) {
    const { location, rideId } = data;
    
    if (socket.userRole !== 'driver') {
      socket.emit('error', { message: 'Only drivers can share location' });
      return;
    }

    if (!location || !Array.isArray(location) || location.length !== 2) {
      socket.emit('error', { message: 'Invalid location format' });
      return;
    }

    // Broadcast location to relevant ride room
    if (rideId) {
      socket.to(`ride:${rideId}`).emit('driver-location-updated', {
        driverId: socket.userId,
        location,
        timestamp: new Date().toISOString()
      });
    }

    logger.debug(`Driver ${socket.userId} location updated: ${location}`);
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnection(socket, reason) {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // Remove from connected users
    this.connectedUsers.delete(userId);
    
    // Remove from admin sockets
    if (userRole === 'admin') {
      this.adminSockets.delete(socket.id);
    }

    logger.info(`User ${userId} disconnected. Reason: ${reason}`);
  }

  /**
   * Emit ride status update to relevant users
   */
  emitRideUpdate(rideId, data) {
    this.io.to(`ride:${rideId}`).emit('ride:updated', {
      rideId,
      ...data,
      timestamp: new Date().toISOString()
    });

    // Also emit to user's personal room
    if (data.userId) {
      this.io.to(`user:${data.userId}`).emit('ride:updated', {
        rideId,
        ...data,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Ride update emitted for ride ${rideId}`);
  }

  /**
   * Emit new ride request to all drivers
   */
  emitNewRideRequest(ride) {
    this.io.to('driver').emit('ride:new-request', {
      ride,
      timestamp: new Date().toISOString()
    });
    this.broadcastToAdmins('ride:new-request', { ride });
    logger.info(`New ride request broadcasted for airport ${ride.destination?.airportCode}`);
  }

  /**
   * Emit pool match notification
   */
  emitPoolMatch(poolId, data) {
    const { coPassengers, eta } = data;

    // Emit to all rides in the pool
    this.io.to(`pool:${poolId}`).emit('pool:matched', {
      poolId,
      coPassengers,
      eta,
      timestamp: new Date().toISOString()
    });

    // Also emit to individual user rooms
    coPassengers.forEach(passenger => {
      if (passenger.userId) {
        this.io.to(`user:${passenger.userId}`).emit('pool:matched', {
          poolId,
          coPassengers,
          eta,
          timestamp: new Date().toISOString()
        });
      }
    });

    logger.info(`Pool match emitted for pool ${poolId}`);
  }

  /**
   * Emit ride cancellation notification
   */
  emitRideCancellation(rideId, data) {
    const { reason, userId } = data;

    // Emit to ride room
    this.io.to(`ride:${rideId}`).emit('ride:cancelled', {
      rideId,
      reason,
      timestamp: new Date().toISOString()
    });

    // Emit to user's personal room
    if (userId) {
      this.io.to(`user:${userId}`).emit('ride:cancelled', {
        rideId,
        reason,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Ride cancellation emitted for ride ${rideId}`);
  }

  /**
   * Emit surge update notification
   */
  emitSurgeUpdate(airportCode, data) {
    const { multiplier, isManual } = data;

    // Emit to all admin sockets
    this.io.to('admin').emit('surge:updated', {
      airportCode,
      multiplier,
      isManual,
      timestamp: new Date().toISOString()
    });

    logger.info(`Surge update emitted for ${airportCode}: ${multiplier}x`);
  }

  /**
   * Emit driver assignment notification
   */
  emitDriverAssignment(rideId, data) {
    const { driverId, driverInfo } = data;

    // Emit to ride room
    this.io.to(`ride:${rideId}`).emit('driver:assigned', {
      rideId,
      driverId,
      driverInfo,
      timestamp: new Date().toISOString()
    });

    // Emit to driver
    if (driverId) {
      this.io.to(`user:${driverId}`).emit('driver:assigned', {
        rideId,
        driverId,
        driverInfo,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Driver assignment emitted for ride ${rideId}`);
  }

  /**
   * Emit pool status update
   */
  emitPoolUpdate(poolId, data) {
    this.io.to(`pool:${poolId}`).emit('pool:updated', {
      poolId,
      ...data,
      timestamp: new Date().toISOString()
    });

    logger.info(`Pool update emitted for pool ${poolId}`);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      totalConnections: this.connectedUsers.size,
      adminConnections: this.adminSockets.size,
      connectedUsers: Array.from(this.connectedUsers.keys()),
      adminSockets: Array.from(this.adminSockets)
    };
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get socket ID for user
   */
  getUserSocketId(userId) {
    return this.connectedUsers.get(userId);
  }

  /**
   * Send notification to specific user
   */
  sendNotificationToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all admin users
   */
  broadcastToAdmins(event, data) {
    this.io.to('admin').emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = SocketHandler;

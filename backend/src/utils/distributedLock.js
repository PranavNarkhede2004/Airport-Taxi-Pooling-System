const Redlock = require('redlock');
const redisClient = require('../config/redis');
const logger = require('./logger');

/**
 * Distributed Lock Manager using Redlock
 * Prevents concurrent operations on shared resources
 */
class DistributedLock {
  constructor() {
    this.redlock = null;
    this.defaultTTL = 5000; // 5 seconds default TTL
    this.retryCount = 3;
    this.retryDelay = 100; // 100ms between retries
  }

  /**
   * Initialize Redlock with Redis client
   */
  async initialize() {
    try {
      const client = redisClient.getClient();
      this.redlock = new Redlock([client], {
        driftFactor: 0.01,
        retryCount: this.retryCount,
        retryDelay: this.retryDelay,
        retryJitter: 200
      });

      logger.info('Distributed lock manager initialized');
    } catch (error) {
      logger.error('Failed to initialize distributed lock manager:', error);
      throw error;
    }
  }

  /**
   * Acquire a lock on a resource
   * @param {string} resource - Resource identifier
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<Lock>} - Lock object
   */
  async acquireLock(resource, ttl = this.defaultTTL) {
    if (redisClient.disabled) {
      logger.debug(`Bypassing lock acquisition for resource: ${resource} (Redis disabled)`);
      return { unlock: async () => {} }; // Dummy lock
    }

    if (!this.redlock) {
      await this.initialize();
    }

    try {
      const lock = await this.redlock.lock(resource, ttl);
      logger.debug(`Acquired lock on resource: ${resource}`);
      return lock;
    } catch (error) {
      logger.error(`Failed to acquire lock on resource ${resource}:`, error);
      throw error;
    }
  }

  /**
   * Execute a function with a distributed lock
   * @param {string} resource - Resource identifier
   * @param {Function} callback - Function to execute while holding lock
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<any>} - Result of the callback function
   */
  async withLock(resource, callback, ttl = this.defaultTTL) {
    if (redisClient.disabled) {
      logger.debug(`Bypassing distributed lock execution for resource: ${resource} (Redis disabled)`);
      return await callback();
    }

    let lock = null;
    
    try {
      lock = await this.acquireLock(resource, ttl);
      const result = await callback();
      return result;
    } catch (error) {
      logger.error(`Error executing with lock on resource ${resource}:`, error);
      throw error;
    } finally {
      if (lock) {
        try {
          await lock.unlock();
          logger.debug(`Released lock on resource: ${resource}`);
        } catch (unlockError) {
          logger.error(`Error releasing lock on resource ${resource}:`, unlockError);
        }
      }
    }
  }

  /**
   * Try to acquire a lock without blocking
   * @param {string} resource - Resource identifier
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<Lock|null>} - Lock object or null if not available
   */
  async tryLock(resource, ttl = this.defaultTTL) {
    if (redisClient.disabled) {
      logger.debug(`Bypassing tryLock for resource: ${resource} (Redis disabled)`);
      return { unlock: async () => {} }; // Dummy lock
    }

    if (!this.redlock) {
      await this.initialize();
    }

    try {
      const lock = await this.redlock.lock(resource, ttl);
      logger.debug(`Acquired lock on resource: ${resource}`);
      return lock;
    } catch (error) {
      if (error.name === 'LockError') {
        logger.debug(`Lock not available for resource: ${resource}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Release a lock manually
   * @param {Lock} lock - Lock object to release
   */
  async releaseLock(lock) {
    try {
      await lock.unlock();
      logger.debug('Manually released lock');
    } catch (error) {
      logger.error('Error manually releasing lock:', error);
      throw error;
    }
  }

  /**
   * Check if a lock exists for a resource
   * @param {string} resource - Resource identifier
   * @returns {Promise<boolean>} - True if lock exists
   */
  async isLocked(resource) {
    try {
      const lock = await this.tryLock(resource, 1000); // Try with 1 second TTL
      if (lock) {
        await lock.unlock();
        return false;
      }
      return true;
    } catch (error) {
      logger.error(`Error checking lock status for resource ${resource}:`, error);
      return true; // Assume locked if we can't check
    }
  }

  /**
   * Generate lock key for airport operations
   * @param {string} airportCode - Airport code
   * @param {string} operation - Operation type
   * @returns {string} - Lock key
   */
  generateAirportLockKey(airportCode, operation = 'pool_matching') {
    return `pool_lock:${airportCode}:${operation}`;
  }

  /**
   * Generate lock key for ride operations
   * @param {string} rideId - Ride ID
   * @param {string} operation - Operation type
   * @returns {string} - Lock key
   */
  generateRideLockKey(rideId, operation = 'status_update') {
    return `ride_lock:${rideId}:${operation}`;
  }

  /**
   * Generate lock key for pool operations
   * @param {string} poolId - Pool ID
   * @param {string} operation - Operation type
   * @returns {string} - Lock key
   */
  generatePoolLockKey(poolId, operation = 'status_update') {
    return `pool_lock:${poolId}:${operation}`;
  }

  /**
   * Execute pool matching with distributed locking
   * @param {string} airportCode - Airport code
   * @param {Function} callback - Pool matching function
   * @returns {Promise<any>} - Result of pool matching
   */
  async withPoolMatchingLock(airportCode, callback) {
    const lockKey = this.generateAirportLockKey(airportCode, 'pool_matching');
    const ttl = 10000; // 10 seconds for pool matching
    
    return this.withLock(lockKey, callback, ttl);
  }

  /**
   * Execute ride status update with distributed locking
   * @param {string} rideId - Ride ID
   * @param {Function} callback - Status update function
   * @returns {Promise<any>} - Result of status update
   */
  async withRideStatusLock(rideId, callback) {
    const lockKey = this.generateRideLockKey(rideId, 'status_update');
    const ttl = 5000; // 5 seconds for status update
    
    return this.withLock(lockKey, callback, ttl);
  }

  /**
   * Execute pool status update with distributed locking
   * @param {string} poolId - Pool ID
   * @param {Function} callback - Status update function
   * @returns {Promise<any>} - Result of status update
   */
  async withPoolStatusLock(poolId, callback) {
    const lockKey = this.generatePoolLockKey(poolId, 'status_update');
    const ttl = 5000; // 5 seconds for status update
    
    return this.withLock(lockKey, callback, ttl);
  }
}

module.exports = new DistributedLock();

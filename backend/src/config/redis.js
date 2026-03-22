const redis = require('redis');
const logger = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.disabled = process.env.NODE_ENV === 'development' && !process.env.FORCE_REDIS;
  }

  async connect() {
    // Skip Redis connection entirely in development unless FORCE_REDIS is set
    if (this.disabled) {
      logger.info('Redis disabled in development mode. Set FORCE_REDIS=true to enable.');
      return null;
    }

    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL,
        retry_attempts_on_failover: 0, // Disable retries
        maxRetriesPerRequest: 0, // Disable retries
        socket: {
          connectTimeout: 2000,
          lazyConnect: false
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis Client Ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis Client Ended');
        this.isConnected = false;
      });

      // Try to connect once and fail fast
      try {
        await this.client.connect();
      } catch (connectError) {
        logger.warn('Redis connection failed, disabling Redis:', connectError.message);
        this.disabled = true;
        this.isConnected = false;
        return null;
      }
      
      return this.client;
    } catch (error) {
      logger.warn('Failed to initialize Redis client, disabling Redis:', error.message);
      this.disabled = true;
      this.isConnected = false;
      return null;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  getClient() {
    if (this.disabled) {
      throw new Error('Redis is disabled in development mode');
    }
    if (!this.isConnected || !this.client) {
      throw new Error('Redis client not connected - Redis is not available');
    }
    return this.client;
  }

  // Helper methods for common operations
  async set(key, value, ttlInSeconds) {
    if (this.disabled) {
      return;
    }
    try {
      const client = this.getClient();
      if (ttlInSeconds) {
        await client.setEx(key, ttlInSeconds, JSON.stringify(value));
      } else {
        await client.set(key, JSON.stringify(value));
      }
    } catch (error) {
      logger.warn('Redis set operation failed:', error.message);
    }
  }

  async get(key) {
    if (this.disabled) {
      return null;
    }
    try {
      const client = this.getClient();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.warn('Redis get operation failed:', error.message);
      return null;
    }
  }

  async del(key) {
    if (this.disabled) {
      return;
    }
    try {
      const client = this.getClient();
      await client.del(key);
    } catch (error) {
      logger.warn('Redis del operation failed:', error.message);
    }
  }

  async exists(key) {
    if (this.disabled) {
      return false;
    }
    try {
      const client = this.getClient();
      return await client.exists(key);
    } catch (error) {
      logger.warn('Redis exists operation failed:', error.message);
      return false;
    }
  }

  async expire(key, ttlInSeconds) {
    if (this.disabled) {
      return false;
    }
    try {
      const client = this.getClient();
      return await client.expire(key, ttlInSeconds);
    } catch (error) {
      logger.warn('Redis expire operation failed:', error.message);
      return false;
    }
  }
}

module.exports = new RedisClient();

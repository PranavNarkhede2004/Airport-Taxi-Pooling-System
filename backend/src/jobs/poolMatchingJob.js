const Queue = require('bull');
const redisClient = require('../config/redis');
const PoolMatcher = require('../algorithms/poolMatcher');
const SurgeConfig = require('../models/SurgeConfig');
const Driver = require('../models/Driver');
const logger = require('../utils/logger');

/**
 * Bull Queue for Pool Matching Jobs
 * Handles automatic pool matching with concurrency control
 */
class PoolMatchingQueue {
  constructor() {
    this.queue = null;
    this.poolMatcher = new PoolMatcher();
    this.isProcessing = false;
  }

  /**
   * Initialize the queue
   */
  async initialize() {
    try {
      this.queue = new Queue('pool matching', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          maxRetriesPerRequest: 3
        },
        defaultJobOptions: {
          removeOnComplete: 10, // Keep last 10 completed jobs
          removeOnFail: 5,      // Keep last 5 failed jobs
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      });

      this.setupProcessors();
      this.setupEventListeners();

      logger.info('Pool matching queue initialized');
    } catch (error) {
      logger.error('Failed to initialize pool matching queue:', error);
      throw error;
    }
  }

  /**
   * Setup job processors
   */
  setupProcessors() {
    // Pool matching processor (concurrency: 1 to prevent conflicts)
    this.queue.process('match-pools', 1, async (job) => {
      return await this.processPoolMatching(job);
    });

    // Surge calculation processor
    this.queue.process('calculate-surge', 1, async (job) => {
      return await this.processSurgeCalculation(job);
    });

    // Driver availability check processor
    this.queue.process('check-driver-availability', 2, async (job) => {
      return await this.processDriverAvailabilityCheck(job);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} (${job.name}) completed`, result);
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} (${job.name}) failed:`, err);
      
      // Emit socket event for failed jobs if admin is connected
      if (global.socketHandler) {
        global.socketHandler.broadcastToAdmins('job:failed', {
          jobId: job.id,
          jobName: job.name,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} (${job.name}) stalled`);
    });

    this.queue.on('progress', (job, progress) => {
      logger.debug(`Job ${job.id} (${job.name}) progress: ${progress}%`);
    });
  }

  /**
   * Process pool matching job
   */
  async processPoolMatching(job) {
    const startTime = Date.now();
    
    try {
      if (this.isProcessing) {
        logger.warn('Pool matching already in progress, skipping this run');
        return { status: 'skipped', reason: 'already_processing' };
      }

      this.isProcessing = true;
      job.progress(10);

      logger.info('Starting pool matching job...');

      // Run pool matching algorithm
      const createdPools = await this.poolMatcher.matchPools();
      job.progress(70);

      // Get matching statistics
      const stats = await this.poolMatcher.getMatchingStats();
      job.progress(90);

      const duration = Date.now() - startTime;
      const result = {
        status: 'completed',
        createdPools: createdPools.length,
        pools: createdPools.map(pool => ({
          id: pool._id,
          airportCode: pool.airportCode,
          ridesCount: pool.rides.length,
          totalSeats: pool.totalSeats,
          totalLuggage: pool.totalLuggage,
          totalDeviation: pool.totalDeviation
        })),
        statistics: stats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      };

      // Emit socket events for created pools
      if (global.socketHandler && createdPools.length > 0) {
        createdPools.forEach(pool => {
          // Notify matched users
          pool.rides.forEach(ride => {
            global.socketHandler.emitPoolMatch(pool._id, {
              coPassengers: pool.rides.filter(r => !r._id.equals(ride._id))
                .map(r => ({
                  userId: r.userId,
                  pickup: r.pickup,
                  passengers: r.passengers,
                  luggage: r.luggage
                })),
              eta: pool.estimatedDuration || 30
            });
          });
        });

        // Notify admins
        global.socketHandler.broadcastToAdmins('pools:matched', {
          createdPools: createdPools.length,
          pools: result.pools,
          timestamp: new Date().toISOString()
        });
      }

      job.progress(100);
      logger.info(`Pool matching completed in ${duration}ms. Created ${createdPools.length} pools`);

      return result;
    } catch (error) {
      logger.error('Pool matching job failed:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process surge calculation job
   */
  async processSurgeCalculation(job) {
    const { airportCode } = job.data;
    
    try {
      logger.info(`Calculating surge for ${airportCode}...`);

      // Get current demand and supply
      const Ride = require('../models/Ride');
      
      const pendingRides = await Ride.countDocuments({
        status: 'requested',
        'destination.airportCode': airportCode,
        scheduledTime: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 2 * 60 * 60 * 1000)
        }
      });

      const availableDrivers = await Driver.countDocuments({
        status: 'available',
        verified: true,
        currentPoolId: null
      });

      // Update surge configuration
      const surgeConfig = await SurgeConfig.getByAirport(airportCode);
      if (surgeConfig) {
        await surgeConfig.calculateAutoSurge(availableDrivers, pendingRides);

        // Emit surge update via socket
        if (global.socketHandler) {
          global.socketHandler.emitSurgeUpdate(airportCode, {
            multiplier: surgeConfig.multiplier,
            isManual: surgeConfig.isManualOverride
          });
        }

        logger.info(`Surge updated for ${airportCode}: ${surgeConfig.multiplier}x (${pendingRides} rides, ${availableDrivers} drivers)`);
      }

      return {
        airportCode,
        pendingRides,
        availableDrivers,
        multiplier: surgeConfig?.multiplier || 1.0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Surge calculation failed for ${airportCode}:`, error);
      throw error;
    }
  }

  /**
   * Process driver availability check job
   */
  async processDriverAvailabilityCheck(job) {
    const { airportCode } = job.data;
    
    try {
      logger.info(`Checking driver availability for ${airportCode}...`);

      const availableDrivers = await Driver.findAvailable();
      
      // Update driver locations and availability
      const updatedDrivers = [];
      for (const driver of availableDrivers) {
        // Simulate location update or ping check
        const lastActiveDiff = Date.now() - driver.lastActiveAt.getTime();
        
        // Mark as offline if inactive for more than 5 minutes
        if (lastActiveDiff > 5 * 60 * 1000) {
          await driver.updateStatus('offline');
          updatedDrivers.push({
            id: driver._id,
            previousStatus: 'available',
            newStatus: 'offline'
          });
        }
      }

      return {
        airportCode,
        totalAvailable: availableDrivers.length,
        updatedDrivers,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Driver availability check failed for ${airportCode}:`, error);
      throw error;
    }
  }

  /**
   * Add recurring pool matching job
   */
  async addRecurringPoolMatchingJob() {
    const intervalMs = parseInt(process.env.POOL_MATCH_INTERVAL_MS) || 30000; // 30 seconds default
    
    const job = await this.queue.add('match-pools', {}, {
      repeat: { every: intervalMs },
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });

    logger.info(`Recurring pool matching job scheduled with interval ${intervalMs}ms (Job ID: ${job.id})`);
    return job;
  }

  /**
   * Add recurring surge calculation jobs
   */
  async addRecurringSurgeJobs() {
    const airports = ['BOM', 'DEL', 'BLR', 'HYD', 'MAA'];
    const intervalMs = 60000; // 1 minute

    const jobs = [];
    
    for (const airportCode of airports) {
      const job = await this.queue.add('calculate-surge', 
        { airportCode }, 
        {
          repeat: { every: intervalMs },
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 }
        }
      );
      
      jobs.push(job);
      logger.info(`Surge calculation job scheduled for ${airportCode} (Job ID: ${job.id})`);
    }

    return jobs;
  }

  /**
   * Add recurring driver availability check jobs
   */
  async addRecurringDriverCheckJobs() {
    const airports = ['BOM', 'DEL', 'BLR', 'HYD', 'MAA'];
    const intervalMs = 2 * 60 * 1000; // 2 minutes

    const jobs = [];
    
    for (const airportCode of airports) {
      const job = await this.queue.add('check-driver-availability', 
        { airportCode }, 
        {
          repeat: { every: intervalMs },
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 }
        }
      );
      
      jobs.push(job);
      logger.info(`Driver availability check job scheduled for ${airportCode} (Job ID: ${job.id})`);
    }

    return jobs;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const waiting = await this.queue.getWaiting();
      const active = await this.queue.getActive();
      const completed = await this.queue.getCompleted();
      const failed = await this.queue.getFailed();
      const delayed = await this.queue.getDelayed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return null;
    }
  }

  /**
   * Pause queue processing
   */
  async pauseQueue() {
    await this.queue.pause();
    logger.info('Pool matching queue paused');
  }

  /**
   * Resume queue processing
   */
  async resumeQueue() {
    await this.queue.resume();
    logger.info('Pool matching queue resumed');
  }

  /**
   * Clean up queue
   */
  async cleanQueue(grace = 0) {
    await this.queue.clean(grace, 'completed');
    await this.queue.clean(grace, 'failed');
    logger.info('Queue cleaned up');
  }

  /**
   * Close queue
   */
  async closeQueue() {
    await this.queue.close();
    logger.info('Pool matching queue closed');
  }
}

module.exports = new PoolMatchingQueue();

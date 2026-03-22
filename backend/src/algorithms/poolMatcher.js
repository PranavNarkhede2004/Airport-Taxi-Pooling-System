const logger = require('../utils/logger');
const { calculateDistance, estimateTravelTime } = require('../utils/pricing');
const Ride = require('../models/Ride');
const Pool = require('../models/Pool');
const SurgeConfig = require('../models/SurgeConfig');

/**
 * Greedy Interval-Based Pool Matching Algorithm
 * Groups passengers into shared cabs while optimizing routes
 */
class PoolMatcher {
  constructor() {
    this.MAX_POOL_SEATS = parseInt(process.env.MAX_POOL_SEATS) || 6;
    this.MAX_POOL_LUGGAGE = parseInt(process.env.MAX_POOL_LUGGAGE) || 5;
    this.TIME_WINDOW_MINUTES = 40; // ±20 minutes window
    this.MAX_DETOUR_MINUTES = 30; // Maximum allowed detour per passenger
  }

  /**
   * Main pool matching function - called every 30 seconds
   */
  async matchPools() {
    try {
      logger.info('Starting pool matching process...');
      
      const airports = ['BOM', 'DEL', 'BLR', 'HYD', 'MAA'];
      const results = [];

      for (const airportCode of airports) {
        const airportResults = await this.matchPoolsForAirport(airportCode);
        results.push(...airportResults);
      }

      logger.info(`Pool matching completed. Created ${results.length} pools.`);
      return results;
    } catch (error) {
      logger.error('Error in pool matching:', error);
      throw error;
    }
  }

  /**
   * Match pools for a specific airport
   */
  async matchPoolsForAirport(airportCode) {
    try {
      // Get all requested rides for this airport
      const rides = await Ride.findPoolableRides(airportCode);
      
      if (rides.length < 2) {
        logger.debug(`Not enough rides for pooling at ${airportCode}: ${rides.length}`);
        return [];
      }

      logger.debug(`Found ${rides.length} poolable rides for ${airportCode}`);

      // Sort rides by scheduled time
      rides.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

      const createdPools = [];
      const processedRides = new Set();

      // Use sliding window to find compatible groups
      for (let i = 0; i < rides.length; i++) {
        if (processedRides.has(rides[i]._id.toString())) continue;

        const windowRides = this.findTimeWindow(rides, i);
        if (windowRides.length < 2) continue;

        // Find best group within window
        const bestGroup = this.findBestGroup(windowRides);
        
        if (bestGroup && bestGroup.rides.length >= 2) {
          // Create pool
          const pool = await this.createPool(bestGroup, airportCode);
          if (pool) {
            createdPools.push(pool);
            
            // Mark rides as processed
            bestGroup.rides.forEach(ride => {
              processedRides.add(ride._id.toString());
            });
          }
        }
      }

      return createdPools;
    } catch (error) {
      logger.error(`Error matching pools for ${airportCode}:`, error);
      return [];
    }
  }

  /**
   * Find rides within time window (±20 minutes)
   */
  findTimeWindow(rides, startIndex) {
    const baseRide = rides[startIndex];
    const baseTime = new Date(baseRide.scheduledTime);
    const windowStart = new Date(baseTime.getTime() - 20 * 60 * 1000);
    const windowEnd = new Date(baseTime.getTime() + 20 * 60 * 1000);

    const windowRides = [baseRide];
    
    for (let i = startIndex + 1; i < rides.length; i++) {
      const rideTime = new Date(rides[i].scheduledTime);
      if (rideTime <= windowEnd) {
        windowRides.push(rides[i]);
      } else {
        break; // Rides are sorted, so we can break early
      }
    }

    // Filter by window start time
    return windowRides.filter(ride => {
      const rideTime = new Date(ride.scheduledTime);
      return rideTime >= windowStart && rideTime <= windowEnd;
    });
  }

  /**
   * Find best group of rides within time window
   */
  findBestGroup(windowRides) {
    let bestGroup = null;
    let bestScore = Infinity;

    // Try different group sizes (2 to max possible)
    const maxGroupSize = Math.min(windowRides.length, this.MAX_POOL_SEATS);
    
    for (let groupSize = 2; groupSize <= maxGroupSize; groupSize++) {
      const groups = this.generateCombinations(windowRides, groupSize);
      
      for (const group of groups) {
        const validation = this.validateGroup(group);
        
        if (validation.isValid) {
          const routeOptimization = this.optimizeRoute(group);
          
          if (routeOptimization.isValid) {
            const score = this.calculateGroupScore(group, routeOptimization);
            
            if (score < bestScore) {
              bestScore = score;
              bestGroup = {
                rides: group,
                totalSeats: validation.totalSeats,
                totalLuggage: validation.totalLuggage,
                routeOrder: routeOptimization.routeOrder,
                totalDeviation: routeOptimization.totalDeviation,
                score
              };
            }
          }
        }
      }
    }

    return bestGroup;
  }

  /**
   * Generate all combinations of rides for given group size
   */
  generateCombinations(rides, size) {
    const combinations = [];
    
    function combine(start, current) {
      if (current.length === size) {
        combinations.push([...current]);
        return;
      }
      
      for (let i = start; i < rides.length; i++) {
        current.push(rides[i]);
        combine(i + 1, current);
        current.pop();
      }
    }
    
    combine(0, []);
    return combinations;
  }

  /**
   * Validate if group can be pooled together
   */
  validateGroup(group) {
    let totalSeats = 0;
    let totalLuggage = 0;

    for (const ride of group) {
      totalSeats += ride.passengers;
      totalLuggage += ride.luggage;
    }

    const isValid = totalSeats <= this.MAX_POOL_SEATS && 
                    totalLuggage <= this.MAX_POOL_LUGGAGE;

    return {
      isValid,
      totalSeats,
      totalLuggage
    };
  }

  /**
   * Optimize route using Nearest Neighbor TSP approximation for Dropoffs
   * (Since everyone starts at the same airport)
   */
  optimizeRoute(group) {
    try {
      if (group.length <= 1) {
        return { isValid: true, routeOrder: group, totalDeviation: 0 };
      }

      // Everyone starts at the airport (pickup.coordinates is the same for all)
      let currentLocation = group[0].pickup.coordinates;
      const unvisited = [...group];
      const routeOrder = [];
      let totalDeviation = 0;
      let accumulatedTime = 0; // Time spent travelling from airport to current node

      // Greedily pick nearest unvisited destination
      while (unvisited.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const distance = calculateDistance(currentLocation, unvisited[i].destination.coordinates);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }

        const nextRide = unvisited.splice(nearestIndex, 1)[0];
        routeOrder.push(nextRide);
        
        // Calculate the actual dropoff time for this passenger
        const legDistance = nearestDistance;
        const legTime = estimateTravelTime(legDistance);
        accumulatedTime += legTime;
        
        // Direct time if they traveled alone from airport to destination
        const directDistance = calculateDistance(nextRide.pickup.coordinates, nextRide.destination.coordinates);
        const directTime = estimateTravelTime(directDistance);
        
        const deviation = Math.max(0, accumulatedTime - directTime);
        
        // Check if deviation exceeds tolerance
        if (deviation > nextRide.detourTolerance) {
          return { isValid: false, reason: 'Detour exceeds tolerance' };
        }
        
        totalDeviation += deviation;
        currentLocation = nextRide.destination.coordinates;
      }

      return {
        isValid: true,
        routeOrder,
        totalDeviation: Math.round(totalDeviation)
      };
    } catch (error) {
      logger.error('Error optimizing route:', error);
      return { isValid: false, reason: 'Route optimization failed' };
    }
  }

  /**
   * Calculate score for group (lower is better)
   */
  calculateGroupScore(group, routeOptimization) {
    // Primary factor: total deviation
    let score = routeOptimization.totalDeviation;
    
    // Secondary factor: group size (prefer larger groups)
    score += (this.MAX_POOL_SEATS - group.length) * 10;
    
    // Tertiary factor: time spread (prefer tighter time windows)
    const timeSpread = this.calculateTimeSpread(group);
    score += timeSpread * 0.5;
    
    return Math.round(score);
  }

  /**
   * Calculate time spread in minutes
   */
  calculateTimeSpread(group) {
    if (group.length <= 1) return 0;
    
    const times = group.map(ride => new Date(ride.scheduledTime).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return Math.round((maxTime - minTime) / (1000 * 60)); // Convert to minutes
  }

  /**
   * Create pool in database
   */
  async createPool(groupData, airportCode) {
    try {
      const pool = new Pool({
        airportCode,
        rides: groupData.rides.map(ride => ride._id),
        totalSeats: groupData.totalSeats,
        totalLuggage: groupData.totalLuggage,
        routeOrder: groupData.routeOrder.map(ride => ride._id),
        totalDeviation: groupData.totalDeviation,
        status: 'forming'
      });

      await pool.save();

      // Update rides to mark as matched
      await Ride.updateMany(
        { _id: { $in: groupData.rides.map(ride => ride._id) } },
        { 
          status: 'matched',
          poolId: pool._id,
          $inc: { __v: 1 } // Increment version for optimistic concurrency
        }
      );

      logger.info(`Created pool ${pool._id} for ${airportCode} with ${groupData.rides.length} rides`);
      
      return pool;
    } catch (error) {
      logger.error('Error creating pool:', error);
      return null;
    }
  }

  /**
   * Get pool matching statistics
   */
  async getMatchingStats() {
    try {
      const stats = await Pool.aggregate([
        {
          $group: {
            _id: '$airportCode',
            totalPools: { $sum: 1 },
            avgRidesPerPool: { $avg: { $size: '$rides' } },
            avgDeviation: { $avg: '$totalDeviation' },
            activePools: {
              $sum: {
                $cond: [{ $in: ['$status', ['forming', 'locked', 'assigned']] }, 1, 0]
              }
            }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error('Error getting matching stats:', error);
      return [];
    }
  }
}

module.exports = PoolMatcher;

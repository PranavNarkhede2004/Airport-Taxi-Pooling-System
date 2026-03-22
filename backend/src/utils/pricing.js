const logger = require('./logger');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Array} coord1 - [longitude, latitude] 
 * @param {Array} coord2 - [longitude, latitude]
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Estimate travel time based on distance and average speed
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} - Estimated time in minutes
 */
function estimateTravelTime(distanceKm) {
  // Average speed in city traffic: 30 km/h
  const averageSpeed = 30; // km/h
  return Math.round((distanceKm / averageSpeed) * 60); // Convert to minutes
}

/**
 * Calculate base fare
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} estimatedMinutes - Estimated travel time in minutes
 * @returns {number} - Base fare
 */
function calculateBaseFare(distanceKm, estimatedMinutes) {
  const BASE_RATE = parseFloat(process.env.BASE_RATE) || 12; // ₹12 per km
  const PER_MINUTE_RATE = parseFloat(process.env.PER_MINUTE_RATE) || 2; // ₹2 per minute
  
  return Math.round(BASE_RATE * distanceKm + PER_MINUTE_RATE * estimatedMinutes);
}

/**
 * Calculate surge multiplier based on demand and available drivers
 * @param {number} pendingRides - Number of pending rides
 * @param {number} availableDrivers - Number of available drivers
 * @param {number} manualMultiplier - Manual override multiplier (optional)
 * @param {boolean} isManualOverride - Whether manual override is active
 * @returns {number} - Surge multiplier (1.0 to 5.0)
 */
function calculateSurgeMultiplier(pendingRides, availableDrivers, manualMultiplier = 1.0, isManualOverride = false) {
  if (isManualOverride) {
    return Math.min(5.0, Math.max(1.0, manualMultiplier));
  }

  let demand = 0;
  if (availableDrivers > 0) {
    demand = pendingRides / availableDrivers;
  } else if (pendingRides > 0) {
    demand = 5.0; // Max surge when no drivers available
  }

  let multiplier = 1.0;
  
  if (demand < 1.0) {
    multiplier = 1.0;
  } else if (demand >= 1.0 && demand <= 2.0) {
    multiplier = 1.0 + (demand - 1.0) * 0.5;
  } else {
    multiplier = Math.min(2.5, 1.5 + (demand - 2.0) * 0.3);
  }

  return Math.round(multiplier * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate luggage fee
 * @param {number} luggageCount - Number of luggage pieces
 * @returns {number} - Luggage fee
 */
function calculateLuggageFee(luggageCount) {
  const LUGGAGE_FEE_PER_BAG = 30; // ₹30 per bag
  return luggageCount * LUGGAGE_FEE_PER_BAG;
}

/**
 * Calculate pool discount
 * @param {boolean} isPool - Whether this is a pooled ride
 * @param {number} baseFare - Base fare amount
 * @returns {number} - Pool discount amount
 */
function calculatePoolDiscount(isPool, baseFare) {
  if (!isPool) return 0;
  
  const POOL_DISCOUNT_PERCENTAGE = 0.20; // 20% discount for pooling
  return Math.round(baseFare * POOL_DISCOUNT_PERCENTAGE);
}

/**
 * Calculate total ride pricing
 * @param {Object} params - Pricing parameters
 * @param {Array} params.pickup - Pickup coordinates [lng, lat]
 * @param {Array} params.destination - Destination coordinates [lng, lat]
 * @param {number} params.luggage - Number of luggage pieces
 * @param {boolean} params.isPool - Whether this is a pooled ride
 * @param {number} params.surgeMultiplier - Surge multiplier (optional)
 * @param {boolean} params.isManualOverride - Whether manual surge override is active
 * @returns {Object} - Complete pricing breakdown
 */
function calculateRidePricing({
  pickup,
  destination,
  luggage,
  isPool = true,
  surgeMultiplier = 1.0,
  isManualOverride = false
}) {
  try {
    // Calculate distance
    const distanceKm = calculateDistance(pickup, destination);
    
    // Estimate travel time
    const estimatedMinutes = estimateTravelTime(distanceKm);
    
    // Calculate base fare
    const baseFare = calculateBaseFare(distanceKm, estimatedMinutes);
    
    // Calculate luggage fee
    const luggageFee = calculateLuggageFee(luggage);
    
    // Calculate pool discount
    const poolDiscount = calculatePoolDiscount(isPool, baseFare);
    
    // Calculate total before surge
    const subtotal = baseFare + luggageFee - poolDiscount;
    
    // Apply surge multiplier
    const finalMultiplier = Math.min(5.0, Math.max(1.0, surgeMultiplier));
    const total = Math.round(subtotal * finalMultiplier);
    
    // Ensure minimum fare
    const MINIMUM_FARE = 50; // ₹50 minimum fare
    const finalTotal = Math.max(total, MINIMUM_FARE);
    
    return {
      distanceKm: Math.round(distanceKm * 10) / 10, // Round to 1 decimal place
      estimatedMinutes,
      baseFare,
      surgeMultiplier: finalMultiplier,
      luggageFee,
      poolDiscount,
      subtotal,
      total: finalTotal,
      minimumFeeApplied: finalTotal > total ? MINIMUM_FARE : 0
    };
  } catch (error) {
    logger.error('Error calculating ride pricing:', error);
    throw new Error('Failed to calculate pricing');
  }
}

/**
 * Get pricing estimate without saving to database
 * @param {Object} rideData - Ride request data
 * @param {Object} surgeConfig - Surge configuration for the airport
 * @returns {Object} - Pricing estimate
 */
async function getPricingEstimate(rideData, surgeConfig) {
  const {
    pickup,
    destination,
    luggage,
    isPool = true
  } = rideData;

  const surgeMultiplier = surgeConfig ? surgeConfig.multiplier : 1.0;
  const isManualOverride = surgeConfig ? surgeConfig.isManualOverride : false;

  return calculateRidePricing({
    pickup: pickup.coordinates,
    destination: destination.coordinates,
    luggage,
    isPool,
    surgeMultiplier,
    isManualOverride
  });
}

/**
 * Validate pricing parameters
 * @param {Object} params - Pricing parameters
 * @returns {boolean} - True if valid
 */
function validatePricingParams(params) {
  const required = ['pickup', 'destination', 'luggage'];
  for (const field of required) {
    if (params[field] === undefined || params[field] === null) {
      return false;
    }
  }

  // Validate coordinates
  if (!Array.isArray(params.pickup) || params.pickup.length !== 2 ||
      !Array.isArray(params.destination) || params.destination.length !== 2) {
    return false;
  }

  // Validate luggage count
  if (typeof params.luggage !== 'number' || params.luggage < 0 || params.luggage > 5) {
    return false;
  }

  return true;
}

module.exports = {
  calculateDistance,
  estimateTravelTime,
  calculateBaseFare,
  calculateSurgeMultiplier,
  calculateLuggageFee,
  calculatePoolDiscount,
  calculateRidePricing,
  getPricingEstimate,
  validatePricingParams
};

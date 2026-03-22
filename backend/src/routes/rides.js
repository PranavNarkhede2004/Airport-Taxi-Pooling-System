const express = require('express');
const router = express.Router();

const rideController = require('../controllers/rideController');
const { authenticateJWT, authorizeRole, optionalAuth } = require('../middlewares/auth');
const { validateRequest, schemas, validateObjectId } = require('../middlewares/validation');
const { 
  rideBookingLimiter, 
  rideCancellationLimiter,
  estimateLimiter,
  globalLimiter 
} = require('../middlewares/rateLimit');

/**
 * @swagger
 * components:
 *   schemas:
 *     Ride:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         pickup:
 *           type: object
 *           properties:
 *             address:
 *               type: string
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *         destination:
 *           type: object
 *           properties:
 *             airportCode:
 *               type: string
 *             name:
 *               type: string
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *         flightNumber:
 *           type: string
 *         scheduledTime:
 *           type: string
 *           format: date-time
 *         passengers:
 *           type: integer
 *           minimum: 1
 *           maximum: 6
 *         luggage:
 *           type: integer
 *           minimum: 0
 *           maximum: 5
 *         status:
 *           type: string
 *           enum: [requested, matched, assigned, in_progress, completed, cancelled]
 *         pricing:
 *           type: object
 *           properties:
 *             baseFare:
 *               type: number
 *             surgeMultiplier:
 *               type: number
 *             luggageFee:
 *               type: number
 *             poolDiscount:
 *               type: number
 *             total:
 *               type: number
 *         isPool:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
     
 *     RideRequest:
 *       type: object
 *       required:
 *         - pickup
 *         - destination
 *         - flightNumber
 *         - scheduledTime
 *         - passengers
 *         - luggage
 *       properties:
 *         pickup:
 *           type: object
 *           required:
 *             - address
 *             - coordinates
 *           properties:
 *             address:
 *               type: string
 *               maxLength: 200
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               minItems: 2
 *               maxItems: 2
 *         destination:
 *           type: object
 *           required:
 *             - airportCode
 *             - name
 *             - coordinates
 *           properties:
 *             airportCode:
 *               type: string
 *               enum: [BOM, DEL, BLR, HYD, MAA]
 *             name:
 *               type: string
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               minItems: 2
 *               maxItems: 2
 *         flightNumber:
 *           type: string
 *           pattern: '^[A-Z]{2}\d{3,4}$'
 *         scheduledTime:
 *           type: string
 *           format: date-time
 *         passengers:
 *           type: integer
 *           minimum: 1
 *           maximum: 6
 *         luggage:
 *           type: integer
 *           minimum: 0
 *           maximum: 5
 *         isPool:
 *           type: boolean
 *           default: true
 *         detourTolerance:
 *           type: integer
 *           minimum: 0
 *           maximum: 60
 *           default: 15
 *         specialRequests:
 *           type: string
 *           maxLength: 500
 */

/**
 * @swagger
 * /api/rides/request:
 *   post:
 *     summary: Create a new ride request
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RideRequest'
 *     responses:
 *       201:
 *         description: Ride request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     ride:
 *                       $ref: '#/components/schemas/Ride'
 *                     pricing:
 *                       type: object
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Too many ride requests
 */
router.post('/request',
  authenticateJWT,
  rideBookingLimiter,
  validateRequest(schemas.rideRequest),
  rideController.createRide
);

/**
 * @swagger
 * /api/rides/estimate:
 *   post:
 *     summary: Get price estimate without creating a ride
 *     tags: [Rides]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickup
 *               - destination
 *               - passengers
 *               - luggage
 *             properties:
 *               pickup:
 *                 type: object
 *                 required:
 *                   - address
 *                   - coordinates
 *               destination:
 *                 type: object
 *                 required:
 *                   - airportCode
 *                   - name
 *                   - coordinates
 *               passengers:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 6
 *               luggage:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 5
 *               isPool:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Price estimate calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     estimate:
 *                       type: object
 *                     surge:
 *                       type: object
 *       429:
 *         description: Too many estimate requests
 */
router.post('/estimate',
  optionalAuth,
  estimateLimiter,
  validateRequest(schemas.rideEstimate),
  rideController.getEstimate
);

/**
 * @swagger
 * /api/rides/history:
 *   get:
 *     summary: Get ride history for current user
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, matched, assigned, in_progress, completed, cancelled]
 *       - in: query
 *         name: airportCode
 *         schema:
 *           type: string
 *           enum: [BOM, DEL, BLR, HYD, MAA]
 *     responses:
 *       200:
 *         description: Ride history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     rides:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ride'
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Authentication required
 */
router.get('/history',
  authenticateJWT,
  rideController.getRideHistory
);

/**
 * @swagger
 * /api/rides/active:
 *   get:
 *     summary: Get active rides for current user
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active rides retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/active',
  authenticateJWT,
  rideController.getActiveRides
);

/**
 * @swagger
 * /api/rides/nearby:
 *   get:
 *     summary: Get nearby rides (for drivers)
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: airportCode
 *         required: true
 *         schema:
 *           type: string
 *           enum: [BOM, DEL, BLR, HYD, MAA]
 *       - in: query
 *         name: maxDistance
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Nearby rides retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/nearby',
  authenticateJWT,
  authorizeRole('driver', 'admin'),
  rideController.getNearbyRides
);

/**
 * @swagger
 * /api/rides/{id}:
 *   get:
 *     summary: Get single ride by ID
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ride retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ride:
 *                       $ref: '#/components/schemas/Ride'
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Ride not found
 */
router.get('/:id',
  authenticateJWT,
  validateObjectId('id'),
  rideController.getRideById
);

/**
 * @swagger
 * /api/rides/{id}/cancel:
 *   delete:
 *     summary: Cancel a ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Ride cancelled successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Ride cannot be cancelled
 *       404:
 *         description: Ride not found
 *       429:
 *         description: Too many cancellation attempts
 */
router.delete('/:id/cancel',
  authenticateJWT,
  rideCancellationLimiter,
  validateObjectId('id'),
  validateRequest(schemas.rideCancellation),
  rideController.cancelRide
);

/**
 * @swagger
 * /api/rides/{id}/status:
 *   put:
 *     summary: Update ride status (driver/system use)
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [requested, matched, assigned, in_progress, completed, cancelled]
 *               driverId:
 *                 type: string
 *               actualPickupTime:
 *                 type: string
 *                 format: date-time
 *               actualDropoffTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Ride status updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Ride not found
 */
router.put('/:id/status',
  authenticateJWT,
  authorizeRole('admin', 'driver'),
  validateObjectId('id'),
  rideController.updateRideStatus
);

/**
 * @swagger
 * /api/rides/{id}/assign-driver:
 *   put:
 *     summary: Assign driver to ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - driverId
 *             properties:
 *               driverId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Driver assigned successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Ride not found
 */
router.put('/:id/assign-driver',
  authenticateJWT,
  authorizeRole('admin'),
  validateObjectId('id'),
  rideController.assignDriver
);

// Admin-only routes
router.use('/admin', authenticateJWT, authorizeRole('admin'));

/**
 * @swagger
 * /api/rides/admin/stats:
 *   get:
 *     summary: Get ride statistics (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: airportCode
 *         schema:
 *           type: string
 *           enum: [BOM, DEL, BLR, HYD, MAA]
 *     responses:
 *       200:
 *         description: Ride statistics retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/admin/stats',
  globalLimiter,
  rideController.getRideStats
);

/**
 * @swagger
 * /api/rides/admin/list:
 *   get:
 *     summary: Get rides by status (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, matched, assigned, in_progress, completed, cancelled]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: airportCode
 *         schema:
 *           type: string
 *           enum: [BOM, DEL, BLR, HYD, MAA]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Rides retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/admin/list',
  validateRequest(schemas.rideFilters),
  rideController.getRidesByStatus
);

module.exports = router;

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { authenticateJWT, authorizeRole } = require('../middlewares/auth');
const { validateRequest, schemas, validateObjectId } = require('../middlewares/validation');
const { 
  adminLimiter, 
  driverLimiter, 
  surgeLimiter,
  globalLimiter 
} = require('../middlewares/rateLimit');

// All admin routes require authentication and admin role
router.use(authenticateJWT, authorizeRole('admin'));

/**
 * @swagger
 * components:
 *   schemas:
 *     Pool:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         airportCode:
 *           type: string
 *         rides:
 *           type: array
 *           items:
 *             type: string
 *         driverId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [forming, locked, assigned, completed]
 *         totalSeats:
 *           type: integer
 *         totalLuggage:
 *           type: integer
 *         routeOrder:
 *           type: array
 *           items:
 *             type: string
 *         totalDeviation:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     Driver:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         phone:
 *           type: string
 *         vehicle:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *             plate:
 *               type: string
 *             maxSeats:
 *               type: integer
 *             maxLuggage:
 *               type: integer
 *             make:
 *               type: string
 *             model:
 *               type: string
 *             color:
 *               type: string
 *             year:
 *               type: integer
 *         status:
 *           type: string
 *           enum: [available, busy, offline]
 *         rating:
 *           type: number
 *         totalTrips:
 *           type: integer
 *         verified:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     SurgeConfig:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         airportCode:
 *           type: string
 *         multiplier:
 *           type: number
 *         isManualOverride:
 *           type: boolean
 *         autoSurgeEnabled:
 *           type: boolean
 *         demandThreshold:
 *           type: number
 *         lastCalculatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/admin/pools:
 *   get:
 *     summary: List all active pools
 *     tags: [Admin]
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
 *         name: airportCode
 *         schema:
 *           type: string
 *           enum: [BOM, DEL, BLR, HYD, MAA]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [forming, locked, assigned]
 *     responses:
 *       200:
 *         description: Active pools retrieved successfully
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
 *                     pools:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Pool'
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/pools',
  adminLimiter,
  adminController.getActivePools
);

/**
 * @swagger
 * /api/admin/pools/{id}:
 *   get:
 *     summary: Get pool detail with all passenger info
 *     tags: [Admin]
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
 *         description: Pool details retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Pool not found
 */
router.get('/pools/:id',
  validateObjectId('id'),
  adminController.getPoolDetails
);

/**
 * @swagger
 * /api/admin/rides:
 *   get:
 *     summary: Get all rides with filters
 *     tags: [Admin]
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
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isPool
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Rides retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/rides',
  adminLimiter,
  validateRequest(schemas.rideFilters),
  adminController.getAllRides
);

/**
 * @swagger
 * /api/admin/rides/{id}/cancel:
 *   delete:
 *     summary: Force cancel any ride
 *     tags: [Admin]
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
 *               adminNote:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Ride force cancelled successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Ride not found
 */
router.delete('/rides/:id/cancel',
  validateObjectId('id'),
  adminController.forceCancelRide
);

/**
 * @swagger
 * /api/admin/analytics:
 *   get:
 *     summary: Get KPIs and analytics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
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
 *                     kpis:
 *                       type: object
 *                     charts:
 *                       type: object
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/analytics',
  globalLimiter,
  adminController.getAnalytics
);

/**
 * @swagger
 * /api/admin/surge:
 *   get:
 *     summary: Get surge config for all airports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Surge configurations retrieved successfully
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
 *                     surgeConfigs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SurgeConfig'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/surge',
  globalLimiter,
  adminController.getSurgeConfigs
);

/**
 * @swagger
 * /api/admin/surge/{airportCode}:
 *   put:
 *     summary: Update surge multiplier / toggle manual override
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: airportCode
 *         required: true
 *         schema:
 *           type: string
 *           enum: [BOM, DEL, BLR, HYD, MAA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - multiplier
 *               - isManualOverride
 *             properties:
 *               multiplier:
 *                 type: number
 *                 minimum: 1.0
 *                 maximum: 5.0
 *               isManualOverride:
 *                 type: boolean
 *               autoSurgeEnabled:
 *                 type: boolean
 *               updateReason:
 *                 type: string
 *                 maxLength: 200
 *     responses:
 *       200:
 *         description: Surge configuration updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Surge configuration not found
 */
router.put('/surge/:airportCode',
  surgeLimiter,
  validateRequest(schemas.surgeConfigUpdate),
  adminController.updateSurgeConfig
);

/**
 * @swagger
 * /api/admin/drivers:
 *   get:
 *     summary: List all drivers
 *     tags: [Admin]
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
 *           enum: [available, busy, offline]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Drivers retrieved successfully
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
 *                     drivers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Driver'
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/drivers',
  driverLimiter,
  adminController.getAllDrivers
);

/**
 * @swagger
 * /api/admin/drivers:
 *   post:
 *     summary: Add new driver
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Driver'
 *     responses:
 *       201:
 *         description: Driver added successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       400:
 *         description: Validation error or phone already exists
 */
router.post('/drivers',
  driverLimiter,
  validateRequest(schemas.driverCreate),
  adminController.addDriver
);

/**
 * @swagger
 * /api/admin/drivers/{driverId}/status:
 *   put:
 *     summary: Update driver status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [available, busy, offline]
 *     responses:
 *       200:
 *         description: Driver status updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Driver not found
 */
router.put('/drivers/:driverId/status',
  driverLimiter,
  validateObjectId('driverId'),
  validateRequest(schemas.driverStatusUpdate),
  adminController.updateDriverStatus
);

/**
 * @swagger
 * /api/admin/drivers/stats:
 *   get:
 *     summary: Get driver statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Driver statistics retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/drivers/stats',
  globalLimiter,
  adminController.getDriverStats
);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get dashboard overview
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
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
 *                     overview:
 *                       type: object
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/dashboard',
  globalLimiter,
  adminController.getDashboardOverview
);

module.exports = router;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Import configurations
const connectDB = require('./config/database');
const redisClient = require('./config/redis');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const adminRoutes = require('./routes/admin');

// Import middleware
const { errorHandler, notFoundHandler, requestLogger } = require('./middlewares/errorHandler');
const { globalLimiter } = require('./middlewares/rateLimit');

// Create Express app
const app = express();

// Basic middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting
app.use(globalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Airport Pooling System API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/admin', adminRoutes);

// Swagger documentation setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Airport Ride Pooling System API',
      version: '1.0.0',
      description: 'A comprehensive API for airport ride pooling with real-time matching and dynamic pricing',
      contact: {
        name: 'API Support',
        email: 'support@airportpooling.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Rides',
        description: 'Ride booking and management'
      },
      {
        name: 'Admin',
        description: 'Administrative operations'
      }
    ]
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Airport Pooling API Documentation'
}));

// Swagger JSON route
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Airport Ride Pooling System API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      rides: '/api/rides',
      admin: '/api/admin'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

/**
 * Start server function
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('Database connected successfully');

    // Connect to Redis (optional for development)
    try {
      await redisClient.connect();
      logger.info('Redis connected successfully');
    } catch (redisError) {
      logger.warn('Redis connection failed, continuing without Redis:', redisError.message);
    }

    // Start HTTP server
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
    });

    // Setup Socket.io
    const { Server } = require('socket.io');
    const SocketHandler = require('./sockets/socketHandler');
    
    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Initialize socket handler
    const socketHandler = new SocketHandler(io);
    
    // Make socket handler available globally
    global.socketHandler = socketHandler;

    logger.info('Socket.io server initialized');

    // Initialize Bull queue jobs (optional for development)
    try {
      const poolMatchingQueue = require('./jobs/poolMatchingJob');
      await poolMatchingQueue.initialize();
      
      // Schedule recurring jobs
      await poolMatchingQueue.addRecurringPoolMatchingJob();
      await poolMatchingQueue.addRecurringSurgeJobs();
      await poolMatchingQueue.addRecurringDriverCheckJobs();
      
      logger.info('Bull queue jobs initialized and scheduled');
    } catch (queueError) {
      logger.warn('Bull queue initialization failed, continuing without queue:', queueError.message);
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close Redis connection
        await redisClient.disconnect();
        logger.info('Redis connection closed');
        
        // Close Bull queue
        const poolMatchingQueue = require('./jobs/poolMatchingJob');
        await poolMatchingQueue.closeQueue();
        logger.info('Bull queue closed');
        
        // Close MongoDB connection
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

require('dotenv').config();
console.log('Environment variables loaded:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✓' : '✗');
console.log('REDIS_URL:', process.env.REDIS_URL ? '✓' : '✗');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✓' : '✗');

try {
  console.log('\nTesting database connection...');
  const connectDB = require('./src/config/database');
  console.log('Database module loaded');
  
  console.log('\nTesting Redis connection...');
  const redisClient = require('./src/config/redis');
  console.log('Redis module loaded');
  
  console.log('\nTesting app initialization...');
  const { app } = require('./src/app');
  console.log('App initialized successfully');
  
  console.log('\n✓ All modules loaded successfully');
  console.log('You can now start the server with: npm start');
} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error('Stack:', error.stack);
}

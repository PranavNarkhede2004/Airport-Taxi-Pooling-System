require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const SurgeConfig = require('../src/models/SurgeConfig');
const Ride = require('../src/models/Ride');
const Pool = require('../src/models/Pool');
const logger = require('../src/utils/logger');

/**
 * Database Setup Script
 * Creates indexes, seeds initial data, and sets up the system
 */
class DatabaseSetup {
  constructor() {
    this.mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/airport_pooling';
  }

  async connect() {
    try {
      await mongoose.connect(this.mongodbUri);
      logger.info('Connected to MongoDB for setup');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      process.exit(1);
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }

  async createIndexes() {
    logger.info('Creating database indexes...');

    try {
      // User indexes
      await User.collection.createIndex({ email: 1 }, { unique: true });
      await User.collection.createIndex({ role: 1 });
      await User.collection.createIndex({ createdAt: -1 });

      // Ride indexes
      await Ride.collection.createIndex({ userId: 1, status: 1 });
      await Ride.collection.createIndex({ userId: 1, createdAt: -1 });
      await Ride.collection.createIndex({ status: 1, scheduledTime: 1 });
      await Ride.collection.createIndex({ 'destination.airportCode': 1, status: 1 });
      await Ride.collection.createIndex({ poolId: 1 });
      await Ride.collection.createIndex({ isPool: 1, status: 1, scheduledTime: 1 });

      // Pool indexes
      await Pool.collection.createIndex({ airportCode: 1, status: 1 });
      await Pool.collection.createIndex({ status: 1, createdAt: -1 });
      await Pool.collection.createIndex({ createdAt: -1 });
      await Pool.collection.createIndex({ driverId: 1 });

      // Driver indexes
      await Driver.collection.createIndex({ phone: 1 }, { unique: true });
      await Driver.collection.createIndex({ status: 1 });
      await Driver.collection.createIndex({ currentPoolId: 1 });
      await Driver.collection.createIndex({ rating: -1 });
      await Driver.collection.createIndex({ verified: 1 });
      await Driver.collection.createIndex({ lastActiveAt: -1 });

      // SurgeConfig indexes
      await SurgeConfig.collection.createIndex({ airportCode: 1 }, { unique: true });
      await SurgeConfig.collection.createIndex({ multiplier: -1 });
      await SurgeConfig.collection.createIndex({ autoSurgeEnabled: 1 });
      await SurgeConfig.collection.createIndex({ lastCalculatedAt: -1 });

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Error creating indexes:', error);
      throw error;
    }
  }

  async seedAirports() {
    logger.info('Seeding airport surge configurations...');

    const airports = [
      {
        airportCode: 'BOM',
        name: 'Chhatrapati Shivaji Maharaj International Airport',
        coordinates: [72.8679, 19.0896],
        city: 'Mumbai'
      },
      {
        airportCode: 'DEL',
        name: 'Indira Gandhi International Airport',
        coordinates: [77.1025, 28.5562],
        city: 'Delhi'
      },
      {
        airportCode: 'BLR',
        name: 'Kempegowda International Airport',
        coordinates: [77.6611, 13.1986],
        city: 'Bangalore'
      },
      {
        airportCode: 'HYD',
        name: 'Rajiv Gandhi International Airport',
        coordinates: [78.4299, 17.2313],
        city: 'Hyderabad'
      },
      {
        airportCode: 'MAA',
        name: 'Chennai International Airport',
        coordinates: [80.1825, 12.9941],
        city: 'Chennai'
      }
    ];

    try {
      await SurgeConfig.initializeDefaults();
      logger.info('Airport surge configurations seeded successfully');
    } catch (error) {
      logger.error('Error seeding airports:', error);
      throw error;
    }
  }

  async seedAdminUser() {
    logger.info('Creating admin user...');

    try {
      const existingAdmin = await User.findOne({ email: 'admin@airport.com' });
      if (existingAdmin) {
        logger.info('Admin user already exists');
        return;
      }

      const adminUser = new User({
        name: 'System Administrator',
        email: 'admin@airport.com',
        password: 'Admin@123',
        phone: '9876543210',
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
      logger.info('Admin user created successfully (admin@airport.com / Admin@123)');
    } catch (error) {
      logger.error('Error creating admin user:', error);
      throw error;
    }
  }

  async seedDrivers() {
    logger.info('Seeding sample drivers...');

    try {
      const drivers = [
        {
          name: 'Raj Kumar',
          phone: '9876543211',
          vehicle: {
            type: 'sedan',
            plate: 'MH12AB1234',
            maxSeats: 4,
            maxLuggage: 3,
            make: 'Toyota',
            model: 'Etios',
            color: 'White',
            year: 2020
          },
          licenseNumber: 'MH0112345678901',
          licenseExpiry: new Date('2027-12-31'),
          verified: true,
          status: 'available',
          documents: {
            insurance: 'valid',
            vehicleRC: 'valid',
            licenseFront: 'valid',
            licenseBack: 'valid'
          },
          currentLocation: [72.8777, 19.0760]
        },
        {
          name: 'Amit Singh',
          phone: '9876543212',
          vehicle: {
            type: 'suv',
            plate: 'DL02CD5678',
            maxSeats: 6,
            maxLuggage: 4,
            make: 'Mahindra',
            model: 'XUV500',
            color: 'Black',
            year: 2021
          },
          licenseNumber: 'DL0212345678901',
          licenseExpiry: new Date('2028-06-30'),
          verified: true,
          status: 'available',
          documents: {
            insurance: 'valid',
            vehicleRC: 'valid',
            licenseFront: 'valid',
            licenseBack: 'valid'
          },
          currentLocation: [77.1025, 28.5562]
        },
        {
          name: 'Priya Sharma',
          phone: '9876543213',
          vehicle: {
            type: 'hatchback',
            plate: 'KA03EF9012',
            maxSeats: 4,
            maxLuggage: 2,
            make: 'Maruti',
            model: 'Swift',
            color: 'Red',
            year: 2022
          },
          licenseNumber: 'KA0312345678901',
          licenseExpiry: new Date('2029-03-15'),
          verified: true,
          status: 'available',
          documents: {
            insurance: 'valid',
            vehicleRC: 'valid',
            licenseFront: 'valid',
            licenseBack: 'valid'
          },
          currentLocation: [77.6611, 13.1986]
        }
      ];

      for (const driverData of drivers) {
        const existingDriver = await Driver.findOne({ phone: driverData.phone });
        if (!existingDriver) {
          const driver = new Driver(driverData);
          await driver.save();
        }
      }

      logger.info('Sample drivers seeded successfully');
    } catch (error) {
      logger.error('Error seeding drivers:', error);
      throw error;
    }
  }

  async seedSampleRides() {
    logger.info('Seeding sample ride requests...');

    try {
      const passengers = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '9876543214',
          password: 'Passenger@123',
          role: 'passenger'
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '9876543215',
          password: 'Passenger@123',
          role: 'passenger'
        }
      ];

      // Create sample passengers if they don't exist
      const createdPassengers = [];
      for (const passengerData of passengers) {
        let passenger = await User.findOne({ email: passengerData.email });
        if (!passenger) {
          passenger = new User(passengerData);
          await passenger.save();
        }
        createdPassengers.push(passenger);
      }

      // Sample ride data
      const sampleRides = [
        {
          userId: createdPassengers[0]._id,
          pickup: {
            address: 'Bandra West, Mumbai',
            coordinates: [72.8347, 19.0596]
          },
          destination: {
            airportCode: 'BOM',
            name: 'Chhatrapati Shivaji Maharaj International Airport',
            coordinates: [72.8679, 19.0896]
          },
          flightNumber: 'AI123',
          scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          passengers: 1,
          luggage: 2,
          isPool: true,
          detourTolerance: 15
        },
        {
          userId: createdPassengers[1]._id,
          pickup: {
            address: 'Andheri East, Mumbai',
            coordinates: [72.8697, 19.1196]
          },
          destination: {
            airportCode: 'BOM',
            name: 'Chhatrapati Shivaji Maharaj International Airport',
            coordinates: [72.8679, 19.0896]
          },
          flightNumber: 'AI456',
          scheduledTime: new Date(Date.now() + 2.5 * 60 * 60 * 1000), // 2.5 hours from now
          passengers: 2,
          luggage: 1,
          isPool: true,
          detourTolerance: 20
        }
      ];

      for (const rideData of sampleRides) {
        const existingRide = await Ride.findOne({
          userId: rideData.userId,
          flightNumber: rideData.flightNumber
        });
        
        if (!existingRide) {
          const ride = new Ride({
            ...rideData,
            pricing: {
              baseFare: 150,
              surgeMultiplier: 1.0,
              luggageFee: rideData.luggage * 30,
              poolDiscount: 30,
              total: 180 + (rideData.luggage * 30) - 30
            }
          });
          await ride.save();
        }
      }

      logger.info('Sample ride requests seeded successfully');
    } catch (error) {
      logger.error('Error seeding sample rides:', error);
      throw error;
    }
  }

  async seedSamplePools() {
    logger.info('Seeding sample pools...');

    try {
      // Find rides that can be pooled
      const poolableRides = await Ride.find({
        status: 'requested',
        isPool: true,
        'destination.airportCode': 'BOM'
      }).limit(2);

      if (poolableRides.length >= 2) {
        const pool = new Pool({
          airportCode: 'BOM',
          rides: poolableRides.map(ride => ride._id),
          totalSeats: poolableRides.reduce((sum, ride) => sum + ride.passengers, 0),
          totalLuggage: poolableRides.reduce((sum, ride) => sum + ride.luggage, 0),
          routeOrder: poolableRides.map(ride => ride._id),
          totalDeviation: 10,
          status: 'forming'
        });

        await pool.save();

        // Update rides to matched status
        await Ride.updateMany(
          { _id: { $in: poolableRides.map(ride => ride._id) } },
          { status: 'matched', poolId: pool._id }
        );

        logger.info('Sample pool created successfully');
      } else {
        logger.info('Not enough rides to create sample pool');
      }
    } catch (error) {
      logger.error('Error seeding sample pools:', error);
      throw error;
    }
  }

  async clearDatabase() {
    logger.warn('Clearing existing data...');
    
    try {
      await Promise.all([
        Ride.deleteMany({}),
        Pool.deleteMany({}),
        Driver.deleteMany({}),
        SurgeConfig.deleteMany({}),
        User.deleteMany({ role: { $ne: 'admin' } }) // Keep admin users
      ]);
      
      logger.info('Database cleared successfully');
    } catch (error) {
      logger.error('Error clearing database:', error);
      throw error;
    }
  }

  async runSetup(options = {}) {
    const {
      clear = false,
      indexes = true,
      seed = true,
      admin = true,
      drivers = true,
      rides = true,
      pools = true
    } = options;

    try {
      await this.connect();

      if (clear) {
        await this.clearDatabase();
      }

      if (indexes) {
        await this.createIndexes();
      }

      if (seed) {
        await this.seedAirports();
      }

      if (admin) {
        await this.seedAdminUser();
      }

      if (drivers) {
        await this.seedDrivers();
      }

      if (rides) {
        await this.seedSampleRides();
      }

      if (pools) {
        await this.seedSamplePools();
      }

      logger.info('Database setup completed successfully!');
      
      console.log('\n✅ Setup completed successfully!');
      console.log('\n📋 Summary:');
      console.log('   - Database indexes created');
      console.log('   - Airport surge configurations seeded');
      console.log('   - Admin user created (admin@airport.com / Admin@123)');
      console.log('   - Sample drivers added');
      console.log('   - Sample ride requests created');
      console.log('   - Sample pool created');
      console.log('\n🚀 You can now start the application with: npm run dev');

    } catch (error) {
      logger.error('Setup failed:', error);
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  const setup = new DatabaseSetup();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    clear: args.includes('--clear'),
    indexes: !args.includes('--no-indexes'),
    seed: !args.includes('--no-seed'),
    admin: !args.includes('--no-admin'),
    drivers: !args.includes('--no-drivers'),
    rides: !args.includes('--no-rides'),
    pools: !args.includes('--no-pools')
  };

  setup.runSetup(options);
}

module.exports = DatabaseSetup;

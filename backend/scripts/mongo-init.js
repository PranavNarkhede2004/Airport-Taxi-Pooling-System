// MongoDB initialization script for Docker
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('airport_pooling');

// Create application user
db.createUser({
  user: 'airport_pooling_user',
  pwd: 'airport_pooling_password',
  roles: [
    {
      role: 'readWrite',
      db: 'airport_pooling'
    }
  ]
});

// Create initial collections and indexes (optional - will be created by the setup script)
print('MongoDB initialization completed successfully!');

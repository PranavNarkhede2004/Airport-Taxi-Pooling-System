// Create a test passenger user
const axios = require('axios');

async function createTestUser() {
  try {
    console.log('Creating test passenger user...');
    
    const response = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Test Passenger',
      email: 'passenger@test.com',
      password: 'Passenger@123',
      phone: '9876543210',
      role: 'passenger'
    });
    
    console.log('✅ User created successfully!');
    console.log('Response:', response.data);
    console.log('Login credentials:');
    console.log('Email: passenger@test.com');
    console.log('Password: Passenger@123');
    
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log('✅ Test user already exists');
      console.log('Login credentials:');
      console.log('Email: passenger@test.com');
      console.log('Password: Passenger@123');
    } else {
      console.error('❌ User creation failed:', error.response?.data || error.message);
    }
  }
}

createTestUser();

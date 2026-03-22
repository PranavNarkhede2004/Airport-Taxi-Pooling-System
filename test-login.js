// Test login functionality
const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login with admin credentials...');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@airport.com',
      password: 'Admin@123'
    });
    
    console.log('✅ Login successful!');
    console.log('Response:', response.data);
    console.log('Token:', response.data.data.token);
    console.log('User:', response.data.data.user);
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
  }
}

testLogin();

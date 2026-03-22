const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../backend/.env' });

const driverId = '69be6261721ab23b0d7b682a';
const token = jwt.sign(
  { userId: driverId, role: 'driver', id: driverId },
  process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
  { expiresIn: '1h' }
);

console.log('Test Driver connecting...', token.slice(0, 15) + '...');
const socket = io('http://localhost:5000', {
  auth: { token },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Driver connected:', socket.id);
  // Send a test HTTP request to create a ride, mimicking the user
  setTimeout(createTestRide, 1000);
});

socket.on('ride:new-request', (data) => {
  console.log('\n\n!!! RECEIVED NEW RIDE REQUEST in TEST SCRIPT !!!');
  console.log(data);
  process.exit(0);
});

socket.on('connected', (data) => {
  console.log('Driver joined success:', data);
});

socket.on('error', (err) => {
  console.error('Socket Error:', err);
});

socket.on('disconnect', (reason) => {
  console.log('Driver disconnected:', reason);
});

async function createTestRide() {
  console.log('Triggering creating test ride API...');
  
  // Passenger token
  const passengerId = '69be5a840ee4624507def260';
  const pToken = jwt.sign({ userId: passengerId, role: 'passenger', id: passengerId }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', { expiresIn: '1h' });

  const scheduledTime = new Date();
  scheduledTime.setMinutes(scheduledTime.getMinutes() + 30);

  const res = await fetch('http://localhost:5000/api/rides/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pToken}`
    },
    body: JSON.stringify({
      pickup: { address: 'Test Address', coordinates: [72.8777, 19.0760] },
      destination: { airportCode: 'BOM', name: 'Mumbai Airport', coordinates: [72.8679, 19.0896] },
      flightNumber: 'AI123',
      scheduledTime: scheduledTime.toISOString(),
      passengers: 1,
      luggage: 1,
      isPool: true,
      detourTolerance: 15
    })
  });

  const json = await res.json();
  console.log('Test Ride creation status:', res.status, json.success ? 'Success' : json.message);
  
  setTimeout(() => {
    console.log('Timeout! No socket event received after 5 seconds.');
    process.exit(1);
  }, 5000);
}

# Smart Airport Ride Pooling System

A full-stack MERN application that groups passengers into shared cabs while optimizing routes and pricing with real-time updates.

## Tech Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis (for pooling queues, rate limiting, surge data)
- **Real-time**: Socket.io
- **Auth**: JWT (jsonwebtoken)
- **Validation**: Joi
- **Queue**: Bull (Redis-backed job queue for pool matching)
- **Docs**: Swagger/OpenAPI (swagger-ui-express)
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React.js (Vite)
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Real-time**: Socket.io-client
- **Server State**: TanStack React Query
- **Global State**: Zustand
- **Forms**: React Hook Form + Zod
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Notifications**: React Hot Toast
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

## Quick Start

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd smart-airport-pooling

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

2. **Start MongoDB and Redis**
```bash
docker-compose up -d
```

3. **Setup backend**
```bash
cd backend
npm run setup  # Creates indexes, seeds data
npm run dev    # Start backend server
```

4. **Start frontend**
```bash
cd frontend
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:5173
- API: http://localhost:5000
- Swagger Docs: http://localhost:5000/api-docs

## Test Credentials

- **Admin**: admin@airport.com / Admin@123
- **Passenger**: passenger@example.com / Passenger@123

## Project Structure

```
smart-airport-pooling/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, Redis, env config
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express routers
│   │   ├── controllers/     # Route handlers
│   │   ├── services/        # Business logic
│   │   ├── algorithms/      # Pooling + routing DSA
│   │   ├── middlewares/     # Auth, error, rate limit
│   │   ├── jobs/            # Bull queue workers
│   │   ├── sockets/         # Socket.io handlers
│   │   └── utils/           # Helpers, pricing formula
│   ├── tests/
│   ├── swagger.yaml
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client + API functions
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # One file per route
│   │   ├── store/           # Zustand stores
│   │   ├── hooks/           # Custom hooks
│   │   ├── utils/           # Formatters, validators
│   │   └── router/          # React Router config + guards
│   ├── .env.example
│   └── package.json
├── docker-compose.yml       # MongoDB + Redis containers
└── README.md
```

## Algorithm Complexity

| Operation | Complexity | Description |
|-----------|------------|-------------|
| Pool Matching | O(R²) | R = pending rides per airport |
| Route Optimization | O(n²) | n = pool size (≤6, so O(1) practical) |
| Price Calculation | O(1) | Simple arithmetic operations |
| Authentication | O(1) | JWT verification |

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (Express)     │◄──►│   (MongoDB)     │
│                 │    │                 │    │                 │
│ - Socket.io     │    │ - Socket.io     │    │ - Rides         │
│ - React Query   │    │ - Bull Queue    │    │ - Pools         │
│ - Zustand       │    │ - Redis Cache   │    │ - Users         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │                 │
                       │ - Rate Limiting │
                       │ - Queue Store   │
                       │ - Cache         │
                       └─────────────────┘
```

## Environment Variables

### Backend (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/airport_pooling
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
BASE_RATE=12
PER_MINUTE_RATE=2
POOL_MATCH_INTERVAL_MS=30000
MAX_POOL_SEATS=6
MAX_POOL_LUGGAGE=5
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Available Scripts

### Backend
- `npm run dev` - Start development server with nodemon
- `npm run start` - Start production server
- `npm run test` - Run Jest test suite
- `npm run setup` - Create indexes and seed data

### Frontend
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Features

### Core Functionality
- ✅ User authentication (JWT)
- ✅ Ride booking with pooling
- ✅ Real-time pool matching algorithm
- ✅ Dynamic surge pricing
- ✅ Live ride tracking
- ✅ Driver management
- ✅ Admin dashboard

### Technical Features
- ✅ Redis-based distributed locking
- ✅ Optimistic concurrency control
- ✅ Rate limiting
- ✅ Real-time Socket.io updates
- ✅ Mobile-responsive design
- ✅ API documentation (Swagger)

## API Documentation

Visit http://localhost:5000/api-docs for interactive API documentation.

## License

MIT License

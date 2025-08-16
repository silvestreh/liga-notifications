# Push Notifications API

A scalable push notification service built with Node.js, Express, MongoDB, and Redis. This service manages device tokens, handles push notifications via Apple Push Notification service (APNs), and provides a queue-based architecture for reliable message delivery.

## Features

- **Device Token Management**: Register and manage iOS/Android device tokens with tags and localization
- **Tag-Based Targeting**: Send notifications to devices based on custom tags
- **Multi-Language Support**: Localized push notifications with automatic locale-based targeting
- **Queue-Based Processing**: Reliable message delivery using Redis and BullMQ
- **Device Authentication**: JWT-based authentication for device-specific operations
- **API Key Authentication**: Secure admin endpoints for sending notifications
- **Health Monitoring**: Built-in health check endpoints

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database Configuration
MONGO_URL=mongodb://127.0.0.1:27017/pushdb
REDIS_URL=redis://localhost:6379

# Apple Push Notifications (APNs) Configuration
APN_KEY_CONTENT="<base64 representation of your .p8 AuthKey file>"
APN_KEY_ID=XXXXXXXXXX
APN_TEAM_ID=XXXXXXXXXX
APN_BUNDLE_ID=com.yourcompany.yourapp
APN_PRODUCTION=false

# API Security
API_KEY="your-secret-api-key-for-admin-operations"
DEVICE_SECRET="your-jwt-secret-for-device-authentication"

# Optional
NODE_ENV=development
```

## API Endpoints

### Public Endpoints

#### Register Device Token

**POST** `/register`

Register or update a device token with optional metadata.

```json
{
  "token": "device-push-token-from-client",
  "platform": "ios",
  "tags": ["sports", "premium"],
  "locale": "en"
}
```

**Response:**

```json
{
  "message": "Device token registered successfully",
  "token": {
    "id": "token-id",
    "platform": "ios",
    "tags": ["sports", "premium"],
    "locale": "en",
    "lastActive": "2024-01-01T00:00:00.000Z"
  },
  "authToken": "jwt-token-for-device-operations"
}
```

#### Health Check

**GET** `/health`

Returns comprehensive service health status including all dependencies.

**Response (Healthy):**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "services": {
    "mongodb": {
      "status": "healthy",
      "latency": 15
    },
    "redis": {
      "status": "healthy",
      "latency": 8
    },
    "queue": {
      "status": "healthy",
      "jobs": {
        "waiting": 0,
        "active": 2,
        "completed": 1250,
        "failed": 3
      }
    }
  }
}
```

**Response (Unhealthy):**
Returns HTTP 503 status code when any service is unhealthy.

### Device-Authenticated Endpoints

These endpoints require a device authentication token (JWT) obtained from the registration response.

**Authentication:** Include the JWT token in the request header:

- `X-Device-Auth: your-jwt-token`
- `Authorization: Bearer your-jwt-token`

#### Get Token Information

**GET** `/token/:tokenId`

Retrieve information about a specific device token.

**Response:**

```json
{
  "token": {
    "id": "token-id",
    "tokenPreview": "device-pus...",
    "platform": "ios",
    "tags": ["sports", "premium"],
    "locale": "en",
    "lastActive": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Update Token Tags

**PATCH** `/token`

Add or remove tags from the authenticated device token.

```json
{
  "tagsToAdd": ["news", "breaking"],
  "tagsToRemove": ["sports"]
}
```

**Response:**

```json
{
  "message": "Token tags updated successfully",
  "token": {
    "id": "token-id",
    "tags": ["premium", "news", "breaking"],
    "platform": "ios",
    "locale": "en",
    "lastActive": "2024-01-01T00:00:00.000Z"
  }
}
```

### Admin Endpoints

These endpoints require API key authentication for administrative operations.

**Authentication:** Include your API key in the request header:

- `X-API-Key: your-secret-api-key`
- `Authorization: Bearer your-secret-api-key`

#### Send Push Notification

**POST** `/send`

Send push notifications to devices matching the specified tags.

```json
{
  "tags": ["premium", "sports"],
  "localesContent": {
    "en": {
      "title": "New Update Available!",
      "text": "Check out the latest features in our app."
    },
    "es": {
      "title": "¡Nueva Actualización Disponible!",
      "text": "Descubre las últimas funciones de nuestra aplicación."
    },
    "fr": {
      "title": "Nouvelle mise à jour disponible !",
      "text": "Découvrez les dernières fonctionnalités de notre application."
    }
  }
}
```

**Response:**

```json
{
  "message": "Push notification jobs queued successfully",
  "totalUsers": 1250,
  "jobsAdded": 3,
  "locales": ["en", "es", "fr"]
}
```

## Authentication Types

### API Key Authentication

Used for administrative operations like sending push notifications. Include your API key in requests using either header format.

### Device Authentication

Used for device-specific operations like updating tags or retrieving token info. Devices receive a JWT token when registering, which must be included in subsequent requests.

## Development

### Prerequisites

- Node.js 18+
- MongoDB
- Redis

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Running the Service

The service consists of two components:

1. **API Server**: Handles HTTP requests
2. **Worker Process**: Processes push notification jobs from the queue

#### Start Both Services

```bash
npm start
```

#### Start Services Individually

```bash
# API server only
npm run start:api

# Worker process only
npm run start:worker
```

#### Development Mode

```bash
# Watch mode for API server
npm run dev

# Watch mode for worker
npm run dev:worker

# TypeScript watch mode
npm run dev:watch
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Architecture

- **Express.js**: REST API server
- **MongoDB**: Device token and metadata storage
- **Redis + BullMQ**: Job queue for reliable push notification delivery
- **JWT**: Device authentication tokens
- **APNs**: Apple Push Notification service integration

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side errors

All error responses include an `error` field with a descriptive message.

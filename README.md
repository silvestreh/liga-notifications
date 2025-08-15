# Push Notifications API Usage

## Environment Variables Required

```bash
# Database Configuration
MONGO_URL=mongodb://localhost:27017/push-notifications

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Apple Push Notifications (APNs) Configuration
APN_KEY_PATH=/path/to/your/AuthKey_XXXXXXXXXX.p8
APN_KEY_ID=XXXXXXXXXX
APN_TEAM_ID=XXXXXXXXXX
APN_BUNDLE_ID=com.yourcompany.yourapp

# API Security
API_KEY=your-secret-api-key-here

# Optional
NODE_ENV=development
```

## API Authentication

Include your API key in requests using either:

- Header: `X-API-Key: your-secret-api-key-here`
- Header: `Authorization: Bearer your-secret-api-key-here`

## Send Push Notification

**POST** `/send-push`

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
    }
  }
}
```

**Response:**

```json
{
  "message": "Push notification jobs queued successfully",
  "totalUsers": 1250,
  "jobsAdded": 2,
  "locales": ["en", "es"]
}
```

## Running the Services

1. **Start the API server:**

   ```bash
   npm start
   ```

2. **Start the worker process:**
   ```bash
   npm run worker
   ```

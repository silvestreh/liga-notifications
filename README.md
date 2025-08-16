# Push Notifications API Usage

## Environment Variables Required

```bash
# Database Configuration
MONGO_URL=mongodb://127.0.0.1:27017/pushdb
REDIS_URL=redis://localhost:6379

# Apple Push Notifications (APNs) Configuration
APN_KEY_CONTENT="<base64 representation of your .p8 AuthKey>"
APN_KEY_ID=XXXXXXXXXX
APN_TEAM_ID=XXXXXXXXX
APN_BUNDLE_ID=com.yourcompany.yourapp
APN_PRODUCTION=true|false

# API Security
API_KEY="<the key to identify the service that wants to send a push notification>"
DEVICE_SECRET="<the key for JWT to authenticate clients so they can modify their tags>"
```

## API Authentication

Include your API key in requests using either:

- Header: `X-API-Key: your-secret-api-key-here`
- Header: `Authorization: Bearer your-secret-api-key-here`

## Send Push Notification

**POST** `/send`

```json
{
  "tags": ["tag 1", "tag 2"],
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

This project uses [`concurrently`](https://www.npmjs.com/package/concurrently), so to start both the API and the worker you only have to run:

```shell
npm start
```

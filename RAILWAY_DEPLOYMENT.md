# Railway Deployment Guide

This guide explains how to deploy your push notification service on Railway with horizontal scaling support.

## 🚀 Quick Deploy

1. **Connect your GitHub repository to Railway**
2. **Set environment variables** (see Environment Variables section below)
3. **Deploy** - Railway will automatically detect the `railway.toml` configuration

## 🏗️ Architecture

The service is split into two components for horizontal scaling:

- **API Service**: Handles HTTP requests and queues push notification jobs
- **Worker Service**: Processes queued jobs and sends push notifications

## 🔧 Environment Variables

### Required Variables

```bash
# Database
MONGO_URL=your_mongodb_connection_string

# Redis
REDIS_URL=your_redis_connection_string

# APNs Configuration
APN_KEY_CONTENT=base64_encoded_p8_file_content
APN_KEY_ID=your_apn_key_id
APN_TEAM_ID=your_team_id
APN_BUNDLE_ID=your_bundle_id
APN_PRODUCTION=true_or_false

# Authentication
API_KEY=your_api_key_for_send_endpoint
DEVICE_SECRET=your_secret_for_device_auth
```

### Optional Variables (with defaults)

```bash
# Worker Scaling
WORKER_CONCURRENCY=3          # Jobs processed concurrently per worker
WORKER_REMOVE_ON_COMPLETE=100 # Keep last 100 completed jobs
WORKER_REMOVE_ON_FAIL=50      # Keep last 50 failed jobs

# Batch Processing
BATCH_SIZE=100                # Tokens per batch
P_LIMIT_CONCURRENCY=5         # Concurrent APNs requests

# Queue Management
QUEUE_REMOVE_ON_COMPLETE=100  # Queue-level job cleanup
QUEUE_REMOVE_ON_FAIL=50       # Queue-level failed job cleanup
QUEUE_MAX_ATTEMPTS=3          # Job retry attempts
QUEUE_BACKOFF_DELAY=2000      # Retry delay in ms
QUEUE_MONITORING_ENABLED=false # Enable queue monitoring logs
```

## 📈 Horizontal Scaling

### Automatic Scaling

Railway will automatically scale based on:

- CPU usage
- Memory usage
- Request volume

### Manual Scaling

1. Go to your Railway project dashboard
2. Navigate to the **Deployments** tab
3. Adjust the number of instances for each service:
   - **API**: 2-3 instances for redundancy
   - **Worker**: Scale based on queue depth

### Scaling Guidelines

- **Queue Depth < 100**: 1-2 workers
- **Queue Depth 100-1000**: 3-5 workers
- **Queue Depth > 1000**: 5+ workers

## 📊 Monitoring

### Health Check Endpoint

```
GET /health
```

Returns status of MongoDB, Redis, and queue health.

### Queue Monitoring

When `QUEUE_MONITORING_ENABLED=true`, the system logs:

- High queue load warnings
- Job processing statistics
- Error rates

## 🔄 Local Development

### Running Locally

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Update .env with your values

# Run both services
npm start

# Or run separately
npm run start:api     # API only
npm run start:worker  # Worker only
```

### Development Mode

```bash
npm run dev           # API with auto-reload
npm run dev:worker    # Worker with auto-reload
```

## 🧪 Testing

### Stress Testing

```bash
# Quick test
npm run stress:quick

# Full test suite
npm run stress:full

# API only
npm run stress:api

# Queue only
npm run stress:queue
```

## 🚨 Troubleshooting

### Common Issues

1. **Worker not processing jobs**
   - Check Redis connection
   - Verify `WORKER_CONCURRENCY` setting
   - Check for MongoDB connection issues

2. **High memory usage**
   - Reduce `BATCH_SIZE`
   - Lower `P_LIMIT_CONCURRENCY`
   - Adjust `WORKER_CONCURRENCY`

3. **Jobs failing repeatedly**
   - Check APNs configuration
   - Verify `QUEUE_MAX_ATTEMPTS` and backoff settings
   - Review error logs

### Logs

- **API logs**: Check Railway dashboard for API service
- **Worker logs**: Check Railway dashboard for worker service
- **Queue monitoring**: Enable with `QUEUE_MONITORING_ENABLED=true`

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [APNs Provider API](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns/)

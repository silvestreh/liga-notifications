# Stress Testing Guide

This guide explains how to use the stress testing tools to evaluate the performance and capacity of your notifications API.

## Overview

The stress testing suite consists of two main components:

1. **API Stress Testing**: Tests the HTTP endpoints for throughput and response times
2. **Queue Stress Testing**: Tests the Redis queue processing capacity without hitting APNs

## Prerequisites

- Node.js 18+ installed
- MongoDB running and accessible
- Redis running and accessible
- API server running on localhost:3000 (or configure custom URL)
- Valid API key for authentication

## Installation

Install the required dependencies:

```bash
npm install
npm install commander  # For CLI tools
```

## Quick Start

### 1. Quick Test (Recommended for first run)

Run a quick test with default settings:

```bash
npm run build
node dist/stress-test-cli.js quick
```

This will:
- Test API endpoints for 30 seconds at 50 req/s
- Process 10,000 notifications through the queue
- Give you a baseline performance measurement

### 2. List Available Scenarios

See all predefined test configurations:

```bash
node dist/stress-test-cli.js scenarios
```

### 3. Run a Predefined Scenario

Run a specific scenario (e.g., 'medium' load):

```bash
node dist/stress-test-cli.js scenario medium
```

## Available Scenarios

| Scenario | Description | API Load | Queue Load | Duration |
|----------|-------------|----------|------------|----------|
| `light` | Development testing | 10 req/s | 1k notifications | 30s |
| `medium` | Staging testing | 50 req/s | 10k notifications | 60s |
| `heavy` | Production planning | 200 req/s | 100k notifications | 120s |
| `extreme` | Maximum capacity | 500 req/s | 500k notifications | 300s |
| `burst` | Traffic spikes | 1000 req/s | 50k notifications | 30s |
| `endurance` | Sustained load | 100 req/s | 1M notifications | 600s |
| `queue-focused` | Queue processing | 5 req/s | 1M notifications | 10s |
| `api-focused` | API endpoints | 1000 req/s | 1k notifications | 180s |

## Custom Testing

### API Endpoint Testing

Test only the API endpoints with custom parameters:

```bash
node dist/stress-test-cli.js api \
  --duration 120 \
  --rps 300 \
  --concurrency 20 \
  --url http://localhost:3000 \
  --key your-api-key
```

**Parameters:**
- `--duration`: Test duration in seconds
- `--rps`: Requests per second
- `--concurrency`: Concurrent requests
- `--url`: API base URL
- `--key`: API key for authentication

### Queue Processing Testing

Test only the queue processing with custom parameters:

```bash
node dist/stress-test-cli.js queue \
  --size 50000 \
  --batch-size 200 \
  --concurrency 15
```

**Parameters:**
- `--size`: Number of notifications to process
- `--batch-size`: Batch size for processing
- `--concurrency`: Worker concurrency

### Full Suite Testing

Run both API and queue tests with custom parameters:

```bash
node dist/stress-test-cli.js full \
  --duration 180 \
  --rps 400 \
  --size 200000 \
  --batch-size 150 \
  --concurrency 25 \
  --url http://localhost:3000 \
  --key your-api-key
```

## Understanding Results

### API Test Results

- **Total Requests**: Total number of requests sent
- **Success Rate**: Percentage of successful requests
- **Throughput**: Requests per second achieved
- **Response Times**: Min, max, average, P95, P99 response times
- **Errors**: Any failed requests with status codes

### Queue Test Results

- **Total Jobs**: Number of notifications processed
- **Processing Time**: Total time to process all notifications
- **Throughput**: Notifications processed per second
- **Efficiency**: Comparison with theoretical maximum throughput

### Performance Metrics

- **P95 Response Time**: 95% of requests completed within this time
- **P99 Response Time**: 99% of requests completed within this time
- **Throughput**: Maximum sustainable requests/notifications per second

## Environment Variables

Set these environment variables for custom configurations:

```bash
export API_URL="http://localhost:3000"
export API_KEY="your-api-key"
export TEST_DURATION="120"
export REQUESTS_PER_SECOND="200"
export QUEUE_SIZE="100000"
export BATCH_SIZE="100"
export CONCURRENCY="10"
```

## Safety Features

### APNs Mocking

The stress tests **do not hit real APNs servers** to avoid:
- Getting banned from APNs
- Incurring charges
- Sending real notifications to test devices

Instead, they simulate:
- APNs processing time (10-50ms per batch)
- Invalid token detection (1-5% of tokens)
- Database cleanup operations

### Resource Limits

Built-in safeguards prevent:
- Excessive concurrency (>100 workers)
- Unreasonable request rates (>10,000 req/s)
- Resource exhaustion

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Ensure MongoDB and Redis are running
   - Check connection strings in `.env`
   - Verify network connectivity

2. **Authentication Errors**
   - Check API key configuration
   - Ensure API server is running
   - Verify endpoint URLs

3. **Performance Issues**
   - Monitor system resources (CPU, memory, network)
   - Check MongoDB and Redis performance
   - Adjust concurrency and batch sizes

### Debug Mode

For detailed logging, set:

```bash
export NODE_ENV=development
```

### Monitoring

Monitor these metrics during testing:
- CPU usage
- Memory consumption
- Network I/O
- MongoDB connection pool
- Redis memory usage

## Best Practices

### Test Planning

1. **Start Small**: Begin with light/medium scenarios
2. **Gradual Increase**: Scale up load incrementally
3. **Monitor Resources**: Watch system performance
4. **Document Results**: Keep records of test outcomes

### Production Testing

1. **Use Staging**: Test in non-production environments
2. **Off-Peak Hours**: Run heavy tests during low traffic
3. **Resource Monitoring**: Ensure adequate capacity
4. **Rollback Plan**: Be prepared to stop tests

### Performance Targets

Typical targets for a production notifications API:
- **API Response Time**: P95 < 200ms, P99 < 500ms
- **API Throughput**: 500-1000 req/s sustained
- **Queue Processing**: 10,000+ notifications/second
- **Uptime**: 99.9%+ availability

## Example Test Runs

### Development Environment

```bash
# Quick validation
node dist/stress-test-cli.js quick

# Light load testing
node dist/stress-test-cli.js scenario light
```

### Staging Environment

```bash
# Medium load testing
node dist/stress-test-cli.js scenario medium

# Custom API testing
node dist/stress-test-cli.js api --duration 300 --rps 100 --concurrency 10
```

### Production Planning

```bash
# Heavy load testing
node dist/stress-test-cli.js scenario heavy

# Queue capacity testing
node dist/stress-test-cli.js scenario queue-focused

# Full suite testing
node dist/stress-test-cli.js full --duration 600 --rps 300 --size 500000
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs and metrics
3. Adjust test parameters
4. Monitor system resources

Remember: Stress testing is about finding the limits of your system safely and responsibly!

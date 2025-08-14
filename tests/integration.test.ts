import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { authenticateApiKey } from '../middleware/auth';
import tokenRoutes from '../routes/token-routes';
import pushRoutes from '../routes/push-routes';
import Token from '../models/token';

// Create test app (similar to main app)
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'Push Notification Service',
      version: '1.0.0',
      endpoints: {
        'POST /register': 'Register device token (no auth)',
        'GET /token/:id': 'Get token info (auth required)',
        'POST /send-push': 'Send push notifications (auth required)',
        'GET /health': 'Health check (no auth)'
      }
    });
  });

  // Mount routes
  app.use('/', tokenRoutes);
  app.use('/', authenticateApiKey, pushRoutes);

  return app;
};

describe('Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Complete User Journey', () => {
    it('should handle complete push notification flow', async () => {
      // Step 1: Register multiple devices
      const devices = [
        { token: 'device-1-token', platform: 'ios', tags: ['sports', 'premium'], locale: 'en' },
        { token: 'device-2-token', platform: 'ios', tags: ['sports'], locale: 'es' },
        { token: 'device-3-token', platform: 'android', tags: ['news'], locale: 'en' },
        { token: 'device-4-token', platform: 'ios', tags: ['sports', 'news'], locale: 'fr' }
      ];

      // Register all devices (no auth required)
      for (const device of devices) {
        const response = await request(app)
          .post('/register')
          .send(device)
          .expect(200);

        expect(response.body.message).toBe('Device token registered successfully');
      }

      // Verify all devices were registered
      const totalDevices = await Token.countDocuments();
      expect(totalDevices).toBe(4);

      // Step 2: Send targeted push notification
      const pushData = {
        tags: ['sports'],
        localesContent: {
          en: { title: 'Sports Alert!', text: 'Your favorite team is playing now!' },
          es: { title: '¡Alerta Deportiva!', text: '¡Tu equipo favorito está jugando ahora!' },
          fr: { title: 'Alerte Sport!', text: 'Votre équipe préférée joue maintenant!' }
        }
      };

      const pushResponse = await request(app)
        .post('/send-push')
        .set('X-API-Key', 'test-api-key')
        .send(pushData)
        .expect(200);

      // Should target devices with 'sports' tag (3 devices)
      expect(pushResponse.body).toMatchObject({
        message: 'Push notification jobs queued successfully',
        totalUsers: 3,
        jobsAdded: 3, // en, es, fr locales
        locales: expect.arrayContaining(['en', 'es', 'fr'])
      });

      // Step 3: Update device tags
      const updateResponse = await request(app)
        .post('/register')
        .send({
          token: 'device-1-token',
          tags: ['news', 'breaking'], // Changed from sports to news
          locale: 'en'
        })
        .expect(200);

      expect(updateResponse.body.token.tags).toEqual(['news', 'breaking']);

      // Step 4: Send another notification to verify targeting changed
      const newsAlert = {
        tags: ['news'],
        localesContent: {
          en: { title: 'Breaking News', text: 'Important update!' },
          fr: { title: 'Actualités', text: 'Mise à jour importante!' }
        }
      };

      const newsResponse = await request(app)
        .post('/send-push')
        .set('X-API-Key', 'test-api-key')
        .send(newsAlert)
        .expect(200);

      // Should now target device-1 (updated to news) and device-3 (news) and device-4 (sports+news)
      expect(newsResponse.body.totalUsers).toBe(3);

      // Step 5: Look up device info
      const lookupResponse = await request(app)
        .get('/token/device-1-token')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(lookupResponse.body.token).toMatchObject({
        tokenPreview: 'device-1-t...',
        platform: 'ios',
        tags: ['news', 'breaking'],
        locale: 'en'
      });
    });

    it('should handle edge cases gracefully', async () => {
      // Test with no matching devices
      const response = await request(app)
        .post('/send-push')
        .set('X-API-Key', 'test-api-key')
        .send({
          tags: ['nonexistent'],
          localesContent: {
            en: { title: 'Test', text: 'Message' }
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'No devices found for the specified tags',
        totalUsers: 0
      });
    });

    it('should handle partial locale coverage', async () => {
      // Register devices with different locales
      await request(app)
        .post('/register')
        .send({ token: 'en-device', tags: ['test'], locale: 'en' })
        .expect(200);

      await request(app)
        .post('/register')
        .send({ token: 'de-device', tags: ['test'], locale: 'de' })
        .expect(200);

      // Send push with only English content
      const response = await request(app)
        .post('/send-push')
        .set('X-API-Key', 'test-api-key')
        .send({
          tags: ['test'],
          localesContent: {
            en: { title: 'English Only', text: 'English message' }
          }
        })
        .expect(200);

      // Should find 2 devices but only queue 1 job (English)
      expect(response.body).toMatchObject({
        totalUsers: 2,
        jobsAdded: 1,
        locales: ['en', 'de'] // Found both locales but only processed en
      });
    });
  });

  describe('API Documentation Endpoints', () => {
    it('should return API documentation on root endpoint', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'Push Notification Service',
        version: '1.0.0',
        endpoints: expect.objectContaining({
          'POST /register': 'Register device token (no auth)',
          'POST /send-push': 'Send push notifications (auth required)'
        })
      });
    });

    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should allow public endpoints without authentication', async () => {
      // These should work without API key
      await request(app).get('/').expect(200);
      await request(app).get('/health').expect(200);
      await request(app)
        .post('/register')
        .send({ token: 'test-token' })
        .expect(200);
    });

    it('should protect admin endpoints with authentication', async () => {
      // These should require API key
      await request(app)
        .post('/send-push')
        .send({ tags: ['test'], localesContent: { en: { title: 'Test', text: 'Test' } } })
        .expect(401);

      await request(app)
        .get('/token/some-token')
        .expect(401);
    });

    it('should accept valid authentication', async () => {
      // Create a token first
      await Token.create({
        token: 'auth-test-token',
        tags: ['test'],
        locale: 'en',
        platform: 'ios'
      });

      // These should work with valid API key
      await request(app)
        .get('/token/auth-test-token')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      await request(app)
        .post('/send-push')
        .set('Authorization', 'Bearer test-api-key')
        .send({
          tags: ['test'],
          localesContent: { en: { title: 'Test', text: 'Test' } }
        })
        .expect(200);
    });
  });

  describe('Database Consistency', () => {
    it('should maintain data consistency across operations', async () => {
      const tokenData = {
        token: 'consistency-test-token',
        platform: 'ios',
        tags: ['initial'],
        locale: 'en'
      };

      // Initial registration
      await request(app)
        .post('/register')
        .send(tokenData)
        .expect(200);

      let dbToken = await Token.findOne({ token: tokenData.token });
      expect(dbToken?.tags).toEqual(['initial']);

      // Update registration (should update, not create new)
      await request(app)
        .post('/register')
        .send({ ...tokenData, tags: ['updated'] })
        .expect(200);

      // Verify only one document exists
      const tokenCount = await Token.countDocuments({ token: tokenData.token });
      expect(tokenCount).toBe(1);

      dbToken = await Token.findOne({ token: tokenData.token });
      expect(dbToken?.tags).toEqual(['updated']);
      expect(dbToken?.lastActive).toBeDefined();
    });
  });
});

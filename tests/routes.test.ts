import request from 'supertest';
import express from 'express';
import { authenticateApiKey } from '../middleware/auth';
import tokenRoutes from '../routes/token-routes';
import pushRoutes from '../routes/push-routes';
import Token from '../models/token';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mount routes like in main app
  app.use('/', tokenRoutes);
  app.use('/', authenticateApiKey, pushRoutes);

  return app;
};

describe('API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Token Routes', () => {
    describe('POST /register', () => {
      it('should register a new device token', async () => {
        const tokenData = {
          token: 'new-device-token-123',
          platform: 'ios',
          tags: ['sports', 'news'],
          locale: 'en'
        };

        const response = await request(app)
          .post('/register')
          .send(tokenData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Device token registered successfully',
          token: {
            platform: 'ios',
            tags: ['sports', 'news'],
            locale: 'en'
          }
        });

        // Verify token was saved to database
        const savedToken = await Token.findOne({ token: tokenData.token });
        expect(savedToken).toBeTruthy();
        expect(savedToken?.tags).toEqual(['sports', 'news']);
      });

      it('should update existing token', async () => {
        // Create initial token
        await Token.create({
          token: 'existing-token-123',
          platform: 'ios',
          tags: ['old-tag'],
          locale: 'en'
        });

        const updateData = {
          token: 'existing-token-123',
          platform: 'android',
          tags: ['new-tag', 'updated'],
          locale: 'es'
        };

        const response = await request(app)
          .post('/register')
          .send(updateData)
          .expect(200);

        expect(response.body.token).toMatchObject({
          platform: 'android',
          tags: ['new-tag', 'updated'],
          locale: 'es'
        });

        // Verify only one token exists
        const tokenCount = await Token.countDocuments({ token: 'existing-token-123' });
        expect(tokenCount).toBe(1);
      });

      it('should use default values when optional fields are missing', async () => {
        const response = await request(app)
          .post('/register')
          .send({ token: 'minimal-token-123' })
          .expect(200);

        expect(response.body.token).toMatchObject({
          platform: 'ios',
          tags: [],
          locale: 'en'
        });
      });

      it('should validate required token field', async () => {
        await request(app)
          .post('/register')
          .send({})
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('token is required');
          });
      });

      it('should validate platform field', async () => {
        await request(app)
          .post('/register')
          .send({ token: 'test-token', platform: 'invalid' })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('platform must be one of');
          });
      });

      it('should validate tags field', async () => {
        await request(app)
          .post('/register')
          .send({ token: 'test-token', tags: 'invalid' })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('tags must be an array of strings');
          });
      });

      it('should validate locale field', async () => {
        await request(app)
          .post('/register')
          .send({ token: 'test-token', locale: 'x' })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('locale must be a valid language code');
          });
      });
    });

    describe('GET /token/:tokenId', () => {
      beforeEach(async () => {
        await Token.create([
          {
            token: 'lookup-token-123456789012345',
            platform: 'ios',
            tags: ['test'],
            locale: 'en'
          }
        ]);
      });

      it('should return token info with valid authentication', async () => {
        const response = await request(app)
          .get('/token/lookup-token-123456789012345')
          .set('X-API-Key', 'test-api-key')
          .expect(200);

        expect(response.body.token).toMatchObject({
          tokenPreview: 'lookup-tok...',
          platform: 'ios',
          tags: ['test'],
          locale: 'en'
        });
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/token/lookup-token-123456789012345')
          .expect(401)
          .expect((res) => {
            expect(res.body.error).toContain('Invalid or missing API key');
          });
      });

      it('should return 404 for non-existent token', async () => {
        await request(app)
          .get('/token/nonexistent-token')
          .set('X-API-Key', 'test-api-key')
          .expect(404)
          .expect((res) => {
            expect(res.body.error).toBe('Token not found');
          });
      });

      it('should validate tokenId length', async () => {
        await request(app)
          .get('/token/short')
          .set('X-API-Key', 'test-api-key')
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('tokenId must be at least 10 characters');
          });
      });
    });
  });

  describe('Push Routes', () => {
    beforeEach(async () => {
      // Create test tokens for push notifications
      await Token.create([
        { token: 'push-token-1', tags: ['sports'], locale: 'en', platform: 'ios' },
        { token: 'push-token-2', tags: ['sports'], locale: 'es', platform: 'ios' },
        { token: 'push-token-3', tags: ['news'], locale: 'en', platform: 'ios' }
      ]);
    });

    describe('POST /send-push', () => {
      const validPushData = {
        tags: ['sports'],
        localesContent: {
          en: { title: 'Sports Update', text: 'Your team won!' },
          es: { title: 'Actualización Deportiva', text: '¡Tu equipo ganó!' }
        }
      };

      it('should queue push notifications with valid authentication', async () => {
        const response = await request(app)
          .post('/send-push')
          .set('X-API-Key', 'test-api-key')
          .send(validPushData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Push notification jobs queued successfully',
          totalUsers: 2,
          jobsAdded: 2,
          locales: expect.arrayContaining(['en', 'es'])
        });
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/send-push')
          .send(validPushData)
          .expect(401)
          .expect((res) => {
            expect(res.body.error).toContain('Invalid or missing API key');
          });
      });

      it('should validate tags field', async () => {
        await request(app)
          .post('/send-push')
          .set('X-API-Key', 'test-api-key')
          .send({ ...validPushData, tags: [] })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('tags must be a non-empty array');
          });
      });

      it('should validate localesContent field', async () => {
        await request(app)
          .post('/send-push')
          .set('X-API-Key', 'test-api-key')
          .send({ ...validPushData, localesContent: null })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('localesContent must be an object');
          });
      });

      it('should validate localesContent structure', async () => {
        const invalidContent = {
          tags: ['sports'],
          localesContent: {
            en: { title: 'Title only' }, // Missing text
            es: { text: 'Text only' }    // Missing title
          }
        };

        await request(app)
          .post('/send-push')
          .set('X-API-Key', 'test-api-key')
          .send(invalidContent)
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('must have title and text properties');
          });
      });

      it('should handle no matching devices gracefully', async () => {
        const response = await request(app)
          .post('/send-push')
          .set('X-API-Key', 'test-api-key')
          .send({
            tags: ['nonexistent'],
            localesContent: validPushData.localesContent
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'No devices found for the specified tags',
          totalUsers: 0
        });
      });

      it('should validate that tags are strings', async () => {
        await request(app)
          .post('/send-push')
          .set('X-API-Key', 'test-api-key')
          .send({
            tags: ['valid', 123, 'another-valid'],
            localesContent: validPushData.localesContent
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toBe('All tags must be strings');
          });
      });

      it('should validate localesContent values are strings', async () => {
        await request(app)
          .post('/send-push')
          .set('X-API-Key', 'test-api-key')
          .send({
            tags: ['sports'],
            localesContent: {
              en: { title: 123, text: 'Valid text' } // Invalid title type
            }
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toContain('title and text must be strings');
          });
      });
    });
  });
});

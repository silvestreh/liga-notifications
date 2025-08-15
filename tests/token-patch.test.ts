import request from 'supertest';
import express from 'express';
import tokenRoutes from '../routes/token-routes';
import Token from '../models/token';

// Helper to create test app instance
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', tokenRoutes); // register & token routes
  return app;
};

describe('PATCH /token/:tokenId', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = createTestApp();
    await Token.deleteMany({});
    await Token.create({
      token: 'patchable-token-123',
      platform: 'ios',
      tags: ['initial'],
      locale: 'en'
    });
  });

  it('should add and remove tags with valid authentication', async () => {
    const response = await request(app)
      .patch('/token/patchable-token-123')
      .set('X-API-Key', 'test-api-key')
      .send({
        tagsToAdd: ['added'],
        tagsToRemove: ['initial']
      })
      .expect(200);

    expect(response.body.token.tags).toEqual(['added']);
  });

  it('should validate tagsToAdd type', async () => {
    await request(app)
      .patch('/token/patchable-token-123')
      .set('X-API-Key', 'test-api-key')
      .send({ tagsToAdd: 'invalid' })
      .expect(400);
  });

  it('should require at least one operation', async () => {
    await request(app)
      .patch('/token/patchable-token-123')
      .set('X-API-Key', 'test-api-key')
      .send({})
      .expect(400);
  });
});

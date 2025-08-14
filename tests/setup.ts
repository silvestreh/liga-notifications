import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Connect mongoose to the in-memory database
  await mongoose.connect(uri);
});

// Cleanup after all tests
afterAll(async () => {
  // Close mongoose connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();

  // Stop in-memory MongoDB instance
  await mongod.stop();
});

// Clear database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.APN_KEY_ID = 'test-key-id';
process.env.APN_TEAM_ID = 'test-team-id';
process.env.APN_BUNDLE_ID = 'com.test.app';
process.env.APN_KEY_CONTENT = Buffer.from('test-key-content').toString('base64');
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

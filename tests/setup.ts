import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let mongod: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  if (process.env.TEST_REAL_DB === 'true' && process.env.MONGO_URI) {
    console.log('🔗 Connecting to real MongoDB instance for tests');
    await mongoose.connect(process.env.MONGO_URI);
  } else {
    // Start in-memory MongoDB instance
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  }
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();

  if (mongod) {
    await mongod.stop();
  }
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

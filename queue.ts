import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisURLString = process.env.REDIS_URL!;
export const connection = new IORedis(redisURLString, { family: 0, maxRetriesPerRequest: null });

// Redis connection event logging
connection.on("connect", () => {
  console.log(`📡 Redis: attempting connection to ${redisURLString}`);
});

connection.on("ready", () => {
  console.log("✅ Redis: connection established and ready to use");
});

connection.on("error", (err) => {
  console.error("❌ Redis: connection error", err);
});

connection.on("reconnecting", () => {
  console.warn("🔄 Redis: reconnecting...");
});

export const pushQueue = new Queue("pushQueue", { connection });

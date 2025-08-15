import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = `${process.env.REDIS_URL}?family=0` || "redis://localhost:6379";

export const connection = new IORedis(redisUrl);

// Redis connection event logging
connection.on("connect", () => {
  console.log(`📡 Redis: attempting connection to ${redisUrl}`);
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

export const pushQueue = new Queue("pushQueue", {
  connection: {
    ...connection,
    // @ts-ignore
    family: 0
  }
});

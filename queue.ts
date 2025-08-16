import { Queue } from "bullmq";
import { Redis } from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisURLString = process.env.REDIS_URL!;
export const connection = new Redis(redisURLString, {
  family: 0,
  maxRetriesPerRequest: null,
});

// Redis connection event logging
connection.on("connect", () => {
  console.log(`📡 Redis: attempting connection to ${redisURLString}`);
});

connection.on("ready", () => {
  console.log("✅ Redis: connection established and ready to use");
});

connection.on("error", (err: any) => {
  console.error("❌ Redis: connection error", err);
});

connection.on("reconnecting", () => {
  console.warn("🔄 Redis: reconnecting...");
});

export const pushQueue = new Queue("pushQueue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: {
      count: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || "100"),
    },
    removeOnFail: { count: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || "50") },
    attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || "3") as number,
    backoff: {
      type: "exponential",
      delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || "2000") as number,
    },
  },
});

// Add queue monitoring if enabled
if (process.env.QUEUE_MONITORING_ENABLED === "true") {
  setInterval(async () => {
    try {
      const waiting = await pushQueue.getWaiting();
      const active = await pushQueue.getActive();
      const completed = await pushQueue.getCompleted();
      const failed = await pushQueue.getFailed();

      if (waiting.length > 100 || active.length > 50) {
        console.log(
          `🚨 Queue load high - Waiting: ${waiting.length}, Active: ${active.length}`,
        );
      }
    } catch (error) {
      // Silent fail for monitoring
    }
  }, 30000); // Check every 30 seconds
}

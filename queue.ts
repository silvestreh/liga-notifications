import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

// Added Redis connection event logging
connection.on("connect", () => {
  console.log(`📡 Redis: attempting connection to ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`);
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

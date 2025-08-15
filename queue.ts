import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisURL = new URL(process.env.REDIS_URL!);

export const connection = new IORedis(`${redisURL}?family=0`);

// Redis connection event logging
connection.on("connect", () => {
  console.log(`📡 Redis: attempting connection to ${redisURL}`);
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
    family: 0,
    host: redisURL.hostname,
    port: parseInt(redisURL.port, 10),
    username: redisURL.username,
    password: redisURL.password
  }
});

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { pushQueue, connection as redisConnection } from "./queue.js";
import { authenticateApiKey } from "./middleware/auth.js";
import pushRoutes from "./routes/push-routes.js";
import tokenRoutes from "./routes/token-routes.js";
dotenv.config();

// MongoDB connection event logging
mongoose.connection.on("connecting", () => {
  console.log("📡 MongoDB: attempting connection to", process.env.MONGO_URL);
});

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB: connection established");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB: connection error", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB: disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("🔄 MongoDB: reconnected");
});

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URL!).catch(console.error);

// Health check endpoint (no auth required) - MUST be before routes
app.get("/health", async (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: { status: "unknown", latency: null as number | null },
      redis: { status: "unknown", latency: null as number | null },
      queue: { status: "unknown", jobs: null as any },
    },
  };

  let overallHealthy = true;

  try {
    // Check MongoDB connection
    const mongoStart = Date.now();
    if (!mongoose.connection.db) {
      throw new Error("MongoDB not connected");
    }
    await mongoose.connection.db.admin().ping();
    health.services.mongodb = {
      status: "healthy",
      latency: Date.now() - mongoStart,
    };
  } catch (error) {
    health.services.mongodb = {
      status: "unhealthy",
      latency: null,
    };
    overallHealthy = false;
  }

  try {
    // Check Redis connection
    const redisStart = Date.now();
    await redisConnection.ping();
    health.services.redis = {
      status: "healthy",
      latency: Date.now() - redisStart,
    };

    // Check queue status
    const waiting = await pushQueue.getWaiting();
    const active = await pushQueue.getActive();
    const completed = await pushQueue.getCompleted();
    const failed = await pushQueue.getFailed();

    health.services.queue = {
      status: "healthy",
      jobs: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
    };
  } catch (error) {
    health.services.redis = {
      status: "unhealthy",
      latency: null,
    };
    health.services.queue = {
      status: "unhealthy",
      jobs: null,
    };
    overallHealthy = false;
  }

  health.status = overallHealthy ? "healthy" : "unhealthy";

  res.status(overallHealthy ? 200 : 503).json(health);
});

// Mount routes
app.use("/", tokenRoutes); // Token routes (register is public, token lookup requires auth)
app.use("/", authenticateApiKey, pushRoutes); // Push routes (all require authentication)

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Push Notification Service",
    version: "1.0.0",
    endpoints: {
      "POST /register": "Register device token (no auth)",
      "GET /token/:id": "Get token info (auth required)",
      "PATCH /token": "Add/Remove tags on a token (device auth header)",
      "POST /send": "Send push notifications (auth required)",
      "GET /health": "Health check (no auth)",
    },
  });
});

const server = app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000"),
);

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down server gracefully...");

  server.close(async () => {
    console.log("HTTP server closed");

    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");

      await pushQueue.close();
      console.log("Push queue closed");

      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down server gracefully...");

  server.close(async () => {
    console.log("HTTP server closed");

    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");

      await pushQueue.close();
      console.log("Push queue closed");

      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

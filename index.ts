import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { pushQueue } from "./queue.js";
import { authenticateApiKey } from "./middleware/auth.js";
import pushRoutes from "./routes/push-routes.js";
import tokenRoutes from "./routes/token-routes.js";
dotenv.config();

// MongoDB connection event logging
mongoose.connection.on("connecting", () => {
  console.log("📡 MongoDB: attempting connection to", process.env.MONGO_URI);
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

mongoose
  .connect(process.env.MONGO_URI!)
  .catch(console.error);

// Mount routes
app.use("/", tokenRoutes); // Token routes (register is public, token lookup requires auth)
app.use("/", authenticateApiKey, pushRoutes); // Push routes (all require authentication)

// Health check endpoint (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Push Notification Service",
    version: "1.0.0",
    endpoints: {
      "POST /register": "Register device token (no auth)",
      "GET /token/:id": "Get token info (auth required)",
      "POST /send-push": "Send push notifications (auth required)",
      "GET /health": "Health check (no auth)"
    }
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

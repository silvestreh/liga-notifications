import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { pushQueue } from "./queue.js";
import {
  getTokensByTags,
  groupTokensByLocale,
  generatePayload,
} from "./helpers.js";
dotenv.config();

const app = express();
app.use(express.json());

// API Key Authentication Middleware
const authenticateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.error('API_KEY environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
};

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => console.log("MongoDB connected"))
  .catch(console.error);

app.post("/send-push", authenticateApiKey, async (req, res) => {
  try {
    const { tags, localesContent } = req.body as {
      tags: string[];
      localesContent: Record<string, { title: string; text: string }>;
    };

    // Input validation
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: "tags must be a non-empty array" });
    }

    if (!localesContent || typeof localesContent !== 'object') {
      return res.status(400).json({ error: "localesContent must be an object" });
    }

    // Validate localesContent structure
    for (const [locale, content] of Object.entries(localesContent)) {
      if (!content || typeof content !== 'object' || !content.title || !content.text) {
        return res.status(400).json({
          error: `localesContent.${locale} must have title and text properties`
        });
      }
      if (typeof content.title !== 'string' || typeof content.text !== 'string') {
        return res.status(400).json({
          error: `localesContent.${locale}.title and text must be strings`
        });
      }
    }

    // Validate tags are strings
    if (!tags.every(tag => typeof tag === 'string')) {
      return res.status(400).json({ error: "All tags must be strings" });
    }

    const tokens = await getTokensByTags(tags);

    if (tokens.length === 0) {
      return res.json({
        message: "No devices found for the specified tags",
        totalUsers: 0
      });
    }

    const groupedTokens = groupTokensByLocale(tokens);
    const payload = generatePayload(localesContent);

    let jobsAdded = 0;
    for (const [locale, tokensList] of Object.entries(groupedTokens)) {
      if (payload.locales[locale]) {
        await pushQueue.add("sendPush", {
          tokens: tokensList,
          payload: payload.locales[locale],
        });
        jobsAdded++;
      } else {
        console.warn(`No content provided for locale: ${locale}, skipping ${tokensList.length} tokens`);
      }
    }

    res.json({
      message: "Push notification jobs queued successfully",
      totalUsers: tokens.length,
      jobsAdded,
      locales: Object.keys(groupedTokens)
    });

  } catch (error) {
    console.error("Error in /send-push:", error);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

const server = app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down server gracefully...');

  server.close(async () => {
    console.log('HTTP server closed');

    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');

      await pushQueue.close();
      console.log('Push queue closed');

      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down server gracefully...');

  server.close(async () => {
    console.log('HTTP server closed');

    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');

      await pushQueue.close();
      console.log('Push queue closed');

      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

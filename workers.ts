import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { sendAPNsBatch } from "./apns.js";
import { removeInvalidTokens } from "./helpers.js";
import pLimit from "p-limit";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();
await mongoose.connect(process.env.MONGO_URL!);

const limit = pLimit(parseInt(process.env.P_LIMIT_CONCURRENCY || "5"));
const batchSize = parseInt(process.env.BATCH_SIZE || "100");

const worker = new Worker(
  "pushQueue",
  async (job) => {
    try {
      const { tokens, payload } = job.data as {
        tokens: string[];
        payload: { title: string; text: string; metadata?: Record<string, any> };
      };

      // Validate job data
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        throw new Error("Job data must contain a non-empty tokens array");
      }

      if (!payload || !payload.title || !payload.text) {
        throw new Error("Job data must contain payload with title and text");
      }

      // Debug: Log the payload being processed
      console.log('Worker processing payload:', JSON.stringify(payload, null, 2));

      const invalidTokensTotal: string[] = [];
      let successfulBatches = 0;
      let failedBatches = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        try {
          const invalidTokens = await limit(() =>
            sendAPNsBatch(batch, payload),
          );
          invalidTokensTotal.push(...invalidTokens);
          successfulBatches++;
        } catch (batchError) {
          failedBatches++;
          console.error(
            `Batch ${Math.floor(i / batchSize) + 1} failed:`,
            batchError,
          );
          // Continue processing other batches instead of failing the entire job
        }
      }

      // Clean up invalid tokens (this won't throw)
      await removeInvalidTokens(invalidTokensTotal);

      const summary = {
        totalTokens: tokens.length,
        successfulBatches,
        failedBatches,
        invalidTokens: invalidTokensTotal.length,
      };

      // If all batches failed, throw an error
      if (failedBatches > 0 && successfulBatches === 0) {
        throw new Error(`All ${failedBatches} batches failed to process`);
      }

      return summary;
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error; // Re-throw to mark job as failed
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3"),
    removeOnComplete: {
      count: parseInt(process.env.WORKER_REMOVE_ON_COMPLETE || "100"),
    },
    removeOnFail: {
      count: parseInt(process.env.WORKER_REMOVE_ON_FAIL || "50"),
    },
  },
);

worker.on("completed", (job, returnValue) => {
  // Job completed successfully - no logging to prevent bottlenecks
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("❌ Worker error:", err);
});

// Graceful shutdown handling for Railway
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down worker gracefully...`);

  // Stop accepting new jobs
  await worker.close();

  // Wait for current jobs to complete (with timeout)
  const timeout = setTimeout(() => {
    console.log("Force shutdown after timeout");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    await mongoose.connection.close();
    clearTimeout(timeout);
    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

console.log("🚀 Worker started and ready to process push notification jobs...");

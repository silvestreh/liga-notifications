import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { sendAPNsBatch } from "./apns.js";
import { removeInvalidTokens } from "./helpers.js";
import pLimit from "p-limit";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();
await mongoose.connect(process.env.MONGO_URL!);

const limit = pLimit(5);
const batchSize = 100;

const worker = new Worker(
  "pushQueue",
  async (job) => {
    try {
      console.log(`Processing job ${job.id} - started`);

      const { tokens, payload } = job.data as {
        tokens: string[];
        payload: { title: string; text: string };
      };

      // Validate job data
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        throw new Error("Job data must contain a non-empty tokens array");
      }

      if (!payload || !payload.title || !payload.text) {
        throw new Error("Job data must contain payload with title and text");
      }

      console.log(`Processing ${tokens.length} tokens with payload:`, {
        title:
          payload.title.substring(0, 50) +
          (payload.title.length > 50 ? "..." : ""),
        text:
          payload.text.substring(0, 50) +
          (payload.text.length > 50 ? "..." : ""),
      });

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

          console.log(
            `Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tokens.length / batchSize)} completed - ${invalidTokens.length} invalid tokens found`,
          );
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

      console.log(`Job ${job.id} completed:`, summary);

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
    concurrency: 3, // Process up to 3 jobs concurrently
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 }, // Keep last 50 failed jobs for debugging
  },
);

worker.on("completed", (job, returnValue) => {
  console.log(`✅ Job ${job.id} completed successfully:`, returnValue);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("❌ Worker error:", err);
});

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down worker gracefully...");
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down worker gracefully...");
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
});

console.log("🚀 Worker started and ready to process push notification jobs...");

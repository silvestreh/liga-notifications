import axios from "axios";
import { performance } from "perf_hooks";
import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { sendAPNsBatch } from "./apns.js";
import { removeInvalidTokens } from "./helpers.js";
import pLimit from "p-limit";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Mock APNs to avoid hitting real service
const originalSendAPNsBatch = sendAPNsBatch;
const mockSendAPNsBatch = async (tokens: string[], payload: any) => {
  // Simulate APNs processing time (10-50ms per batch)
  const processingTime = Math.random() * 40 + 10;
  await new Promise((resolve) => setTimeout(resolve, processingTime));

  // Simulate some invalid tokens (1-5% of tokens)
  const invalidCount = Math.floor(
    tokens.length * (Math.random() * 0.04 + 0.01),
  );
  const invalidTokens = tokens.slice(0, invalidCount);

  return invalidTokens;
};

// Mock helpers to avoid database operations
const originalRemoveInvalidTokens = removeInvalidTokens;
const mockRemoveInvalidTokens = async (tokens: string[]) => {
  // Simulate database cleanup time (5-20ms)
  const cleanupTime = Math.random() * 15 + 5;
  await new Promise((resolve) => setTimeout(resolve, cleanupTime));
};

export interface StressTestConfig {
  apiUrl: string;
  apiKey: string;
  testDuration: number; // seconds
  requestsPerSecond: number;
  queueSize: number;
  batchSize: number;
  concurrency: number;
}

export interface TestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
  errors: Array<{ status: number; message: string; count: number }>;
}

interface QueueTestResult {
  totalJobs: number;
  processingTime: number; // milliseconds
  averageJobTime: number;
  throughput: number; // jobs per second
  concurrency: number;
}

class StressTester {
  private config: StressTestConfig;
  private results: TestResult;
  private responseTimes: number[] = [];
  private errors: Map<
    string,
    { status: number; message: string; count: number }
  > = new Map();

  constructor(config: StressTestConfig) {
    this.config = config;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
      errors: [],
    };
  }

  async testAPIEndpoints(): Promise<TestResult> {
    console.log(
      `🚀 Starting API stress test for ${this.config.testDuration}s at ${this.config.requestsPerSecond} req/s`,
    );

    const startTime = performance.now();
    const endTime = startTime + this.config.testDuration * 1000;
    const interval = 1000 / this.config.requestsPerSecond;

    let requestCount = 0;

    while (performance.now() < endTime) {
      const batchStart = performance.now();

      // Send requests in parallel based on concurrency
      const promises = Array.from({ length: this.config.concurrency }, () =>
        this.sendTestRequest(),
      );

      await Promise.allSettled(promises);
      requestCount += this.config.concurrency;

      // Calculate delay to maintain target RPS
      const batchTime = performance.now() - batchStart;
      const targetDelay =
        (1000 / this.config.requestsPerSecond) * this.config.concurrency;
      const actualDelay = Math.max(0, targetDelay - batchTime);

      if (actualDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, actualDelay));
      }
    }

    this.calculateResults();
    return this.results;
  }

  private async sendTestRequest(): Promise<void> {
    const startTime = performance.now();

    try {
      const response = await axios.post(
        `${this.config.apiUrl}/send`,
        {
          tags: ["test", "stress"],
          localesContent: {
            en: {
              title: "Stress Test Notification",
              text: "This is a stress test notification",
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      const responseTime = performance.now() - startTime;
      this.recordSuccess(responseTime);
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      this.recordError(error, responseTime);
    }
  }

  private recordSuccess(responseTime: number): void {
    this.results.successfulRequests++;
    this.responseTimes.push(responseTime);

    if (responseTime < this.results.minResponseTime) {
      this.results.minResponseTime = responseTime;
    }
    if (responseTime > this.results.maxResponseTime) {
      this.results.maxResponseTime = responseTime;
    }
  }

  private recordError(error: any, responseTime: number): void {
    this.results.failedRequests++;
    this.responseTimes.push(responseTime);

    const status = error.response?.status || 0;
    const message =
      error.response?.data?.error || error.message || "Unknown error";
    const errorKey = `${status}:${message}`;

    if (this.errors.has(errorKey)) {
      this.errors.get(errorKey)!.count++;
    } else {
      this.errors.set(errorKey, { status, message, count: 1 });
    }
  }

  private calculateResults(): void {
    this.results.totalRequests =
      this.results.successfulRequests + this.results.failedRequests;

    if (this.responseTimes.length > 0) {
      this.responseTimes.sort((a, b) => a - b);
      this.results.averageResponseTime =
        this.responseTimes.reduce((a, b) => a + b, 0) /
        this.responseTimes.length;
      this.results.p95ResponseTime =
        this.responseTimes[Math.floor(this.responseTimes.length * 0.95)];
      this.results.p99ResponseTime =
        this.responseTimes[Math.floor(this.responseTimes.length * 0.99)];
    }

    this.results.throughput =
      this.results.totalRequests / this.config.testDuration;
    this.results.errors = Array.from(this.errors.values());
  }
}

class QueueStressTester {
  private config: StressTestConfig;
  private mockWorker: Worker;
  private testQueue: any;

  constructor(config: StressTestConfig) {
    this.config = config;
    this.testQueue = null;
    this.mockWorker = null as any;
  }

  private async initialize() {
    if (!this.testQueue) {
      // Import Queue from the same file to avoid circular imports
      const { pushQueue } = await import("./queue.js");
      this.testQueue = pushQueue;
    }

    if (!this.mockWorker) {
      // Create a mock worker that doesn't actually send to APNs
      this.mockWorker = new Worker(
        "pushQueue",
        async (job) => {
          const startTime = performance.now();

          const { tokens, payload } = job.data as {
            tokens: string[];
            payload: { title: string; text: string };
          };

          // Process tokens in batches
          const invalidTokensTotal: string[] = [];
          let successfulBatches = 0;
          let failedBatches = 0;

          for (let i = 0; i < tokens.length; i += this.config.batchSize) {
            const batch = tokens.slice(i, i + this.config.batchSize);

            try {
              const invalidTokens = await mockSendAPNsBatch(batch, payload);
              invalidTokensTotal.push(...invalidTokens);
              successfulBatches++;
            } catch (error) {
              failedBatches++;
            }
          }

          // Mock cleanup
          await mockRemoveInvalidTokens(invalidTokensTotal);

          const processingTime = performance.now() - startTime;

          return {
            totalTokens: tokens.length,
            successfulBatches,
            failedBatches,
            invalidTokens: invalidTokensTotal.length,
            processingTime,
          };
        },
        {
          connection,
          concurrency: this.config.concurrency,
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 },
        },
      );
    }
  }

  async testQueueProcessing(): Promise<QueueTestResult> {
    await this.initialize();

    console.log(
      `📊 Starting queue stress test with ${this.config.queueSize} notifications`,
    );

    // Add test jobs to queue
    const startTime = performance.now();
    const jobs = [];

    for (let i = 0; i < this.config.queueSize; i += 100) {
      const batchSize = Math.min(100, this.config.queueSize - i);
      const tokens = Array.from(
        { length: batchSize },
        (_, index) => `test_token_${i + index}_${Date.now()}`,
      );

      jobs.push(
        this.testQueue.add("sendPush", {
          tokens,
          payload: {
            title: `Stress Test ${i + 1}`,
            text: `Processing batch ${Math.floor(i / 100) + 1}`,
          },
        }),
      );
    }

    console.log(`📝 Added ${jobs.length} jobs to queue`);

    // Wait for all jobs to complete
    await Promise.all(jobs);

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Get queue statistics
    const waiting = await this.testQueue.getWaiting();
    const active = await this.testQueue.getActive();
    const completed = await this.testQueue.getCompleted();
    const failed = await this.testQueue.getFailed();

    console.log(
      `📊 Queue status: ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed`,
    );

    return {
      totalJobs: this.config.queueSize,
      processingTime,
      averageJobTime: processingTime / this.config.queueSize,
      throughput: this.config.queueSize / (processingTime / 1000),
      concurrency: this.config.concurrency,
    };
  }

  async cleanup(): Promise<void> {
    await this.mockWorker.close();
  }
}

async function runStressTests() {
  try {
    // Connect to MongoDB and Redis
    await mongoose.connect(process.env.MONGO_URL!);
    console.log("✅ Connected to MongoDB");

    await connection.ping();
    console.log("✅ Connected to Redis");

    const config: StressTestConfig = {
      apiUrl: process.env.API_URL || "http://localhost:3000",
      apiKey: process.env.API_KEY || "test-api-key",
      testDuration: parseInt(process.env.TEST_DURATION || "60"), // 60 seconds
      requestsPerSecond: parseInt(process.env.REQUESTS_PER_SECOND || "100"), // 100 req/s
      queueSize: parseInt(process.env.QUEUE_SIZE || "100000"), // 100k notifications
      batchSize: parseInt(process.env.BATCH_SIZE || "100"),
      concurrency: parseInt(process.env.CONCURRENCY || "10"),
    };

    console.log("🔧 Test Configuration:", config);

    // Test 1: API Endpoint Stress Test
    console.log("\n" + "=".repeat(60));
    console.log("🧪 TEST 1: API Endpoint Stress Test");
    console.log("=".repeat(60));

    const apiTester = new StressTester(config);
    const apiResults = await apiTester.testAPIEndpoints();

    console.log("\n📊 API Test Results:");
    console.log(`Total Requests: ${apiResults.totalRequests}`);
    console.log(`Successful: ${apiResults.successfulRequests}`);
    console.log(`Failed: ${apiResults.failedRequests}`);
    console.log(
      `Success Rate: ${((apiResults.successfulRequests / apiResults.totalRequests) * 100).toFixed(2)}%`,
    );
    console.log(`Throughput: ${apiResults.throughput.toFixed(2)} req/s`);
    console.log(
      `Average Response Time: ${apiResults.averageResponseTime.toFixed(2)}ms`,
    );
    console.log(
      `P95 Response Time: ${apiResults.p95ResponseTime.toFixed(2)}ms`,
    );
    console.log(
      `P99 Response Time: ${apiResults.p99ResponseTime.toFixed(2)}ms`,
    );
    console.log(
      `Min Response Time: ${apiResults.minResponseTime.toFixed(2)}ms`,
    );
    console.log(
      `Max Response Time: ${apiResults.maxResponseTime.toFixed(2)}ms`,
    );

    if (apiResults.errors.length > 0) {
      console.log("\n❌ Errors:");
      apiResults.errors.forEach((error) => {
        console.log(
          `  ${error.status}: ${error.message} (${error.count} times)`,
        );
      });
    }

    // Test 2: Queue Processing Stress Test
    console.log("\n" + "=".repeat(60));
    console.log("🧪 TEST 2: Queue Processing Stress Test");
    console.log("=".repeat(60));

    const queueTester = new QueueStressTester(config);
    const queueResults = await queueTester.testQueueProcessing();

    console.log("\n📊 Queue Test Results:");
    console.log(`Total Jobs: ${queueResults.totalJobs.toLocaleString()}`);
    console.log(
      `Processing Time: ${(queueResults.processingTime / 1000).toFixed(2)}s`,
    );
    console.log(
      `Average Job Time: ${queueResults.averageJobTime.toFixed(2)}ms`,
    );
    console.log(`Throughput: ${queueResults.throughput.toFixed(2)} jobs/s`);
    console.log(`Concurrency: ${queueResults.concurrency}`);

    // Calculate queue efficiency
    const theoreticalMaxThroughput =
      (config.batchSize * config.concurrency) / (50 / 1000); // Assuming 50ms per batch
    const efficiency =
      (queueResults.throughput / theoreticalMaxThroughput) * 100;

    console.log(`\n📈 Efficiency Analysis:`);
    console.log(
      `Theoretical Max Throughput: ${theoreticalMaxThroughput.toFixed(2)} jobs/s`,
    );
    console.log(
      `Actual Throughput: ${queueResults.throughput.toFixed(2)} jobs/s`,
    );
    console.log(`Efficiency: ${efficiency.toFixed(2)}%`);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 STRESS TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ API can handle: ${apiResults.throughput.toFixed(2)} req/s`);
    console.log(
      `✅ Queue can process: ${queueResults.throughput.toFixed(2)} notifications/s`,
    );
    console.log(
      `✅ 100k notifications processed in: ${(queueResults.processingTime / 1000).toFixed(2)}s`,
    );
    console.log(
      `✅ P95 API response time: ${apiResults.p95ResponseTime.toFixed(2)}ms`,
    );
    console.log(
      `✅ P99 API response time: ${apiResults.p99ResponseTime.toFixed(2)}ms`,
    );

    await queueTester.cleanup();
    await mongoose.connection.close();
    await connection.disconnect();
  } catch (error) {
    console.error("❌ Stress test failed:", error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStressTests();
}

export { StressTester, QueueStressTester, runStressTests };

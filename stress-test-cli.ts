#!/usr/bin/env node

import { Command } from "commander";
import { StressTester, QueueStressTester } from "./stress-test.js";
import {
  getScenario,
  listScenarios,
  validateScenario,
} from "./stress-test-configs.js";
import mongoose from "mongoose";
import { connection } from "./queue.js";
import dotenv from "dotenv";

dotenv.config();

// Type definitions for command options
interface ApiTestOptions {
  duration: string;
  rps: string;
  concurrency: string;
  url: string;
  key: string;
}

interface QueueTestOptions {
  size: string;
  batchSize: string; // Changed from 'batch-size' to batchSize
  concurrency: string;
}

interface FullTestOptions {
  duration: string;
  rps: string;
  size: string;
  batchSize: string; // Changed from 'batch-size' to batchSize
  concurrency: string;
  url: string;
  key: string;
}

const program = new Command();

program
  .name("stress-test")
  .description("CLI tool for stress testing the notifications API")
  .version("1.0.0");

// List Scenarios Command
program
  .command("scenarios")
  .description("List all available stress test scenarios")
  .action(() => {
    listScenarios();
  });

// API Stress Test Command
program
  .command("api")
  .description("Stress test the API endpoints")
  .option("-d, --duration <seconds>", "Test duration in seconds", "60")
  .option("-r, --rps <number>", "Requests per second", "100")
  .option("-c, --concurrency <number>", "Concurrent requests", "10")
  .option("-u, --url <url>", "API base URL", "http://localhost:3000")
  .option("-k, --key <key>", "API key for authentication", process.env.API_KEY)
  .action(async (options: ApiTestOptions) => {
    try {
      console.log("🚀 Starting API Stress Test...\n");

      const config = {
        apiUrl: options.url,
        apiKey: options.key,
        testDuration: parseInt(options.duration),
        requestsPerSecond: parseInt(options.rps),
        queueSize: 0, // Not used for API tests
        batchSize: 100,
        concurrency: parseInt(options.concurrency),
      };

      console.log("🔧 Configuration:", config);

      const tester = new StressTester(config);
      const results = await tester.testAPIEndpoints();

      console.log("\n📊 Results:");
      console.log(`Total Requests: ${results.totalRequests.toLocaleString()}`);
      console.log(`Successful: ${results.successfulRequests.toLocaleString()}`);
      console.log(`Failed: ${results.failedRequests.toLocaleString()}`);
      console.log(
        `Success Rate: ${((results.successfulRequests / results.totalRequests) * 100).toFixed(2)}%`,
      );
      console.log(`Throughput: ${results.throughput.toFixed(2)} req/s`);
      console.log(
        `Average Response Time: ${results.averageResponseTime.toFixed(2)}ms`,
      );
      console.log(`P95 Response Time: ${results.p95ResponseTime.toFixed(2)}ms`);
      console.log(`P99 Response Time: ${results.p99ResponseTime.toFixed(2)}ms`);
      console.log(`Min Response Time: ${results.minResponseTime.toFixed(2)}ms`);
      console.log(`Max Response Time: ${results.maxResponseTime.toFixed(2)}ms`);

      if (results.errors.length > 0) {
        console.log("\n❌ Errors:");
        results.errors.forEach((error) => {
          console.log(
            `  ${error.status}: ${error.message} (${error.count} times)`,
          );
        });
      }
    } catch (error) {
      console.error("❌ API stress test failed:", error);
      process.exit(1);
    }
  });

// Queue Stress Test Command
program
  .command("queue")
  .description("Stress test the queue processing")
  .option("-s, --size <number>", "Number of notifications to process", "100000")
  .option("-b, --batchSize <number>", "Batch size for processing", "100")
  .option("-c, --concurrency <number>", "Worker concurrency", "10")
  .action(async (options: QueueTestOptions) => {
    try {
      console.log("🚀 Starting Queue Stress Test...\n");

      // Connect to MongoDB and Redis
      await mongoose.connect(process.env.MONGO_URL!);
      console.log("✅ Connected to MongoDB");

      await connection.ping();
      console.log("✅ Connected to Redis");

      const config = {
        apiUrl: "http://localhost:3000",
        apiKey: process.env.API_KEY!,
        testDuration: 0, // Not used for queue tests
        requestsPerSecond: 0, // Not used for queue tests
        queueSize: parseInt(options.size),
        batchSize: parseInt(options.batchSize),
        concurrency: parseInt(options.concurrency),
      };

      console.log("🔧 Configuration:", config);

      const tester = new QueueStressTester(config);
      const results = await tester.testQueueProcessing();

      console.log("\n📊 Results:");
      console.log(`Total Jobs: ${results.totalJobs.toLocaleString()}`);
      console.log(
        `Processing Time: ${(results.processingTime / 1000).toFixed(2)}s`,
      );
      console.log(`Average Job Time: ${results.averageJobTime.toFixed(2)}ms`);
      console.log(`Throughput: ${results.throughput.toFixed(2)} jobs/s`);
      console.log(`Concurrency: ${results.concurrency}`);

      // Calculate efficiency
      const theoreticalMaxThroughput =
        (config.batchSize * config.concurrency) / (50 / 1000);
      const efficiency = (results.throughput / theoreticalMaxThroughput) * 100;

      console.log(`\n📈 Efficiency: ${efficiency.toFixed(2)}%`);
      console.log(
        `Theoretical Max: ${theoreticalMaxThroughput.toFixed(2)} jobs/s`,
      );

      await tester.cleanup();
      await mongoose.connection.close();
      await connection.disconnect();
    } catch (error) {
      console.error("❌ Queue stress test failed:", error);
      process.exit(1);
    }
  });

// Full Stress Test Command
program
  .command("full")
  .description("Run both API and queue stress tests")
  .option("-d, --duration <seconds>", "API test duration in seconds", "60")
  .option("-r, --rps <number>", "API requests per second", "100")
  .option("-s, --size <number>", "Queue test size", "100000")
  .option("-b, --batchSize <number>", "Queue batch size", "100")
  .option("-c, --concurrency <number>", "Concurrency for both tests", "10")
  .option("-u, --url <url>", "API base URL", "http://localhost:3000")
  .option("-k, --key <key>", "API key for authentication", process.env.API_KEY)
  .action(async (options: FullTestOptions) => {
    try {
      console.log("🚀 Starting Full Stress Test Suite...\n");

      // Connect to MongoDB and Redis
      await mongoose.connect(process.env.MONGO_URL!);
      console.log("✅ Connected to MongoDB");

      await connection.ping();
      console.log("✅ Connected to Redis");

      const config = {
        apiUrl: options.url,
        apiKey: options.key,
        testDuration: parseInt(options.duration),
        requestsPerSecond: parseInt(options.rps),
        queueSize: parseInt(options.size),
        batchSize: parseInt(options.batchSize),
        concurrency: parseInt(options.concurrency),
      };

      console.log("🔧 Configuration:", config);

      // Test 1: API Endpoint Stress Test
      console.log("\n" + "=".repeat(60));
      console.log("🧪 TEST 1: API Endpoint Stress Test");
      console.log("=".repeat(60));

      const apiTester = new StressTester(config);
      const apiResults = await apiTester.testAPIEndpoints();

      console.log("\n📊 API Test Results:");
      console.log(
        `Total Requests: ${apiResults.totalRequests.toLocaleString()}`,
      );
      console.log(
        `Successful: ${apiResults.successfulRequests.toLocaleString()}`,
      );
      console.log(`Failed: ${apiResults.failedRequests.toLocaleString()}`);
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
      console.log(`Throughput: ${queueResults.throughput.toFixed(2)} jobs/s`);

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("📋 STRESS TEST SUMMARY");
      console.log("=".repeat(60));
      console.log(
        `✅ API can handle: ${apiResults.throughput.toFixed(2)} req/s`,
      );
      console.log(
        `✅ Queue can process: ${queueResults.throughput.toFixed(2)} notifications/s`,
      );
      console.log(
        `✅ ${options.size} notifications processed in: ${(queueResults.processingTime / 1000).toFixed(2)}s`,
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
      console.error("❌ Full stress test failed:", error);
      process.exit(1);
    }
  });

// Scenario-based Test Command
program
  .command("scenario <name>")
  .description("Run a predefined stress test scenario")
  .action(async (name) => {
    try {
      const config = getScenario(name);
      if (!config) {
        console.error(`❌ Unknown scenario: ${name}`);
        console.log('Use "stress-test scenarios" to see available scenarios');
        process.exit(1);
      }

      const errors = validateScenario(config);
      if (errors.length > 0) {
        console.error("❌ Invalid scenario configuration:");
        errors.forEach((error) => console.error(`  - ${error}`));
        process.exit(1);
      }

      console.log(`🚀 Running scenario: ${name}\n`);

      // Connect to MongoDB and Redis
      await mongoose.connect(process.env.MONGO_URL!);
      console.log("✅ Connected to MongoDB");

      await connection.ping();
      console.log("✅ Connected to Redis");

      console.log("🔧 Configuration:", config);

      // Test 1: API Endpoint Stress Test
      console.log("\n" + "=".repeat(60));
      console.log("🧪 TEST 1: API Endpoint Stress Test");
      console.log("=".repeat(60));

      const apiTester = new StressTester(config);
      const apiResults = await apiTester.testAPIEndpoints();

      console.log("\n📊 API Test Results:");
      console.log(
        `Total Requests: ${apiResults.totalRequests.toLocaleString()}`,
      );
      console.log(
        `Successful: ${apiResults.successfulRequests.toLocaleString()}`,
      );
      console.log(`Failed: ${apiResults.failedRequests.toLocaleString()}`);
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
      console.log(`Throughput: ${queueResults.throughput.toFixed(2)} jobs/s`);

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("📋 STRESS TEST SUMMARY");
      console.log("=".repeat(60));
      console.log(
        `✅ API can handle: ${apiResults.throughput.toFixed(2)} req/s`,
      );
      console.log(
        `✅ Queue can process: ${queueResults.throughput.toFixed(2)} notifications/s`,
      );
      console.log(
        `✅ ${config.queueSize.toLocaleString()} notifications processed in: ${(queueResults.processingTime / 1000).toFixed(2)}s`,
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
      console.error("❌ Scenario test failed:", error);
      process.exit(1);
    }
  });

// Quick Test Command
program
  .command("quick")
  .description(
    "Quick test with default settings (30s API test, 10k queue test)",
  )
  .action(async () => {
    try {
      console.log("🚀 Starting Quick Stress Test...\n");

      // Connect to MongoDB and Redis
      await mongoose.connect(process.env.MONGO_URL!);
      console.log("✅ Connected to MongoDB");

      await connection.ping();
      console.log("✅ Connected to Redis");

      const config = {
        apiUrl: "http://localhost:3000",
        apiKey: process.env.API_KEY!,
        testDuration: 30,
        requestsPerSecond: 50,
        queueSize: 10000,
        batchSize: 100,
        concurrency: 5,
      };

      console.log("🔧 Configuration:", config);

      // Quick API test
      console.log("\n🧪 Quick API Test (30s, 50 req/s)...");
      const apiTester = new StressTester(config);
      const apiResults = await apiTester.testAPIEndpoints();

      console.log(
        `✅ API throughput: ${apiResults.throughput.toFixed(2)} req/s`,
      );
      console.log(
        `✅ P95 response time: ${apiResults.p95ResponseTime.toFixed(2)}ms`,
      );

      // Quick queue test
      console.log("\n🧪 Quick Queue Test (10k notifications)...");
      const queueTester = new QueueStressTester(config);
      const queueResults = await queueTester.testQueueProcessing();

      console.log(
        `✅ Queue throughput: ${queueResults.throughput.toFixed(2)} notifications/s`,
      );
      console.log(
        `✅ 10k notifications processed in: ${(queueResults.processingTime / 1000).toFixed(2)}s`,
      );

      await queueTester.cleanup();
      await mongoose.connection.close();
      await connection.disconnect();
    } catch (error) {
      console.error("❌ Quick stress test failed:", error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

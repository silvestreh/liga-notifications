import { StressTestConfig } from './stress-test.js';

export interface StressTestScenario {
  name: string;
  description: string;
  config: StressTestConfig;
}

export const stressTestScenarios: StressTestScenario[] = [
  {
    name: 'light',
    description: 'Light load testing - suitable for development environments',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 30,
      requestsPerSecond: 10,
      queueSize: 1000,
      batchSize: 50,
      concurrency: 2
    }
  },
  {
    name: 'medium',
    description: 'Medium load testing - suitable for staging environments',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 60,
      requestsPerSecond: 50,
      queueSize: 10000,
      batchSize: 100,
      concurrency: 5
    }
  },
  {
    name: 'heavy',
    description: 'Heavy load testing - suitable for production capacity planning',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 120,
      requestsPerSecond: 200,
      queueSize: 100000,
      batchSize: 100,
      concurrency: 10
    }
  },
  {
    name: 'extreme',
    description: 'Extreme load testing - stress test for maximum capacity',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 300,
      requestsPerSecond: 500,
      queueSize: 500000,
      batchSize: 100,
      concurrency: 20
    }
  },
  {
    name: 'burst',
    description: 'Burst load testing - test handling of sudden traffic spikes',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 30,
      requestsPerSecond: 1000,
      queueSize: 50000,
      batchSize: 100,
      concurrency: 50
    }
  },
  {
    name: 'endurance',
    description: 'Endurance testing - test sustained load over longer period',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 600,
      requestsPerSecond: 100,
      queueSize: 1000000,
      batchSize: 100,
      concurrency: 15
    }
  },
  {
    name: 'queue-focused',
    description: 'Queue processing focused test - minimal API load, maximum queue processing',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 10,
      requestsPerSecond: 5,
      queueSize: 1000000,
      batchSize: 100,
      concurrency: 25
    }
  },
  {
    name: 'api-focused',
    description: 'API endpoint focused test - maximum API load, minimal queue processing',
    config: {
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      testDuration: 180,
      requestsPerSecond: 1000,
      queueSize: 1000,
      batchSize: 100,
      concurrency: 100
    }
  }
];

export function getScenario(name: string): StressTestConfig | null {
  const scenario = stressTestScenarios.find(s => s.name === name);
  return scenario ? scenario.config : null;
}

export function listScenarios(): void {
  console.log('📋 Available Stress Test Scenarios:\n');
  stressTestScenarios.forEach(scenario => {
    console.log(`🔸 ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`   API: ${scenario.config.testDuration}s @ ${scenario.config.requestsPerSecond} req/s`);
    console.log(`   Queue: ${scenario.config.queueSize.toLocaleString()} notifications @ ${scenario.config.concurrency} workers`);
    console.log(`   Batch Size: ${scenario.config.batchSize}`);
    console.log('');
  });
}

export function validateScenario(config: StressTestConfig): string[] {
  const errors: string[] = [];

  if (config.testDuration <= 0) {
    errors.push('Test duration must be greater than 0');
  }

  if (config.requestsPerSecond <= 0) {
    errors.push('Requests per second must be greater than 0');
  }

  if (config.queueSize <= 0) {
    errors.push('Queue size must be greater than 0');
  }

  if (config.batchSize <= 0) {
    errors.push('Batch size must be greater than 0');
  }

  if (config.concurrency <= 0) {
    errors.push('Concurrency must be greater than 0');
  }

  if (config.requestsPerSecond > 10000) {
    errors.push('Requests per second should not exceed 10,000 (adjust concurrency instead)');
  }

  if (config.concurrency > 100) {
    errors.push('Concurrency should not exceed 100 (may cause resource exhaustion)');
  }

  return errors;
}

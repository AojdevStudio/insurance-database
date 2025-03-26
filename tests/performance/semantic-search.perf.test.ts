import { performance } from 'perf_hooks';
import { jest, describe, beforeAll, beforeEach, it, expect } from '@jest/globals';
import { searchGuidelines } from '../../src/utils/embeddings.js';

// Test data
const TEST_GUIDELINES = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  content: `Test guideline ${i + 1} with some meaningful content about insurance policies, coverage limits, and claim procedures.`
}));

const SEARCH_QUERIES = [
  'insurance policy coverage',
  'claim procedures',
  'policy limits',
  'insurance benefits',
  'coverage exclusions'
];

// Performance thresholds
const MAX_LATENCY = 2000; // ms
const MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100MB

describe('Semantic Search Performance Tests', () => {
  let initialMemory: number;

  beforeAll(() => {
    if (global.gc) {
      global.gc();
    }
    initialMemory = process.memoryUsage().heapUsed;
  });

  beforeEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  it('should perform semantic search within latency threshold', async () => {
    const latencies: number[] = [];

    for (const query of SEARCH_QUERIES) {
      const start = performance.now();
      await searchGuidelines(query);
      const end = performance.now();
      latencies.push(end - start);
    }

    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    expect(avgLatency).toBeLessThan(MAX_LATENCY);
  });

  it('should maintain reasonable memory usage during search', async () => {
    const start = process.memoryUsage().heapUsed;
    
    await Promise.all(SEARCH_QUERIES.map(query => 
      searchGuidelines(query)
    ));

    if (global.gc) {
      global.gc();
    }
    
    const end = process.memoryUsage().heapUsed;
    const memoryUsed = end - start;
    
    expect(memoryUsed).toBeLessThan(MAX_MEMORY_USAGE);
  });
}); 
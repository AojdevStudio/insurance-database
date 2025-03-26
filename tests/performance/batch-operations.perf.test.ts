import { performance } from 'perf_hooks';
import { jest, describe, beforeAll, beforeEach, it, expect } from '@jest/globals';
import { batchUpdateGuidelines } from '../../src/utils/embeddings.js';
import { getAverageLatency, getErrorRate } from '../../src/utils/monitoring.js';

// Test data generator
function generateTestGuidelines(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    content: `Test guideline ${i + 1} with detailed content about insurance policies, 
      coverage limits, claim procedures, and other relevant information. 
      This content is designed to test realistic embedding generation scenarios.`
  }));
}

// Performance thresholds
const MAX_LATENCY = 2000; // ms per request
const MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100MB
const BATCH_SIZES = [5, 10, 20];

describe('Batch Operations Performance Tests', () => {
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

  it('should handle batch updates within latency threshold', async () => {
    for (const size of BATCH_SIZES) {
      const batch = generateTestGuidelines(size);
      const start = performance.now();
      
      await batchUpdateGuidelines(batch);
      
      const end = performance.now();
      const totalTime = end - start;
      const avgTimePerRequest = totalTime / size;
      
      expect(avgTimePerRequest).toBeLessThan(MAX_LATENCY);
    }
  });

  it('should maintain reasonable memory usage during batch operations', async () => {
    const start = process.memoryUsage().heapUsed;
    
    for (const size of BATCH_SIZES) {
      const batch = generateTestGuidelines(size);
      await batchUpdateGuidelines(batch);
    }

    if (global.gc) {
      global.gc();
    }
    
    const end = process.memoryUsage().heapUsed;
    const memoryUsed = end - start;
    
    expect(memoryUsed).toBeLessThan(MAX_MEMORY_USAGE);
  });
});

// Performance thresholds
const MAX_BATCH_LATENCY = 2000; // ms per request
const MAX_ERROR_RATE = 0.05; // 5% maximum error rate
const MAX_MEMORY_PER_ITEM = 1 * 1024 * 1024; // 1MB per item
const CONCURRENT_LIMITS = [3, 5, 7, 10];

describe('Batch Operations Performance', () => {
  beforeAll(() => {
    // Set longer timeout for performance tests
    jest.setTimeout(30000);
  });

  describe('Concurrent Request Limits', () => {
    const BATCH_SIZES = [10, 20, 50];

    it.each(CONCURRENT_LIMITS)('should maintain performance with %i concurrent requests', async (concurrentLimit) => {
      for (const batchSize of BATCH_SIZES) {
        const guidelines = generateTestGuidelines(batchSize);
        const start = performance.now();

        const results = await batchUpdateGuidelines(guidelines, concurrentLimit);
        const totalTime = performance.now() - start;
        
        // Calculate metrics
        const avgTimePerRequest = totalTime / batchSize;
        const successRate = results.filter(r => r.success).length / results.length;
        
        console.log(`
Batch Size: ${batchSize}, Concurrent Limit: ${concurrentLimit}
Average time per request: ${avgTimePerRequest.toFixed(2)}ms
Success rate: ${(successRate * 100).toFixed(2)}%
        `);

        // Assertions
        expect(avgTimePerRequest).toBeLessThan(MAX_BATCH_LATENCY);
        expect(successRate).toBeGreaterThan(1 - MAX_ERROR_RATE);
      }
    });

    it('should optimize throughput based on concurrent limit', async () => {
      const batchSize = 30;
      const guidelines = generateTestGuidelines(batchSize);
      const results = new Map<number, number>();

      // Test different concurrent limits
      for (const limit of CONCURRENT_LIMITS) {
        const start = performance.now();
        await batchUpdateGuidelines(guidelines, limit);
        const totalTime = performance.now() - start;
        results.set(limit, totalTime);
      }

      // Log performance comparison
      console.log('\nThroughput Comparison:');
      for (const [limit, time] of results.entries()) {
        console.log(`Concurrent limit ${limit}: ${time.toFixed(2)}ms total, ${(time / batchSize).toFixed(2)}ms per request`);
      }
    });
  });

  describe('Memory Optimization', () => {
    const LARGE_BATCH_SIZES = [50, 100, 200];

    beforeEach(() => {
      if (global.gc) {
        global.gc();
      }
    });

    it('should process large batches with stable memory usage', async () => {
      for (const batchSize of LARGE_BATCH_SIZES) {
        const guidelines = generateTestGuidelines(batchSize);
        const initialMemory = process.memoryUsage().heapUsed;
        
        await batchUpdateGuidelines(guidelines);
        
        if (global.gc) {
          global.gc();
        }
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryPerItem = (finalMemory - initialMemory) / batchSize;
        
        console.log(`
Batch Size: ${batchSize}
Memory per item: ${(memoryPerItem / 1024 / 1024).toFixed(2)}MB
Total memory increase: ${((finalMemory - initialMemory) / 1024 / 1024).toFixed(2)}MB
        `);
        
        expect(memoryPerItem).toBeLessThan(MAX_MEMORY_PER_ITEM);
      }
    });

    it('should maintain performance with chunked processing', async () => {
      const batchSize = 100;
      const guidelines = generateTestGuidelines(batchSize);
      const chunkResults: number[] = [];
      let lastTimestamp = Date.now();
      
      // Monitor processing time for each chunk
      const results = await batchUpdateGuidelines(guidelines);
      
      for (let i = 0; i < results.length; i++) {
        if (i > 0 && i % 20 === 0) { // CHUNK_SIZE = 20
          const currentTime = Date.now();
          chunkResults.push(currentTime - lastTimestamp);
          lastTimestamp = currentTime;
        }
      }
      
      // Calculate statistics
      const avgChunkTime = chunkResults.reduce((a, b) => a + b, 0) / chunkResults.length;
      const maxChunkTime = Math.max(...chunkResults);
      const minChunkTime = Math.min(...chunkResults);
      
      console.log(`
Chunk Processing Statistics:
Average time per chunk: ${avgChunkTime.toFixed(2)}ms
Maximum chunk time: ${maxChunkTime.toFixed(2)}ms
Minimum chunk time: ${minChunkTime.toFixed(2)}ms
      `);
      
      // Verify performance consistency
      expect(maxChunkTime).toBeLessThan(avgChunkTime * 2); // No chunk should take more than 2x average
      expect(results.length).toBe(batchSize);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should release memory after processing each chunk', async () => {
      const batchSize = 150;
      const guidelines = generateTestGuidelines(batchSize);
      const memorySnapshots: number[] = [];
      
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      await batchUpdateGuidelines(guidelines);
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const totalIncrease = finalMemory - initialMemory;
      
      console.log(`
Memory Usage:
Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
Total Increase: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB
      `);
      
      // Memory increase should be reasonable
      expect(totalIncrease).toBeLessThan(batchSize * MAX_MEMORY_PER_ITEM);
    });
  });
});
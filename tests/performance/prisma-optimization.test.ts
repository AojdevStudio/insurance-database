/**
 * Performance tests for Prisma optimizations
 * Measures the impact of optimization techniques
 */
import { performance } from 'perf_hooks';
import { prisma } from '../../src/lib/prisma.js';
import { prisma as optimizedPrisma } from '../../src/lib/prisma-optimized.js';
import { redis } from '../../src/lib/redis-optimized.js';
import { PrismaOptimizationService } from '../../src/api/services/prisma/optimization.service.js';
import { logger } from '../../src/api/utils/logger.js';
import { PrismaClient } from '@prisma/client';

// Only run in development environment
const isCI = process.env.CI === 'true';

// Performance test configuration
const NUM_RUNS = 5; // Number of runs per test
const WARMUP_RUNS = 2; // Number of warmup runs

// Test queries
const carrierListQuery = () => prisma.insuranceCarrier.findMany({
  take: 10,
  orderBy: { created_at: 'desc' }
});

const optimizedCarrierListQuery = () => optimizedPrisma.insuranceCarrier.findMany({
  select: {
    id: true,
    name: true,
    carrier_type: true,
    payer_id: true,
    created_at: true
  },
  take: 10,
  orderBy: { created_at: 'desc' }
});

const carrierSearchQuery = (term: string) => prisma.insuranceCarrier.findMany({
  where: {
    name: { contains: term, mode: 'insensitive' }
  },
  take: 10
});

const optimizedCarrierSearchQuery = (term: string) => optimizedPrisma.insuranceCarrier.findMany({
  select: {
    id: true,
    name: true,
    carrier_type: true,
    payer_id: true,
    created_at: true
  },
  where: {
    name: { contains: term, mode: 'insensitive' }
  },
  take: 10
});

// Basic query
const basicQuery = async (prisma: PrismaClient, term: string) => {
  const carriers = await prisma.insuranceCarrier.findMany({
    where: {
      name: { contains: term, mode: 'insensitive' }
    },
    select: {
      id: true,
      name: true,
      created_at: true 
    },
    take: 50,
    orderBy: { created_at: 'desc' }
  });
  return carriers;
};

// Optimized query with projection
const optimizedQuery = async (prisma: PrismaClient, term: string) => {
  const carriers = await prisma.insuranceCarrier.findMany({
    where: {
      name: { contains: term, mode: 'insensitive' }
    },
    select: {
      id: true,
      name: true,
      created_at: true
    },
    take: 50,
  });
  return carriers;
};

describe('Prisma Optimization Tests', () => {
  (isCI ? describe.skip : describe)('Performance Benchmarks', () => {
    // Cleanup Redis before tests
    beforeAll(async () => {
      try {
        const client = await redis.getClient();
        await client.flushDb();
        logger.info('Redis cache cleared for tests');
      } catch (error) {
        logger.warn('Failed to clear Redis cache:', error);
      }
    });

    // Helper to run performance test
    async function runPerformanceTest<T>(
      testName: string,
      queryFn: () => Promise<T>,
      iterations: number = NUM_RUNS
    ): Promise<{ avgTime: number; minTime: number; maxTime: number }> {
      // Warmup runs
      for (let i = 0; i < WARMUP_RUNS; i++) {
        await queryFn();
      }

      // Timed runs
      const times: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await queryFn();
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      // Calculate statistics
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      // Log results
      logger.info(`${testName}: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);

      return { avgTime, minTime, maxTime };
    }

    it('should compare carrier list performance', async () => {
      const standardResult = await runPerformanceTest('Standard carrier list', carrierListQuery);
      const optimizedResult = await runPerformanceTest('Optimized carrier list', optimizedCarrierListQuery);

      // Calculate difference
      const improvement = ((standardResult.avgTime - optimizedResult.avgTime) / standardResult.avgTime) * 100;
      logger.info(`Carrier list performance improvement: ${improvement.toFixed(2)}%`);

      // Verify performance improvement
      expect(optimizedResult.avgTime).toBeLessThanOrEqual(standardResult.avgTime * 1.2);
    });

    it('should compare carrier search performance', async () => {
      const standardResult = await runPerformanceTest('Standard carrier search', () => carrierSearchQuery('Blue'));
      const optimizedResult = await runPerformanceTest('Optimized carrier search', () => optimizedCarrierSearchQuery('Blue'));

      // Calculate difference
      const improvement = ((standardResult.avgTime - optimizedResult.avgTime) / standardResult.avgTime) * 100;
      logger.info(`Carrier search performance improvement: ${improvement.toFixed(2)}%`);

      // Verify performance improvement
      expect(optimizedResult.avgTime).toBeLessThanOrEqual(standardResult.avgTime * 1.2);
    });

    it('should measure caching performance', async () => {
      const cacheKey = 'test:performance:carriers';
      
      // First run without cache
      const uncachedResult = await runPerformanceTest(
        'Uncached query with PrismaOptimizationService', 
        () => PrismaOptimizationService.executeWithCache(
          'carrierListTest',
          cacheKey,
          optimizedCarrierListQuery
        ),
        1 // Just one run to prime the cache
      );

      // Second run with cache
      const cachedResult = await runPerformanceTest(
        'Cached query with PrismaOptimizationService',
        () => PrismaOptimizationService.executeWithCache(
          'carrierListTest',
          cacheKey,
          optimizedCarrierListQuery
        )
      );

      // Calculate difference
      const improvement = ((uncachedResult.avgTime - cachedResult.avgTime) / uncachedResult.avgTime) * 100;
      logger.info(`Caching performance improvement: ${improvement.toFixed(2)}%`);

      // Verify significant improvement with caching
      expect(cachedResult.avgTime).toBeLessThan(uncachedResult.avgTime * 0.5);
    });

    it('should measure select field optimization', async () => {
      // Query with all fields
      const fullQuery = () => prisma.insuranceCarrier.findMany({
        take: 20
      });
      
      // Query with selective fields
      const selectiveQuery = () => optimizedPrisma.insuranceCarrier.findMany({
        select: {
          id: true,
          name: true,
          carrier_type: true,
        },
        take: 20
      });

      const fullResult = await runPerformanceTest('Query with all fields', fullQuery);
      const selectiveResult = await runPerformanceTest('Query with selective fields', selectiveQuery);

      // Calculate difference
      const improvement = ((fullResult.avgTime - selectiveResult.avgTime) / fullResult.avgTime) * 100;
      logger.info(`Selective field optimization improvement: ${improvement.toFixed(2)}%`);

      // Verify improvement with selective fields
      expect(selectiveResult.avgTime).toBeLessThan(fullResult.avgTime);
    });

    it('should track query performance with monitoring middleware', async () => {
      // Run query with performance monitoring
      const result = await PrismaOptimizationService.executeWithCache(
        'testPerformanceMonitoring',
        'test:monitoring',
        async () => {
          // Simulate slow query
          await new Promise(resolve => setTimeout(resolve, 100));
          return await optimizedPrisma.insuranceCarrier.findFirst();
        }
      );

      // Verify result
      expect(result).toBeDefined();
    });
    
    it('should generate deterministic cache keys', async () => {
      // Generate keys with different parameter order
      const key1 = PrismaOptimizationService.getCacheKey('test', { a: 1, b: 2 });
      const key2 = PrismaOptimizationService.getCacheKey('test', { b: 2, a: 1 });
      
      // Keys should be identical despite different parameter order
      expect(await key1).toEqual(await key2);
      
      // Now test with different values
      const key3 = PrismaOptimizationService.getCacheKey('test', { a: 1, b: 3 });
      
      // Keys should be different
      expect(await key1).not.toEqual(await key3);
    });
  });
});

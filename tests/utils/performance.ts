import { performance } from 'perf_hooks';

/**
 * Interface for performance test results
 */
interface PerformanceResult {
  operationName: string;
  duration: number;
  success: boolean;
  error?: Error;
}

/**
 * Options for performance measurement
 */
interface MeasureOptions {
  name: string;
  maxDuration?: number;
  warmupRuns?: number;
}

/**
 * Measures the execution time of an async operation
 * @param operation Function to measure
 * @param options Measurement options
 * @returns Performance measurement result
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  options: MeasureOptions
): Promise<PerformanceResult> {
  // Perform warmup runs if specified
  if (options.warmupRuns) {
    for (let i = 0; i < options.warmupRuns; i++) {
      await operation();
    }
  }

  const start = performance.now();
  try {
    await operation();
    const duration = performance.now() - start;
    
    return {
      operationName: options.name,
      duration,
      success: options.maxDuration ? duration <= options.maxDuration : true
    };
  } catch (error) {
    return {
      operationName: options.name,
      duration: performance.now() - start,
      success: false,
      error: error as Error
    };
  }
}

/**
 * Generates test data for performance testing
 */
export class TestDataGenerator {
  /**
   * Generates an array of test guidelines
   * @param count Number of guidelines to generate
   * @returns Array of test guidelines
   */
  static generateGuidelines(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      content: `Test guideline ${i + 1} with some additional content for embedding generation. This should provide enough context for meaningful embeddings.`
    }));
  }

  /**
   * Generates a test search query
   * @returns Search query string
   */
  static generateSearchQuery(): string {
    return 'Test guideline with specific insurance coverage details';
  }
}

/**
 * Performance test assertion utilities
 */
export class PerformanceAssert {
  /**
   * Asserts that an operation completed within the specified time
   * @param result Performance test result
   * @param maxDuration Maximum allowed duration in milliseconds
   */
  static completedWithinTime(result: PerformanceResult, maxDuration: number) {
    if (!result.success || result.duration > maxDuration) {
      throw new Error(
        `Performance test "${result.operationName}" failed: ` +
        `Duration ${result.duration}ms exceeded limit of ${maxDuration}ms` +
        (result.error ? `\nError: ${result.error.message}` : '')
      );
    }
  }

  /**
   * Asserts that concurrent operations were properly rate limited
   * @param results Array of performance test results
   * @param maxConcurrent Maximum allowed concurrent operations
   * @param totalDuration Total duration of all operations
   */
  static concurrencyLimited(
    results: PerformanceResult[],
    maxConcurrent: number,
    totalDuration: number
  ) {
    const avgDuration = totalDuration / maxConcurrent;
    const minExpectedTotal = avgDuration * (results.length / maxConcurrent);
    
    const actualTotal = Math.max(...results.map(r => r.duration));
    
    if (actualTotal < minExpectedTotal * 0.9) { // Allow 10% margin
      throw new Error(
        `Rate limiting may not be working: Operations completed too quickly. ` +
        `Expected minimum ${minExpectedTotal}ms, but took ${actualTotal}ms`
      );
    }
  }
} 
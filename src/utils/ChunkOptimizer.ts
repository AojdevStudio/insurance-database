/**
 * Optimization options
 */
export interface OptimizationOptions {
  targetChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  overlapSize: number;
  memoryLimit?: number;
  processingTimeLimit?: number;
  customRules?: OptimizationRule[];
}

/**
 * Optimization metrics
 */
export interface OptimizationMetrics {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  processingTime: number;
  memoryUsage: number;
  averageChunkSize: number;
  contentQuality: number;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  chunks: string[];
  metrics: OptimizationMetrics;
  metadata: Record<string, unknown>;
}

/**
 * Optimization rule interface
 */
export interface OptimizationRule {
  name: string;
  priority: number;
  optimize: (chunks: string[], options: OptimizationOptions) => OptimizationResult;
  validate: (result: OptimizationResult, options: OptimizationOptions) => boolean;
}

/**
 * Built-in size optimization rule
 */
export class SizeOptimizationRule implements OptimizationRule {
  name = 'size';
  priority = 100;

  optimize(chunks: string[], options: OptimizationOptions): OptimizationResult {
    const startTime = performance.now();
    const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const optimizedChunks: string[] = [];
    let currentChunk = '';

    // Process each chunk
    for (const chunk of chunks) {
      if (currentChunk.length + chunk.length <= options.targetChunkSize) {
        // Add to current chunk if within target size
        currentChunk += (currentChunk ? ' ' : '') + chunk;
      } else {
        // Save current chunk and start new one
        if (currentChunk) {
          optimizedChunks.push(currentChunk);
        }
        currentChunk = chunk;
      }
    }

    // Add final chunk
    if (currentChunk) {
      optimizedChunks.push(currentChunk);
    }

    // Calculate metrics
    const optimizedSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const processingTime = performance.now() - startTime;
    const memoryUsage = process.memoryUsage().heapUsed;

    return {
      chunks: optimizedChunks,
      metrics: {
        originalSize,
        optimizedSize,
        compressionRatio: optimizedSize / originalSize,
        processingTime,
        memoryUsage,
        averageChunkSize: optimizedSize / optimizedChunks.length,
        contentQuality: 1.0 // Base quality score
      },
      metadata: {
        rule: 'size',
        parameters: {
          targetSize: options.targetChunkSize
        }
      }
    };
  }

  validate(result: OptimizationResult, options: OptimizationOptions): boolean {
    return result.chunks.every(chunk =>
      chunk.length >= options.minChunkSize &&
      chunk.length <= options.maxChunkSize
    );
  }
}

/**
 * Built-in memory optimization rule
 */
export class MemoryOptimizationRule implements OptimizationRule {
  name = 'memory';
  priority = 90;

  optimize(chunks: string[], options: OptimizationOptions): OptimizationResult {
    const startTime = performance.now();
    const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const optimizedChunks: string[] = [];
    let memoryUsed = process.memoryUsage().heapUsed;

    // Process chunks in batches to control memory usage
    const batchSize = Math.max(1, Math.floor(chunks.length / 10));
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const processedBatch = this.processBatch(batch, options);
      optimizedChunks.push(...processedBatch);

      // Check memory limit
      const currentMemory = process.memoryUsage().heapUsed;
      if (options.memoryLimit && currentMemory > options.memoryLimit) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }

    // Calculate metrics
    const optimizedSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const processingTime = performance.now() - startTime;
    const finalMemoryUsage = process.memoryUsage().heapUsed;

    return {
      chunks: optimizedChunks,
      metrics: {
        originalSize,
        optimizedSize,
        compressionRatio: optimizedSize / originalSize,
        processingTime,
        memoryUsage: finalMemoryUsage,
        averageChunkSize: optimizedSize / optimizedChunks.length,
        contentQuality: 0.9 // Slightly reduced due to memory optimization
      },
      metadata: {
        rule: 'memory',
        parameters: {
          batchSize,
          memoryUsed: finalMemoryUsage - memoryUsed
        }
      }
    };
  }

  private processBatch(batch: string[], options: OptimizationOptions): string[] {
    // Simple batch processing - combine small chunks
    const processed: string[] = [];
    let current = '';

    for (const chunk of batch) {
      if (current.length + chunk.length <= options.targetChunkSize) {
        current += (current ? ' ' : '') + chunk;
      } else {
        if (current) {
          processed.push(current);
        }
        current = chunk;
      }
    }

    if (current) {
      processed.push(current);
    }

    return processed;
  }

  validate(result: OptimizationResult, options: OptimizationOptions): boolean {
    if (!options.memoryLimit) {
      return true;
    }
    return result.metrics.memoryUsage <= options.memoryLimit;
  }
}

/**
 * Built-in speed optimization rule
 */
export class SpeedOptimizationRule implements OptimizationRule {
  name = 'speed';
  priority = 80;

  optimize(chunks: string[], options: OptimizationOptions): OptimizationResult {
    const startTime = performance.now();
    const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    
    // Fast optimization - minimal processing
    const optimizedChunks = chunks.map(chunk => {
      // Simple truncation if exceeds max size
      if (chunk.length > options.maxChunkSize) {
        return chunk.slice(0, options.maxChunkSize);
      }
      return chunk;
    });

    const processingTime = performance.now() - startTime;
    const optimizedSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.length, 0);

    return {
      chunks: optimizedChunks,
      metrics: {
        originalSize,
        optimizedSize,
        compressionRatio: optimizedSize / originalSize,
        processingTime,
        memoryUsage: process.memoryUsage().heapUsed,
        averageChunkSize: optimizedSize / optimizedChunks.length,
        contentQuality: 0.8 // Reduced due to potential truncation
      },
      metadata: {
        rule: 'speed',
        parameters: {
          processingTime
        }
      }
    };
  }

  validate(result: OptimizationResult, options: OptimizationOptions): boolean {
    if (!options.processingTimeLimit) {
      return true;
    }
    return result.metrics.processingTime <= options.processingTimeLimit;
  }
}

/**
 * Main chunk optimizer class
 */
export class ChunkOptimizer {
  private rules: OptimizationRule[] = [];

  constructor(private options: OptimizationOptions) {
    // Initialize with default rules if no custom rules provided
    if (!options.customRules || options.customRules.length === 0) {
      this.rules = [
        new SizeOptimizationRule(),
        new MemoryOptimizationRule(),
        new SpeedOptimizationRule()
      ];
    } else {
      this.rules = [...options.customRules].sort((a, b) => b.priority - a.priority);
    }

    this.validateOptions();
  }

  /**
   * Validates optimization options
   */
  private validateOptions(): void {
    const { targetChunkSize, minChunkSize, maxChunkSize } = this.options;

    if (targetChunkSize < minChunkSize || targetChunkSize > maxChunkSize) {
      throw new Error('Target chunk size must be between min and max chunk size');
    }

    if (minChunkSize < 0 || maxChunkSize < 0 || targetChunkSize < 0) {
      throw new Error('Chunk sizes cannot be negative');
    }

    if (this.options.overlapSize < 0) {
      throw new Error('Overlap size cannot be negative');
    }
  }

  /**
   * Optimizes chunks using configured rules
   * @param chunks Array of chunks to optimize
   * @returns Optimization result
   */
  optimize(chunks: string[]): OptimizationResult {
    const startTime = performance.now();
    let currentChunks = [...chunks];
    let bestResult: OptimizationResult | null = null;

    // Apply each rule in priority order
    for (const rule of this.rules) {
      const result = rule.optimize(currentChunks, this.options);

      // Validate result
      if (!rule.validate(result, this.options)) {
        continue;
      }

      // Update current chunks and track best result
      currentChunks = result.chunks;
      if (!bestResult || this.isBetterResult(result, bestResult)) {
        bestResult = result;
      }
    }

    if (!bestResult) {
      // If no optimization was successful, return original chunks with metrics
      return this.createBaseResult(chunks, startTime);
    }

    return bestResult;
  }

  /**
   * Creates a base result with minimal optimization
   * @param chunks Original chunks
   * @param startTime Optimization start time
   * @returns Base optimization result
   */
  private createBaseResult(chunks: string[], startTime: number): OptimizationResult {
    const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    
    return {
      chunks,
      metrics: {
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        processingTime: performance.now() - startTime,
        memoryUsage: process.memoryUsage().heapUsed,
        averageChunkSize: originalSize / chunks.length,
        contentQuality: 1.0
      },
      metadata: {
        optimizationStatus: 'none'
      }
    };
  }

  /**
   * Compares two optimization results
   * @param newResult New optimization result
   * @param currentBest Current best result
   * @returns Whether new result is better
   */
  private isBetterResult(newResult: OptimizationResult, currentBest: OptimizationResult): boolean {
    // Define weights for different metrics
    const weights = {
      compressionRatio: 0.3,
      processingTime: 0.2,
      memoryUsage: 0.2,
      contentQuality: 0.3
    };

    // Calculate weighted scores
    const newScore =
      weights.compressionRatio * (1 / newResult.metrics.compressionRatio) +
      weights.processingTime * (1 / newResult.metrics.processingTime) +
      weights.memoryUsage * (1 / newResult.metrics.memoryUsage) +
      weights.contentQuality * newResult.metrics.contentQuality;

    const currentScore =
      weights.compressionRatio * (1 / currentBest.metrics.compressionRatio) +
      weights.processingTime * (1 / currentBest.metrics.processingTime) +
      weights.memoryUsage * (1 / currentBest.metrics.memoryUsage) +
      weights.contentQuality * currentBest.metrics.contentQuality;

    return newScore > currentScore;
  }

  /**
   * Adds a new optimization rule
   * @param rule Rule to add
   */
  addRule(rule: OptimizationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Removes an optimization rule
   * @param ruleName Name of rule to remove
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
  }
} 
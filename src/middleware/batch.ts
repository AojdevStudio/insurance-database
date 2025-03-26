import { Request, Response, NextFunction } from 'express';
import { BatchService } from '../services/batch.service.js';
import { Logger } from '../utils/logging.js';

export interface BatchConfig {
  maxBatchSize?: number;
  maxWaitTime?: number;
  batchableEndpoints: string[];
  batchKeyGenerator?: (req: Request) => string;
  errorHandler?: (error: Error) => void;
}

interface BatchItem {
  request: Request;
  response: Response;
  next: NextFunction;
  timestamp: number;
  key: string;
}

interface BatchResult {
  data: any;
}

const DEFAULT_CONFIG: Partial<BatchConfig> = {
  maxBatchSize: 10,
  maxWaitTime: 50
};

const logger = new Logger('batch-middleware');

export function batchMiddleware(
  batchService: BatchService<BatchItem, BatchResult>,
  config: BatchConfig
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if not a batchable endpoint
      if (!finalConfig.batchableEndpoints.includes(req.path)) {
        return next();
      }

      // Generate batch key
      const key = finalConfig.batchKeyGenerator
        ? finalConfig.batchKeyGenerator(req)
        : req.originalUrl;

      // Create batch item
      const item: BatchItem = {
        request: req,
        response: res,
        next,
        timestamp: Date.now(),
        key
      };

      // Add to batch
      await batchService.addToBatch(key, item);

      // Get current batch size
      const batchSize = batchService.getBatchSize(key);

      // Process batch if max size reached
      if (batchSize >= finalConfig.maxBatchSize!) {
        await processBatch(key, next);
        return;
      }

      // Set timer for first request in batch
      if (batchSize === 1) {
        setTimeout(async () => {
          await processBatch(key, next);
        }, finalConfig.maxWaitTime);
      }
    } catch (error) {
      handleError(error as Error, next);
    }
  };

  async function processBatch(key: string, next: NextFunction) {
    try {
      // Get batch items
      const items = batchService.getBatchItems(key);
      if (!items.length) return;

      // Process batch
      const results = await batchService.processBatch(items);

      // Send responses
      items.forEach((item, index) => {
        const result = results[index];
        item.response.json(result.data);
      });

      // Clear batch
      await batchService.clearBatch(key);

      // Track metrics
      trackBatchMetrics(key, items.length);
    } catch (error) {
      handleError(error as Error, next);
    }
  }

  function handleError(error: Error, next: NextFunction) {
    if (finalConfig.errorHandler) {
      finalConfig.errorHandler(error);
    }
    logger.error('Batch processing error', error);
    next(error);
  }

  function trackBatchMetrics(key: string, size: number) {
    logger.debug('Batch metrics', {
      key,
      size,
      timestamp: Date.now()
    });
  }
} 
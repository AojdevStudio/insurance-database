/// <reference types="node" />
import { Buffer } from 'buffer';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';

export interface MonitoringConfig {
  excludePaths?: string[];
  sampleRate?: number;
  enableSizeTracking?: boolean;
  enableCacheTracking?: boolean;
  enableBatchTracking?: boolean;
}

const DEFAULT_CONFIG: Required<MonitoringConfig> = {
  excludePaths: [],
  sampleRate: 1.0,
  enableSizeTracking: true,
  enableCacheTracking: true,
  enableBatchTracking: true
};

const logger = new Logger('monitoring-middleware');

export function monitoringMiddleware(config: MonitoringConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (finalConfig.excludePaths.includes(req.path)) {
      return next();
    }

    // Apply sampling rate
    if (Math.random() > finalConfig.sampleRate) {
      return next();
    }

    const startTime = process.hrtime();
    const startMemory = process.memoryUsage();

    // Track request size if enabled
    if (finalConfig.enableSizeTracking) {
      trackRequestSize(req);
    }

    // Wrap response methods to track metrics
    wrapResponseMethods(res, finalConfig);

    // Continue request processing
    next();

    // Track response time on finish
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      const memoryDiff = getMemoryDiff(startMemory);

      trackRequestMetrics(async () => {
        logger.debug('Request metrics', {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          memory: memoryDiff,
          timestamp: Date.now()
        });
      }, 'request-metrics');
    });
  };
}

function trackRequestSize(req: Request) {
  const size = req.headers['content-length'] 
    ? parseInt(req.headers['content-length'], 10)
    : Buffer.from(JSON.stringify(req.body)).length;

  trackRequestMetrics(async () => {
    logger.debug('Request size', {
      path: req.path,
      method: req.method,
      size,
      timestamp: Date.now()
    });
  }, 'request-size');
}

function wrapResponseMethods(res: Response, config: Required<MonitoringConfig>) {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Wrap json method
  res.json = function(body: any) {
    if (config.enableSizeTracking) {
      const size = Buffer.from(JSON.stringify(body)).length;
      trackRequestMetrics(async () => {
        logger.debug('Response size', {
          size,
          type: 'json',
          timestamp: Date.now()
        });
      }, 'response-size');
    }

    return originalJson(body);
  };

  // Wrap send method
  res.send = function(body: any) {
    if (config.enableSizeTracking) {
      const size = typeof body === 'string' 
        ? Buffer.from(body).length
        : Buffer.from(JSON.stringify(body)).length;

      trackRequestMetrics(async () => {
        logger.debug('Response size', {
          size,
          type: typeof body,
          timestamp: Date.now()
        });
      }, 'response-size');
    }

    return originalSend(body);
  };

  // Track cache metrics if enabled
  if (config.enableCacheTracking) {
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = function(name: string, value: any) {
      if (name.toLowerCase() === 'x-cache') {
        trackRequestMetrics(async () => {
          logger.debug('Cache metrics', {
            hit: value === 'HIT',
            timestamp: Date.now()
          });
        }, 'cache-metrics');
      }
      return originalSetHeader(name, value);
    };
  }
}

interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

function getMemoryDiff(startMemory: MemoryUsage): Record<string, number> {
  const endMemory = process.memoryUsage();
  return {
    heapUsed: endMemory.heapUsed - startMemory.heapUsed,
    heapTotal: endMemory.heapTotal - startMemory.heapTotal,
    external: endMemory.external - startMemory.external,
    rss: endMemory.rss - startMemory.rss
  };
} 
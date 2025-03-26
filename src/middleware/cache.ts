import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis.service.js';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';
import crypto from 'crypto';

const logger = new Logger('cache-middleware');

interface CachedResponseData {
  body: any;
  status: number;
  headers: Record<string, string | number | string[]>;
}

export interface CacheConfig {
  ttl?: number;
  prefix?: string;
  exclude?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  cacheControl?: string;
  staleWhileRevalidate?: number;
  staleIfError?: number;
}

const defaultConfig: Required<CacheConfig> = {
  ttl: 3600, // 1 hour default TTL
  prefix: 'api:cache:',
  exclude: (req) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return true;
    }

    // Skip caching for certain paths
    const skipPaths = ['/health', '/metrics', '/favicon.ico'];
    if (skipPaths.includes(req.path)) {
      return true;
    }

    // Skip caching for authenticated requests
    if (req.headers.authorization) {
      return true;
    }

    return false;
  },
  keyGenerator: (req) => {
    // Generate cache key based on URL and query parameters
    const url = req.originalUrl || req.url || '';
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    return hash;
  },
  cacheControl: 'public, max-age=3600',
  staleWhileRevalidate: 300, // 5 minutes
  staleIfError: 14400 // 4 hours
};

export function cacheMiddleware(redisService: RedisService, config: CacheConfig = {}) {
  const options: Required<CacheConfig> = { ...defaultConfig, ...config };

  return async function cache(req: Request, res: Response, next: NextFunction) {
    // Skip caching if configured to do so
    if (options.exclude(req)) {
      return next();
    }

    const cacheKey = `${options.prefix}${options.keyGenerator(req)}`;

    try {
      // Try to get cached response
      const cachedResponse = await redisService.get(cacheKey);
      
      if (cachedResponse) {
        const parsed = JSON.parse(cachedResponse.toString()) as CachedResponseData;
        
        // Set cache control headers
        res.setHeader('Cache-Control', options.cacheControl);
        res.setHeader('X-Cache', 'HIT');
        
        // Set response headers
        Object.entries(parsed.headers).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        });

        // Track cache hit
        trackRequestMetrics(async () => {
          logger.debug('Cache hit', { key: cacheKey });
        }, 'cache-hit');

        // Send cached response
        return res.status(parsed.status).send(parsed.body);
      }

      // Cache miss - capture the response
      const originalSend = res.send;
      res.send = function (body: any) {
        const responseData: CachedResponseData = {
          body,
          status: res.statusCode,
          headers: res.getHeaders() as Record<string, string | number | string[]>
        };

        // Store in cache if response is successful
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisService.set(cacheKey, JSON.stringify(responseData), options.ttl)
            .catch(err => {
              if (err instanceof Error) {
                logger.error('Failed to cache response:', err);
              } else {
                logger.error('Failed to cache response:', new Error(String(err)));
              }
            });
          
          // Track cache miss
          trackRequestMetrics(async () => {
            logger.debug('Cache miss', { key: cacheKey });
          }, 'cache-miss');
        }

        // Set cache control headers
        res.setHeader('Cache-Control', options.cacheControl);
        res.setHeader('X-Cache', 'MISS');

        // Send the actual response
        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Cache error:', error);
      } else {
        logger.error('Cache error:', new Error(String(error)));
      }
      // Continue without caching on error
      next();
    }
  };
} 
import { Request, Response, NextFunction } from 'express';
import { RateLimitService } from '../../services/rateLimit.service.js';
import { RateLimitError } from '../../errors/rateLimit.error.js';
import { AuthenticatedRequest } from './auth.js';
import { logger } from '../../utils/logger.js';

/**
 * Middleware to enforce rate limits based on API key permissions
 */
export function rateLimit(rateLimitService: RateLimitService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      
      if (!authenticatedReq.apiKey) {
        // Should never happen as auth middleware should run first
        throw new Error('API key not found in request');
      }

      const result = await rateLimitService.checkRateLimit(
        authenticatedReq.apiKey.id,
        authenticatedReq.apiKey.permissions.rateLimits
      );

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetAt.getTime().toString());

      if (!result.isAllowed) {
        throw new RateLimitError(
          `Rate limit exceeded. Try again after ${result.resetAt.toISOString()}`
        );
      }

      next();
    } catch (error) {
      logger.error('Rate limit check failed', { error });
      next(error);
    }
  };
} 
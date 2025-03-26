import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../../services/apiKey.service.js';
import { AuthenticationError } from '../../errors/authentication.error.js';
import { logger } from '../../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    id: string;
    permissions: {
      allowedEndpoints: string[];
      rateLimits: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
      };
    };
  };
}

/**
 * Middleware to validate API key authentication
 */
export function validateApiKey(apiKeyService: ApiKeyService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.header('X-API-Key');
      
      if (!apiKey) {
        throw new AuthenticationError('API key is required');
      }

      const validation = await apiKeyService.validateKey(apiKey);
      
      if (!validation.isValid || !validation.keyId || !validation.permissions) {
        throw new AuthenticationError('Invalid API key');
      }

      // Check endpoint permissions
      const endpoint = req.path;
      if (!validation.permissions.allowedEndpoints.includes('*') &&
          !validation.permissions.allowedEndpoints.includes(endpoint)) {
        throw new AuthenticationError('API key does not have permission for this endpoint');
      }

      // Add API key info to request for downstream use
      (req as AuthenticatedRequest).apiKey = {
        id: validation.keyId,
        permissions: validation.permissions
      };

      next();
    } catch (error) {
      logger.error('API key validation failed', { error });
      next(error);
    }
  };
} 
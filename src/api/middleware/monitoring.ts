import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../../services/auditLog.service.js';
import { AuthenticatedRequest } from './auth.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to monitor API usage and performance
 */
export function monitor(auditLogService: AuditLogService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = uuidv4();
    const startTime = process.hrtime();

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    // Capture response data
    const originalSend = res.send;
    res.send = function(body) {
      const hrTime = process.hrtime(startTime);
      const durationInMs = hrTime[0] * 1000 + hrTime[1] / 1000000;

      // Log request details
      const authenticatedReq = req as AuthenticatedRequest;
      if (authenticatedReq.apiKey) {
        auditLogService.logRequest({
          keyId: authenticatedReq.apiKey.id,
          endpoint: req.path,
          requestMethod: req.method,
          responseStatus: res.statusCode,
          clientIp: req.ip || 'unknown',
          userAgent: req.get('user-agent') ?? 'unknown',
          requestId,
          requestDurationMs: Math.round(durationInMs)
        }).catch(error => {
          logger.error('Failed to log API request', { error, requestId });
        });
      }

      // Add timing header
      res.setHeader('X-Response-Time', `${Math.round(durationInMs)}ms`);

      // Call original send
      return originalSend.call(this, body);
    };

    next();
  };
} 
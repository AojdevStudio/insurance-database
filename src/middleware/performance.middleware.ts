/**
 * Performance Middleware
 * 
 * Middleware for measuring performance of API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PerformanceMonitorService } from '../services/performance-monitor.service';
import { FeatureFlagService } from '../services/feature-flag.service';

/**
 * Generate a unique request ID
 * @returns Request ID
 */
const generateRequestId = (): string => {
  return uuidv4();
};

/**
 * Add request ID to request object
 */
export const addRequestId = (req: Request, res: Response, next: NextFunction): void => {
  // Generate a unique request ID if not already present
  if (!req.headers['x-request-id']) {
    const requestId = generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
  }
  
  next();
};

/**
 * Measure performance of an API endpoint
 * @param operationName - Name of the operation being measured
 */
export const measurePerformance = (operationName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get request ID
    const requestId = req.headers['x-request-id'] as string;
    
    // Start timer
    const start = process.hrtime();
    
    // Store the original end method
    const originalEnd = res.end;
    
    // Override the end method
    res.end = function(...args) {
      // Calculate duration
      const end = process.hrtime(start);
      const duration = (end[0] * 1000) + (end[1] / 1000000); // Convert to ms
      
      // Determine which implementation was used
      const implementationType = FeatureFlagService.isEnabled('usePrisma', requestId) ? 'prisma' : 'old';
      
      // Record the metric
      PerformanceMonitorService.recordMetric(
        `${operationName}_${implementationType}`,
        duration,
        requestId,
        {
          statusCode: res.statusCode,
          method: req.method,
          path: req.path,
          query: req.query
        }
      );
      
      // Call the original end method
      return originalEnd.apply(this, args);
    };
    
    next();
  };
};

/**
 * Clear request-specific feature flags after request is complete
 */
export const clearRequestFlags = (req: Request, res: Response, next: NextFunction): void => {
  // Get request ID
  const requestId = req.headers['x-request-id'] as string;
  
  // Store the original end method
  const originalEnd = res.end;
  
  // Override the end method
  res.end = function(...args) {
    // Clear request-specific feature flags
    FeatureFlagService.clearRequestFlags(requestId);
    
    // Call the original end method
    return originalEnd.apply(this, args);
  };
  
  next();
};

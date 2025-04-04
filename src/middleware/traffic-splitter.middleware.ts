/**
 * Traffic Splitter Middleware
 * 
 * Middleware for splitting traffic between old and new implementations
 */

import { Request, Response, NextFunction } from 'express';
import { FeatureFlagService } from '../services/feature-flag.service';
import { RollbackService } from '../services/rollback.service';
import { logger } from '../api/utils/logger';

/**
 * Split traffic between old and new implementations
 */
export const splitTraffic = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get request ID
    const requestId = req.headers['x-request-id'] as string;
    
    if (!requestId) {
      logger.warn('No request ID found for traffic splitting');
      next();
      return;
    }
    
    // Get current phase and traffic percentage
    const trafficPercentage = RollbackService.getCurrentTrafficPercentage();
    
    // Determine if this request should use Prisma
    const shouldUsePrisma = Math.random() * 100 < trafficPercentage;
    
    // Set the feature flag for this request
    FeatureFlagService.setRequestFlag(requestId, 'usePrisma', shouldUsePrisma);
    
    // Apply phase-specific feature flags
    const phaseFlags = RollbackService.getAllPhases()[RollbackService.getCurrentPhase()].featureFlags;
    for (const [flag, value] of Object.entries(phaseFlags)) {
      // Only set the flag if it's enabled in the phase configuration
      if (value) {
        FeatureFlagService.setRequestFlag(requestId, flag, value);
      }
    }
    
    // Log traffic splitting decision (for debugging)
    logger.debug(`Traffic splitting: Request ${requestId} using ${shouldUsePrisma ? 'Prisma' : 'old'} implementation`);
    
    next();
  };
};

/**
 * Force the use of a specific implementation for testing
 * @param usePrisma - Whether to use Prisma implementation
 */
export const forceImplementation = (usePrisma: boolean) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get request ID
    const requestId = req.headers['x-request-id'] as string;
    
    if (!requestId) {
      logger.warn('No request ID found for forcing implementation');
      next();
      return;
    }
    
    // Set the feature flag for this request
    FeatureFlagService.setRequestFlag(requestId, 'usePrisma', usePrisma);
    
    // Set all other feature flags based on the forced implementation
    const flags = FeatureFlagService.getAllFlags();
    for (const flag of Object.keys(flags)) {
      if (flag !== 'usePrisma' && flag.startsWith('usePrisma')) {
        FeatureFlagService.setRequestFlag(requestId, flag, usePrisma);
      }
    }
    
    // Log forced implementation (for debugging)
    logger.debug(`Forced implementation: Request ${requestId} using ${usePrisma ? 'Prisma' : 'old'} implementation`);
    
    next();
  };
};

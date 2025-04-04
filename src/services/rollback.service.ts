/**
 * Rollback Service
 * 
 * Service for handling rollbacks to previous implementations
 */

import { FeatureFlagService } from './feature-flag.service';
import { logger } from '../api/utils/logger';

/**
 * Rollout phase configuration
 */
interface RolloutPhaseConfig {
  trafficPercentage: number;
  featureFlags: Record<string, boolean>;
}

/**
 * Service for handling rollbacks
 */
export class RollbackService {
  /**
   * Rollout configuration
   * @private
   */
  private static rolloutConfig: Record<string, RolloutPhaseConfig> = {
    '1': {
      trafficPercentage: 0, // Internal only
      featureFlags: {
        usePrisma: false,
        usePrismaCarriers: true,
        usePrismaProcedures: true,
        usePrismaGuidelines: false,
        usePrismaNetworks: false,
        usePrismaPlans: false,
        usePrismaSearch: false,
        usePrismaImportExport: false
      }
    },
    '2': {
      trafficPercentage: 10, // 10% of production traffic
      featureFlags: {
        usePrisma: false,
        usePrismaCarriers: true,
        usePrismaProcedures: true,
        usePrismaGuidelines: true,
        usePrismaNetworks: false,
        usePrismaPlans: false,
        usePrismaSearch: false,
        usePrismaImportExport: false
      }
    },
    '3': {
      trafficPercentage: 50, // 50% of production traffic
      featureFlags: {
        usePrisma: false,
        usePrismaCarriers: true,
        usePrismaProcedures: true,
        usePrismaGuidelines: true,
        usePrismaNetworks: true,
        usePrismaPlans: true,
        usePrismaSearch: true,
        usePrismaImportExport: true
      }
    },
    '4': {
      trafficPercentage: 100, // 100% of production traffic
      featureFlags: {
        usePrisma: true,
        usePrismaCarriers: true,
        usePrismaProcedures: true,
        usePrismaGuidelines: true,
        usePrismaNetworks: true,
        usePrismaPlans: true,
        usePrismaSearch: true,
        usePrismaImportExport: true
      }
    }
  };
  
  /**
   * Current rollout phase
   * @private
   */
  private static currentPhase: string = process.env.ROLLOUT_PHASE || '1';
  
  /**
   * Initialize rollback service
   */
  static initialize(): void {
    // Set the current phase
    this.currentPhase = process.env.ROLLOUT_PHASE || '1';
    
    // Apply phase-specific feature flags
    this.applyPhaseFlags(this.currentPhase);
    
    logger.info(`Rollback service initialized with phase ${this.currentPhase}`);
  }
  
  /**
   * Apply phase-specific feature flags
   * @param phase - Rollout phase
   * @private
   */
  private static applyPhaseFlags(phase: string): void {
    const phaseConfig = this.rolloutConfig[phase];
    
    if (!phaseConfig) {
      logger.error(`Invalid rollout phase: ${phase}`);
      return;
    }
    
    // Apply phase-specific feature flags
    for (const [flag, value] of Object.entries(phaseConfig.featureFlags)) {
      FeatureFlagService.setFlag(flag, value);
    }
    
    logger.info(`Applied feature flags for phase ${phase}:`, phaseConfig.featureFlags);
  }
  
  /**
   * Get current rollout phase
   * @returns Current rollout phase
   */
  static getCurrentPhase(): string {
    return this.currentPhase;
  }
  
  /**
   * Get traffic percentage for current phase
   * @returns Traffic percentage
   */
  static getCurrentTrafficPercentage(): number {
    const phaseConfig = this.rolloutConfig[this.currentPhase];
    return phaseConfig ? phaseConfig.trafficPercentage : 0;
  }
  
  /**
   * Rollback to a specific phase
   * @param phase - Rollout phase
   * @returns Success status
   */
  static rollbackToPhase(phase: string): boolean {
    if (!this.rolloutConfig[phase]) {
      logger.error(`Invalid rollout phase: ${phase}`);
      return false;
    }
    
    // Update the current phase
    this.currentPhase = phase;
    process.env.ROLLOUT_PHASE = phase;
    
    // Apply phase-specific feature flags
    this.applyPhaseFlags(phase);
    
    logger.info(`Rolled back to phase ${phase}`);
    return true;
  }
  
  /**
   * Rollback to old implementation for all features
   * @returns Success status
   */
  static rollbackToOldImplementation(): boolean {
    // Disable all Prisma feature flags
    FeatureFlagService.setFlag('usePrisma', false);
    FeatureFlagService.setFlag('usePrismaCarriers', false);
    FeatureFlagService.setFlag('usePrismaProcedures', false);
    FeatureFlagService.setFlag('usePrismaGuidelines', false);
    FeatureFlagService.setFlag('usePrismaNetworks', false);
    FeatureFlagService.setFlag('usePrismaPlans', false);
    FeatureFlagService.setFlag('usePrismaSearch', false);
    FeatureFlagService.setFlag('usePrismaImportExport', false);
    
    logger.info('Rolled back to old implementation for all features');
    return true;
  }
  
  /**
   * Rollback specific feature
   * @param featureName - Feature name (e.g., 'Carriers', 'Procedures')
   * @returns Success status
   */
  static rollbackFeature(featureName: string): boolean {
    const flagName = `usePrisma${featureName}`;
    
    if (!(flagName in FeatureFlagService.getAllFlags())) {
      logger.error(`Invalid feature name: ${featureName}`);
      return false;
    }
    
    FeatureFlagService.setFlag(flagName, false);
    logger.info(`Rolled back ${featureName} to old implementation`);
    return true;
  }
  
  /**
   * Advance to the next phase
   * @returns Success status
   */
  static advanceToNextPhase(): boolean {
    const currentPhaseNumber = parseInt(this.currentPhase, 10);
    const nextPhase = String(currentPhaseNumber + 1);
    
    if (!this.rolloutConfig[nextPhase]) {
      logger.error(`No next phase after ${this.currentPhase}`);
      return false;
    }
    
    return this.rollbackToPhase(nextPhase);
  }
  
  /**
   * Get all rollout phases
   * @returns Rollout phases
   */
  static getAllPhases(): Record<string, RolloutPhaseConfig> {
    return { ...this.rolloutConfig };
  }
}

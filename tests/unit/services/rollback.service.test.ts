/**
 * Rollback Service Tests
 */

import { RollbackService } from '../../../src/services/rollback.service';
import { FeatureFlagService } from '../../../src/services/feature-flag.service';

// Mock the FeatureFlagService
jest.mock('../../../src/services/feature-flag.service');

// Mock the logger
jest.mock('../../../src/api/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('RollbackService', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.ROLLOUT_PHASE;
  });
  
  describe('initialize', () => {
    it('should initialize with default phase', () => {
      // Initialize rollback service
      RollbackService.initialize();
      
      // Check current phase
      expect(RollbackService.getCurrentPhase()).toBe('1');
      
      // Check that feature flags were set
      expect(FeatureFlagService.setFlag).toHaveBeenCalled();
    });
    
    it('should initialize with phase from environment variable', () => {
      // Set environment variable
      process.env.ROLLOUT_PHASE = '2';
      
      // Initialize rollback service
      RollbackService.initialize();
      
      // Check current phase
      expect(RollbackService.getCurrentPhase()).toBe('2');
      
      // Check that feature flags were set
      expect(FeatureFlagService.setFlag).toHaveBeenCalled();
    });
  });
  
  describe('getCurrentPhase', () => {
    it('should return current phase', () => {
      // Set current phase
      process.env.ROLLOUT_PHASE = '3';
      RollbackService.initialize();
      
      // Check current phase
      expect(RollbackService.getCurrentPhase()).toBe('3');
    });
  });
  
  describe('getCurrentTrafficPercentage', () => {
    it('should return traffic percentage for current phase', () => {
      // Set current phase
      process.env.ROLLOUT_PHASE = '2';
      RollbackService.initialize();
      
      // Check traffic percentage
      expect(RollbackService.getCurrentTrafficPercentage()).toBe(10);
    });
    
    it('should return 0 for invalid phase', () => {
      // Set invalid phase
      process.env.ROLLOUT_PHASE = 'invalid';
      RollbackService.initialize();
      
      // Check traffic percentage
      expect(RollbackService.getCurrentTrafficPercentage()).toBe(0);
    });
  });
  
  describe('rollbackToPhase', () => {
    it('should rollback to specified phase', () => {
      // Initialize rollback service
      RollbackService.initialize();
      
      // Rollback to phase 2
      const result = RollbackService.rollbackToPhase('2');
      
      // Check result
      expect(result).toBe(true);
      
      // Check current phase
      expect(RollbackService.getCurrentPhase()).toBe('2');
      
      // Check that feature flags were set
      expect(FeatureFlagService.setFlag).toHaveBeenCalled();
    });
    
    it('should return false for invalid phase', () => {
      // Initialize rollback service
      RollbackService.initialize();
      
      // Rollback to invalid phase
      const result = RollbackService.rollbackToPhase('invalid');
      
      // Check result
      expect(result).toBe(false);
      
      // Check that current phase was not changed
      expect(RollbackService.getCurrentPhase()).toBe('1');
    });
  });
  
  describe('rollbackToOldImplementation', () => {
    it('should disable all Prisma feature flags', () => {
      // Initialize rollback service
      RollbackService.initialize();
      
      // Rollback to old implementation
      const result = RollbackService.rollbackToOldImplementation();
      
      // Check result
      expect(result).toBe(true);
      
      // Check that feature flags were set to false
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrisma', false);
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaCarriers', false);
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaProcedures', false);
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaGuidelines', false);
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaNetworks', false);
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaPlans', false);
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaSearch', false);
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaImportExport', false);
    });
  });
  
  describe('rollbackFeature', () => {
    it('should disable specific feature flag', () => {
      // Initialize rollback service
      RollbackService.initialize();
      
      // Mock getAllFlags to return a valid flag
      (FeatureFlagService.getAllFlags as jest.Mock).mockReturnValue({
        usePrisma: true,
        usePrismaCarriers: true
      });
      
      // Rollback specific feature
      const result = RollbackService.rollbackFeature('Carriers');
      
      // Check result
      expect(result).toBe(true);
      
      // Check that feature flag was set to false
      expect(FeatureFlagService.setFlag).toHaveBeenCalledWith('usePrismaCarriers', false);
    });
    
    it('should return false for invalid feature name', () => {
      // Initialize rollback service
      RollbackService.initialize();
      
      // Mock getAllFlags to return a valid flag
      (FeatureFlagService.getAllFlags as jest.Mock).mockReturnValue({
        usePrisma: true,
        usePrismaCarriers: true
      });
      
      // Rollback invalid feature
      const result = RollbackService.rollbackFeature('InvalidFeature');
      
      // Check result
      expect(result).toBe(false);
    });
  });
  
  describe('advanceToNextPhase', () => {
    it('should advance to next phase', () => {
      // Initialize rollback service with phase 1
      process.env.ROLLOUT_PHASE = '1';
      RollbackService.initialize();
      
      // Advance to next phase
      const result = RollbackService.advanceToNextPhase();
      
      // Check result
      expect(result).toBe(true);
      
      // Check current phase
      expect(RollbackService.getCurrentPhase()).toBe('2');
    });
    
    it('should return false if there is no next phase', () => {
      // Initialize rollback service with phase 4 (last phase)
      process.env.ROLLOUT_PHASE = '4';
      RollbackService.initialize();
      
      // Advance to next phase
      const result = RollbackService.advanceToNextPhase();
      
      // Check result
      expect(result).toBe(false);
      
      // Check that current phase was not changed
      expect(RollbackService.getCurrentPhase()).toBe('4');
    });
  });
  
  describe('getAllPhases', () => {
    it('should return all phases', () => {
      // Initialize rollback service
      RollbackService.initialize();
      
      // Get all phases
      const phases = RollbackService.getAllPhases();
      
      // Check phases
      expect(Object.keys(phases)).toEqual(['1', '2', '3', '4']);
      expect(phases['1'].trafficPercentage).toBe(0);
      expect(phases['2'].trafficPercentage).toBe(10);
      expect(phases['3'].trafficPercentage).toBe(50);
      expect(phases['4'].trafficPercentage).toBe(100);
    });
  });
});

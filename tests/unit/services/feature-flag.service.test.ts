/**
 * Feature Flag Service Tests
 */

import { FeatureFlagService } from '../../../src/services/feature-flag.service';

describe('FeatureFlagService', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.USE_PRISMA;
    delete process.env.USE_PRISMA_CARRIERS;
    delete process.env.USE_PRISMA_PROCEDURES;
    delete process.env.USE_PRISMA_GUIDELINES;
    
    // Reset feature flags
    FeatureFlagService.resetFlags();
  });
  
  describe('initialize', () => {
    it('should initialize flags from environment variables', () => {
      // Set environment variables
      process.env.USE_PRISMA = 'true';
      process.env.USE_PRISMA_CARRIERS = 'true';
      process.env.USE_PRISMA_PROCEDURES = 'false';
      
      // Initialize feature flags
      FeatureFlagService.initialize();
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(true);
      expect(FeatureFlagService.isEnabled('usePrismaCarriers')).toBe(true);
      expect(FeatureFlagService.isEnabled('usePrismaProcedures')).toBe(false);
      expect(FeatureFlagService.isEnabled('usePrismaGuidelines')).toBe(false);
    });
    
    it('should default to false for unset environment variables', () => {
      // Initialize feature flags
      FeatureFlagService.initialize();
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(false);
      expect(FeatureFlagService.isEnabled('usePrismaCarriers')).toBe(false);
      expect(FeatureFlagService.isEnabled('usePrismaProcedures')).toBe(false);
      expect(FeatureFlagService.isEnabled('usePrismaGuidelines')).toBe(false);
    });
  });
  
  describe('isEnabled', () => {
    it('should return flag value', () => {
      // Set flags
      FeatureFlagService.setFlag('usePrisma', true);
      FeatureFlagService.setFlag('usePrismaCarriers', false);
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(true);
      expect(FeatureFlagService.isEnabled('usePrismaCarriers')).toBe(false);
    });
    
    it('should return false for unknown flags', () => {
      expect(FeatureFlagService.isEnabled('unknownFlag')).toBe(false);
    });
    
    it('should check request-scoped flags first', () => {
      // Set global flags
      FeatureFlagService.setFlag('usePrisma', false);
      
      // Set request-scoped flags
      const requestId = 'test-request-id';
      FeatureFlagService.setRequestFlag(requestId, 'usePrisma', true);
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma', requestId)).toBe(true);
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(false);
    });
    
    it('should fall back to global flags if request-scoped flag is not set', () => {
      // Set global flags
      FeatureFlagService.setFlag('usePrisma', true);
      
      // Set request-scoped flags for a different flag
      const requestId = 'test-request-id';
      FeatureFlagService.setRequestFlag(requestId, 'usePrismaCarriers', true);
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma', requestId)).toBe(true);
    });
  });
  
  describe('setFlag', () => {
    it('should set flag value', () => {
      // Set flag
      FeatureFlagService.setFlag('usePrisma', true);
      
      // Check flag
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(true);
      
      // Change flag
      FeatureFlagService.setFlag('usePrisma', false);
      
      // Check flag again
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(false);
    });
  });
  
  describe('setRequestFlag', () => {
    it('should set request-scoped flag value', () => {
      // Set request-scoped flag
      const requestId = 'test-request-id';
      FeatureFlagService.setRequestFlag(requestId, 'usePrisma', true);
      
      // Check flag
      expect(FeatureFlagService.isEnabled('usePrisma', requestId)).toBe(true);
    });
    
    it('should not affect global flags', () => {
      // Set global flag
      FeatureFlagService.setFlag('usePrisma', false);
      
      // Set request-scoped flag
      const requestId = 'test-request-id';
      FeatureFlagService.setRequestFlag(requestId, 'usePrisma', true);
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma', requestId)).toBe(true);
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(false);
    });
  });
  
  describe('clearRequestFlags', () => {
    it('should clear request-scoped flags', () => {
      // Set request-scoped flags
      const requestId = 'test-request-id';
      FeatureFlagService.setRequestFlag(requestId, 'usePrisma', true);
      FeatureFlagService.setRequestFlag(requestId, 'usePrismaCarriers', true);
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma', requestId)).toBe(true);
      expect(FeatureFlagService.isEnabled('usePrismaCarriers', requestId)).toBe(true);
      
      // Clear request-scoped flags
      FeatureFlagService.clearRequestFlags(requestId);
      
      // Check flags again
      expect(FeatureFlagService.isEnabled('usePrisma', requestId)).toBe(false);
      expect(FeatureFlagService.isEnabled('usePrismaCarriers', requestId)).toBe(false);
    });
    
    it('should not affect other request-scoped flags', () => {
      // Set request-scoped flags for different requests
      const requestId1 = 'test-request-id-1';
      const requestId2 = 'test-request-id-2';
      FeatureFlagService.setRequestFlag(requestId1, 'usePrisma', true);
      FeatureFlagService.setRequestFlag(requestId2, 'usePrisma', true);
      
      // Clear request-scoped flags for one request
      FeatureFlagService.clearRequestFlags(requestId1);
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma', requestId1)).toBe(false);
      expect(FeatureFlagService.isEnabled('usePrisma', requestId2)).toBe(true);
    });
  });
  
  describe('getAllFlags', () => {
    it('should return all flags', () => {
      // Set flags
      FeatureFlagService.setFlag('usePrisma', true);
      FeatureFlagService.setFlag('usePrismaCarriers', false);
      
      // Get all flags
      const flags = FeatureFlagService.getAllFlags();
      
      // Check flags
      expect(flags.usePrisma).toBe(true);
      expect(flags.usePrismaCarriers).toBe(false);
    });
  });
  
  describe('resetFlags', () => {
    it('should reset all flags to default values', () => {
      // Set flags
      FeatureFlagService.setFlag('usePrisma', true);
      FeatureFlagService.setFlag('usePrismaCarriers', true);
      
      // Set environment variables
      process.env.USE_PRISMA = 'false';
      process.env.USE_PRISMA_CARRIERS = 'false';
      
      // Reset flags
      FeatureFlagService.resetFlags();
      
      // Check flags
      expect(FeatureFlagService.isEnabled('usePrisma')).toBe(false);
      expect(FeatureFlagService.isEnabled('usePrismaCarriers')).toBe(false);
    });
  });
});

/**
 * Data Transfer Service Tests
 * 
 * Tests for the data import and export functionality
 */

import { DataTransferService } from '../../../src/api/services/data-transfer.service';
import { prisma } from '../../../src/lib/prisma-optimized';

// Mock the Prisma client
jest.mock('../../../src/lib/prisma-optimized', () => ({
  prisma: {
    $transaction: jest.fn(callback => callback({
      insuranceCarrier: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      procedure: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      guideline: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      network: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      plan: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    })),
    insuranceCarrier: {
      findMany: jest.fn()
    },
    procedure: {
      findMany: jest.fn()
    },
    guideline: {
      findMany: jest.fn()
    },
    network: {
      findMany: jest.fn()
    },
    plan: {
      findMany: jest.fn()
    }
  }
}));

// Mock the logger
jest.mock('../../../src/api/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DataTransferService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('batchImport', () => {
    it('should validate data before importing', async () => {
      // Mock data with validation errors
      const mockData = [
        { /* Missing required fields */ },
        { carrierName: 'Test Carrier' }
      ];

      // Call the method
      const result = await DataTransferService.batchImport(mockData, {
        entityType: 'carrier'
      });

      // Assertions
      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.length).toBeGreaterThan(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should only validate data when validateOnly is true', async () => {
      // Mock valid data
      const mockData = [
        { carrierName: 'Test Carrier 1', carrierCode: 'TC1' },
        { carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
      ];

      // Call the method with validateOnly=true
      const result = await DataTransferService.batchImport(mockData, {
        entityType: 'carrier',
        validateOnly: true
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.validationErrors).toEqual([]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should process data in batches', async () => {
      // Mock valid data
      const mockData = [
        { carrierName: 'Test Carrier 1', carrierCode: 'TC1' },
        { carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
      ];

      // Mock transaction implementation
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          insuranceCarrier: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
            update: jest.fn()
          },
          procedure: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          },
          guideline: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          },
          network: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          },
          plan: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          }
        };
        
        return callback(tx);
      });

      // Call the method
      const result = await DataTransferService.batchImport(mockData, {
        entityType: 'carrier',
        batchSize: 1
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.processedRecords).toBe(2);
      expect(result.createdRecords).toBe(2);
      expect(result.updatedRecords).toBe(0);
      expect(result.failedRecords).toBe(0);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should update existing records when updateExisting is true', async () => {
      // Mock valid data
      const mockData = [
        { carrierName: 'Test Carrier', carrierCode: 'TC1' }
      ];

      // Mock transaction implementation
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          insuranceCarrier: {
            findFirst: jest.fn().mockResolvedValue({ id: BigInt(1), carrierName: 'Existing Carrier' }),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({ id: BigInt(1) })
          },
          procedure: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          },
          guideline: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          },
          network: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          },
          plan: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          }
        };
        
        return callback(tx);
      });

      // Call the method with updateExisting=true
      const result = await DataTransferService.batchImport(mockData, {
        entityType: 'carrier',
        updateExisting: true
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(result.processedRecords).toBe(1);
      expect(result.createdRecords).toBe(0);
      expect(result.updatedRecords).toBe(1);
      expect(result.failedRecords).toBe(0);
    });

    it('should handle transaction errors', async () => {
      // Mock valid data
      const mockData = [
        { carrierName: 'Test Carrier', carrierCode: 'TC1' }
      ];

      // Mock transaction to throw an error
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      // Call the method
      const result = await DataTransferService.batchImport(mockData, {
        entityType: 'carrier'
      });

      // Assertions
      expect(result.success).toBe(false);
      expect(result.failedRecords).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Transaction failed');
    });
  });

  describe('exportData', () => {
    it('should export data with default options', async () => {
      // Mock data
      const mockData = [
        { id: BigInt(1), carrierName: 'Test Carrier 1', carrierCode: 'TC1' },
        { id: BigInt(2), carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
      ];

      // Mock findMany
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue(mockData);

      // Call the method
      const result = await DataTransferService.exportData({
        entityType: 'carrier'
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.data.length).toBe(2);
      expect(result.format).toBe('json');
      expect(result.entityType).toBe('carrier');
      expect(prisma.insuranceCarrier.findMany).toHaveBeenCalled();
    });

    it('should apply filters when provided', async () => {
      // Mock data
      const mockData = [
        { id: BigInt(1), carrierName: 'Test Carrier', carrierCode: 'TC1' }
      ];

      // Mock findMany
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue(mockData);

      // Call the method with filters
      const result = await DataTransferService.exportData({
        entityType: 'carrier',
        filters: { carrierCode: 'TC1' }
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(prisma.insuranceCarrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { carrierCode: 'TC1' }
        })
      );
    });

    it('should include relations when requested', async () => {
      // Mock data
      const mockData = [
        {
          id: BigInt(1),
          carrierName: 'Test Carrier',
          carrierCode: 'TC1',
          plans: [
            { id: BigInt(101), planName: 'Test Plan' }
          ],
          guidelines: [
            { id: BigInt(201), title: 'Test Guideline' }
          ]
        }
      ];

      // Mock findMany
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue(mockData);

      // Call the method with includeRelations=true
      const result = await DataTransferService.exportData({
        entityType: 'carrier',
        includeRelations: true
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(prisma.insuranceCarrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.anything()
        })
      );
      expect(result.data[0]).toHaveProperty('plans');
      expect(result.data[0]).toHaveProperty('guidelines');
    });

    it('should apply limit and offset when provided', async () => {
      // Mock data
      const mockData = [
        { id: BigInt(2), carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
      ];

      // Mock findMany
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue(mockData);

      // Call the method with limit and offset
      const result = await DataTransferService.exportData({
        entityType: 'carrier',
        limit: 1,
        offset: 1
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(prisma.insuranceCarrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
          skip: 1
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Mock findMany to throw an error
      (prisma.insuranceCarrier.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(DataTransferService.exportData({
        entityType: 'carrier'
      })).rejects.toThrow('Failed to export carrier data');
    });
  });
});

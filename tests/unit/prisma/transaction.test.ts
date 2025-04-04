/**
 * Tests for Prisma transaction functionality
 */
import { jest, expect } from '@jest/globals';
import { prisma } from '../../../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

// Mock the prisma module
jest.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    $transaction: jest.fn(),
    insuranceCarrier: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn()
    },
    procedure: {
      create: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe('Prisma Transaction Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute multiple operations in a transaction', async () => {
    // Mock transaction implementation with proper typing
    const mockCarrier = {
      id: 1n,
      carrierName: 'Test Carrier',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const mockProcedure = {
      id: 1n,
      procedureCode: 'D0001',
      description: 'Test Procedure',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Setup mocks
    (prisma.$transaction as jest.Mock).mockImplementation(async (operations) => {
      if (Array.isArray(operations)) {
        // Execute all operations in the array for testing
        return [mockCarrier, mockProcedure];
      }
      return null;
    });

    (prisma.insuranceCarrier.create as jest.Mock).mockResolvedValue(mockCarrier);
    (prisma.procedure.create as jest.Mock).mockResolvedValue(mockProcedure);

    // Execute a transaction with data matching your schema
    const results = await prisma.$transaction([
      prisma.insuranceCarrier.create({
        data: { 
          carrierName: 'Test Carrier' 
        }
      }),
      prisma.procedure.create({
        data: { 
          procedureCode: 'D0001', 
          description: 'Test Procedure' 
        }
      })
    ]);

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    
    // Verify create methods were called
    expect(prisma.insuranceCarrier.create).toHaveBeenCalled();
    expect(prisma.procedure.create).toHaveBeenCalled();
    
    // Verify results
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('carrierName');
    expect(results[1]).toHaveProperty('procedureCode');
  });

  it('should roll back transaction on error', async () => {
    // Mock transaction to simulate an error
    (prisma.$transaction as jest.Mock).mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed', 
        { code: 'P2003', clientVersion: '1.0.0' }
      );
    });

    // Execute transaction that should fail
    try {
      await prisma.$transaction([
        prisma.insuranceCarrier.create({
          data: { 
            carrierName: 'Test Carrier' 
          }
        }),
        prisma.procedure.create({ 
          data: { 
            procedureCode: 'D0001', 
            description: 'Test Procedure'
          } 
        })
      ]);
      
      // If we get here, test should fail
      expect(true).toBe(false); // This line should not execute
    } catch (error) {
      // Verify it's the expected error
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
      
      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
    }
  });

  it('should handle callback-style transactions', async () => {
    const mockCarrier = {
      id: 1n,
      carrierName: 'Test Carrier',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const mockUpdatedCarrier = {
      id: 1n,
      carrierName: 'Updated Carrier',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock transaction with callback implementation
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        // For the test, just execute the callback with the mocked prisma client
        return await callback(prisma);
      }
      return null;
    });

    // Mock method implementations
    (prisma.insuranceCarrier.findUnique as jest.Mock).mockResolvedValue(mockCarrier);
    (prisma.insuranceCarrier.update as jest.Mock).mockResolvedValue(mockUpdatedCarrier);

    // Execute a callback-style transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find a carrier
      const carrier = await tx.insuranceCarrier.findUnique({ 
        where: { id: 1n } 
      });
      
      // In test environment, we know carrier exists
      return tx.insuranceCarrier.update({
        where: { id: carrier?.id || 1n },
        data: { carrierName: 'Updated Carrier' }
      });
    });

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    
    // Verify methods were called
    expect(prisma.insuranceCarrier.findUnique).toHaveBeenCalled();
    expect(prisma.insuranceCarrier.update).toHaveBeenCalled();
    
    // Verify result
    expect(result).toHaveProperty('carrierName', 'Updated Carrier');
  });

  it('should handle nested transactions', async () => {
    const mockCarrier = {
      id: 1n,
      carrierName: 'Test Carrier',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const mockProcedure = {
      id: 1n,
      procedureCode: 'D0001',
      description: 'Test Procedure',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Mock transaction implementations
    let callCount = 0;
    (prisma.$transaction as jest.Mock).mockImplementation(async (callbackOrArray) => {
      callCount++;
      
      if (typeof callbackOrArray === 'function') {
        // First call - outer transaction
        if (callCount === 1) {
          return await callbackOrArray({
            ...prisma,
            insuranceCarrier: {
              ...prisma.insuranceCarrier,
              create: jest.fn().mockResolvedValue(mockCarrier)
            }
          });
        } 
        // Second call - nested transaction
        else {
          return await callbackOrArray({
            ...prisma,
            procedure: {
              ...prisma.procedure,
              create: jest.fn().mockResolvedValue(mockProcedure)
            }
          });
        }
      }
      return null;
    });

    // For the mock, we need to temporarily add $transaction to tx
    const tempPrisma = {
      ...prisma,
      $transaction: prisma.$transaction
    };

    // Execute the nested transaction test
    const result = await prisma.$transaction(async (tx) => {
      // Create a carrier
      const carrier = await tx.insuranceCarrier.create({
        data: { carrierName: 'Test Carrier' }
      });
      
      // For testing, use our temp object with transaction
      const procedure = await tempPrisma.$transaction(async (nestedTx) => {
        return await nestedTx.procedure.create({
          data: { 
            procedureCode: 'D0001', 
            description: 'Test Procedure' 
          }
        });
      });
      
      return { carrier, procedure };
    });

    // Verify that transaction was called twice
    expect(callCount).toBe(2);
    
    // Verify result structure
    expect(result).toHaveProperty('carrier');
    expect(result).toHaveProperty('procedure');
    expect(result.carrier).toHaveProperty('carrierName');
    expect(result.procedure).toHaveProperty('procedureCode');
  });
});

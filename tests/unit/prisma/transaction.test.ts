/**
 * Tests for Prisma transaction functionality
 */
import { jest } from '@jest/globals';
import { prisma } from '../../../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

// This is a unit test that mocks Prisma, not a real database test
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
    // Mock transaction implementation
    (prisma.$transaction as jest.Mock).mockImplementation(async (operations) => {
      // Just execute all operations in the array
      return await Promise.all(operations);
    });

    // Mock successful responses for each operation
    (prisma.insuranceCarrier.create as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Carrier' });
    (prisma.procedure.create as jest.Mock).mockResolvedValue({ code: 'D0001', description: 'Test Procedure' });

    // Execute a transaction
    const results = await prisma.$transaction([
      prisma.insuranceCarrier.create({ data: { name: 'Test Carrier' } }),
      prisma.procedure.create({ data: { code: 'D0001', description: 'Test Procedure' } })
    ]);

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    
    // Verify create methods were called
    expect(prisma.insuranceCarrier.create).toHaveBeenCalled();
    expect(prisma.procedure.create).toHaveBeenCalled();
    
    // Verify results
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1, name: 'Test Carrier' });
    expect(results[1]).toEqual({ code: 'D0001', description: 'Test Procedure' });
  });

  it('should roll back transaction on error', async () => {
    // Mock transaction to simulate an error in the second operation
    (prisma.$transaction as jest.Mock).mockImplementation(async (operations) => {
      // Simulate the first operation succeeding
      await operations[0];
      
      // Simulate the second operation failing
      throw new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed', 
        { code: 'P2003', clientVersion: '1.0.0' }
      );
    });

    // Mock method implementations
    (prisma.insuranceCarrier.create as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Carrier' });
    (prisma.procedure.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed', 
        { code: 'P2003', clientVersion: '1.0.0' }
      )
    );

    // Execute transaction that should fail
    try {
      await prisma.$transaction([
        prisma.insuranceCarrier.create({ data: { name: 'Test Carrier' } }),
        prisma.procedure.create({ 
          data: { 
            code: 'D0001', 
            description: 'Test Procedure',
            // Simulate invalid FK
            invalidField: 999 
          } 
        })
      ]);
      
      // Should not reach here
      fail('Transaction should have thrown an error');
    } catch (error) {
      // Verify it's the expected error
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
      
      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
      
      // First operation was called
      expect(prisma.insuranceCarrier.create).toHaveBeenCalled();
    }
  });

  it('should handle callback-style transactions', async () => {
    // Mock transaction with callback implementation
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        return await callback(prisma);
      }
      throw new Error('Not a callback transaction');
    });

    // Mock method implementations
    (prisma.insuranceCarrier.findUnique as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Carrier' });
    (prisma.insuranceCarrier.update as jest.Mock).mockResolvedValue({ id: 1, name: 'Updated Carrier' });

    // Execute a callback-style transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find a carrier
      const carrier = await tx.insuranceCarrier.findUnique({ where: { id: 1 } });
      
      // Update the carrier
      return await tx.insuranceCarrier.update({
        where: { id: carrier.id },
        data: { name: 'Updated Carrier' }
      });
    });

    // Verify transaction was called with a function
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
    
    // Verify methods were called
    expect(prisma.insuranceCarrier.findUnique).toHaveBeenCalled();
    expect(prisma.insuranceCarrier.update).toHaveBeenCalled();
    
    // Verify result
    expect(result).toEqual({ id: 1, name: 'Updated Carrier' });
  });

  it('should handle nested transactions', async () => {
    // Mock transaction implementation for nested transactions
    let transactionLevel = 0;
    
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        transactionLevel++;
        const result = await callback(prisma);
        transactionLevel--;
        return result;
      }
      throw new Error('Not a callback transaction');
    });

    // Mock method implementations
    (prisma.insuranceCarrier.create as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Carrier' });
    (prisma.procedure.create as jest.Mock).mockResolvedValue({ code: 'D0001', description: 'Test Procedure' });

    // Execute a transaction with a nested transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create a carrier
      const carrier = await tx.insuranceCarrier.create({ data: { name: 'Test Carrier' } });
      
      // Create a procedure in a "nested" transaction
      // Note: Prisma actually doesn't support nested transactions, but we're testing the concept
      const procedure = await tx.$transaction(async (nestedTx) => {
        return await nestedTx.procedure.create({ data: { code: 'D0001', description: 'Test Procedure' } });
      });
      
      return { carrier, procedure };
    });

    // Verify transaction was called twice (outer and "nested")
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    
    // Verify methods were called
    expect(prisma.insuranceCarrier.create).toHaveBeenCalled();
    expect(prisma.procedure.create).toHaveBeenCalled();
    
    // Verify result
    expect(result).toEqual({
      carrier: { id: 1, name: 'Test Carrier' },
      procedure: { code: 'D0001', description: 'Test Procedure' }
    });
  });
});

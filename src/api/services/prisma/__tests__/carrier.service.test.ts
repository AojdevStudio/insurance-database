import { jest } from '@jest/globals';
import { PrismaCarrierService } from '../carrier.service.js';
import { prisma } from '../../../../lib/prisma.js';
import { Prisma } from '@prisma/client';

// Mock Prisma client
jest.mock('../../../../lib/prisma.js', () => ({
  prisma: {
    insuranceCarrier: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn()
    }
  }
}));

describe('PrismaCarrierService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Sample carrier data for tests
  const mockCarrierData = [
    {
      id: 1,
      name: 'Test Carrier 1',
      created_at: new Date('2023-01-01')
    },
    {
      id: 2,
      name: 'Test Carrier 2',
      created_at: new Date('2023-01-02')
    },
    {
      id: 3,
      name: 'Another Carrier',
      created_at: new Date('2023-01-03')
    }
  ];

  describe('listCarriers', () => {
    it('should return paginated carriers with default options', async () => {
      // Mock the responses
      (prisma.insuranceCarrier.count as jest.Mock).mockResolvedValue(3);
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue(mockCarrierData);

      const result = await PrismaCarrierService.listCarriers();

      // Verify correct functions were called
      expect(prisma.insuranceCarrier.count).toHaveBeenCalled();
      expect(prisma.insuranceCarrier.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { name: 'asc' }
      });

      // Verify result structure
      expect(result).toEqual({
        carriers: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            name: 'Test Carrier 1'
          })
        ]),
        total: 3,
        page: 1,
        limit: 10,
        total_pages: 1
      });
    });

    it('should apply custom pagination and sorting options', async () => {
      // Mock the responses
      (prisma.insuranceCarrier.count as jest.Mock).mockResolvedValue(10);
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue(mockCarrierData.slice(0, 2));

      const result = await PrismaCarrierService.listCarriers({
        page: 2,
        limit: 2,
        sort_by: 'created_at',
        sort_order: 'desc'
      });

      // Verify correct options were applied
      expect(prisma.insuranceCarrier.findMany).toHaveBeenCalledWith({
        skip: 2,
        take: 2,
        orderBy: { created_at: 'desc' }
      });

      // Verify metadata is correct
      expect(result).toEqual(expect.objectContaining({
        total: 10,
        page: 2,
        limit: 2,
        total_pages: 5
      }));
    });

    it('should handle database errors gracefully', async () => {
      // Mock a database error
      const dbError = new Error('Database connection failed');
      (prisma.insuranceCarrier.count as jest.Mock).mockRejectedValue(dbError);

      await expect(PrismaCarrierService.listCarriers()).rejects.toThrow();
    });

    it('should handle Prisma validation errors', async () => {
      // Mock a validation error
      const validationError = new Prisma.PrismaClientValidationError(
        new Error('Invalid query arguments'),
        { clientVersion: '1.0.0' }
      );
      (prisma.insuranceCarrier.count as jest.Mock).mockRejectedValue(validationError);

      await expect(PrismaCarrierService.listCarriers()).rejects.toThrow('Invalid data provided');
    });
  });

  describe('searchCarriers', () => {
    it('should search carriers by name', async () => {
      // Mock the responses
      (prisma.insuranceCarrier.count as jest.Mock).mockResolvedValue(1);
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue([mockCarrierData[2]]);

      const result = await PrismaCarrierService.searchCarriers({ query: 'Another' });

      // Verify search parameters
      expect(prisma.insuranceCarrier.count).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'Another',
            mode: 'insensitive'
          }
        }
      });

      expect(prisma.insuranceCarrier.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'Another',
            mode: 'insensitive'
          }
        },
        skip: 0,
        take: 10,
        orderBy: { name: 'asc' }
      });

      // Verify result
      expect(result.carriers).toHaveLength(1);
      expect(result.carriers[0].name).toBe('Another Carrier');
    });

    it('should return empty results when no matches', async () => {
      // Mock empty results
      (prisma.insuranceCarrier.count as jest.Mock).mockResolvedValue(0);
      (prisma.insuranceCarrier.findMany as jest.Mock).mockResolvedValue([]);

      const result = await PrismaCarrierService.searchCarriers({ query: 'NonExistent' });

      // Verify result metadata
      expect(result.total).toBe(0);
      expect(result.total_pages).toBe(0);
      expect(result.carriers).toHaveLength(0);
    });
  });

  describe('getCarrierById', () => {
    it('should return a single carrier by ID', async () => {
      // Mock the carrier
      (prisma.insuranceCarrier.findUnique as jest.Mock).mockResolvedValue(mockCarrierData[0]);

      const carrier = await PrismaCarrierService.getCarrierById(1);

      // Verify query
      expect(prisma.insuranceCarrier.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });

      // Verify result
      expect(carrier).toEqual(expect.objectContaining({
        id: 1,
        name: 'Test Carrier 1'
      }));
    });

    it('should throw an error if carrier is not found', async () => {
      // Mock null response (not found)
      (prisma.insuranceCarrier.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(PrismaCarrierService.getCarrierById(999)).rejects.toThrow('Carrier not found');
    });

    it('should handle Prisma record not found error', async () => {
      // Mock P2025 error
      const notFoundError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '1.0.0' }
      );
      (prisma.insuranceCarrier.findUnique as jest.Mock).mockRejectedValue(notFoundError);

      await expect(PrismaCarrierService.getCarrierById(999)).rejects.toThrow('Carrier not found');
    });
  });
});

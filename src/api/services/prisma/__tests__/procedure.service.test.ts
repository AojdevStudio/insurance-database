/**
 * Tests for the PrismaProcedureService
 */

import { prismaMock } from '../../../../lib/__mocks__/prisma.js';
import { PrismaProcedureService } from '../procedure.service.js';
import { Prisma } from '@prisma/client';

// Mock the prisma import in the service
jest.mock('../../../../lib/prisma.js', () => ({
  prisma: prismaMock
}));

describe('PrismaProcedureService', () => {
  // Sample data for tests
  const mockProcedures = [
    {
      id: 1,
      code: 'D1110',
      description: 'Prophylaxis - adult',
      category: 'Preventive',
      created_at: new Date('2023-01-01')
    },
    {
      id: 2,
      code: 'D2150',
      description: 'Amalgam - two surfaces, primary or permanent',
      category: 'Restorative',
      created_at: new Date('2023-01-02')
    }
  ];

  const mockCarrierRequirements = [
    {
      id: 1,
      procedure_id: 1,
      carrier_id: 1,
      requirement_type: 'frequency',
      requirement_value: 'once per 6 months',
      created_at: new Date('2023-01-01')
    }
  ];

  const mockDocumentationRequirements = [
    {
      id: 1,
      procedure_id: 1,
      requirement: 'Radiograph',
      required: true,
      created_at: new Date('2023-01-01')
    }
  ];

  const mockProcedureRequirementsView = [
    {
      id: 1,
      procedure_id: 1,
      procedure_code: 'D1110',
      procedure_description: 'Prophylaxis - adult',
      carrier_id: 1,
      carrier_name: 'Test Carrier',
      requirement_type: 'frequency',
      requirement_value: 'once per 6 months'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listProcedures', () => {
    it('should return paginated procedures', async () => {
      // Mock Prisma responses
      prismaMock.procedure.count.mockResolvedValue(2);
      prismaMock.procedure.findMany.mockResolvedValue(mockProcedures);

      // Execute the service method
      const result = await PrismaProcedureService.listProcedures({
        page: 1,
        limit: 10
      });

      // Verify Prisma was called correctly
      expect(prismaMock.procedure.count).toHaveBeenCalledWith({
        where: {}
      });
      expect(prismaMock.procedure.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: {
          code: 'asc'
        }
      });

      // Verify the result
      expect(result).toEqual({
        procedures: mockProcedures,
        total: 2,
        page: 1,
        limit: 10,
        total_pages: 1
      });
    });

    it('should filter by category when provided', async () => {
      // Mock Prisma responses
      prismaMock.procedure.count.mockResolvedValue(1);
      prismaMock.procedure.findMany.mockResolvedValue([mockProcedures[0]]);

      // Execute the service method with category filter
      const result = await PrismaProcedureService.listProcedures({
        category: 'Preventive'
      });

      // Verify Prisma was called with category filter
      expect(prismaMock.procedure.count).toHaveBeenCalledWith({
        where: {
          category: 'Preventive'
        }
      });
      expect(prismaMock.procedure.findMany).toHaveBeenCalledWith({
        where: {
          category: 'Preventive'
        },
        skip: 0,
        take: 10,
        orderBy: {
          code: 'asc'
        }
      });

      // Verify the result
      expect(result.procedures).toHaveLength(1);
      expect(result.procedures[0].category).toBe('Preventive');
    });

    it('should handle Prisma errors properly', async () => {
      // Mock Prisma to throw an error
      const mockError = new Error('Database connection failed');
      prismaMock.procedure.count.mockRejectedValue(mockError);

      // Execute and expect error
      await expect(PrismaProcedureService.listProcedures()).rejects.toThrow();
    });
  });

  describe('searchProcedures', () => {
    it('should search procedures by code or description', async () => {
      // Mock Prisma responses
      prismaMock.procedure.count.mockResolvedValue(1);
      prismaMock.procedure.findMany.mockResolvedValue([mockProcedures[0]]);

      // Execute the service method with search query
      const result = await PrismaProcedureService.searchProcedures({
        query: 'prophylaxis'
      });

      // Verify Prisma was called with correct search parameters
      const expectedWhere = {
        OR: [
          { code: { contains: 'prophylaxis', mode: 'insensitive' } },
          { description: { contains: 'prophylaxis', mode: 'insensitive' } }
        ]
      };
      expect(prismaMock.procedure.count).toHaveBeenCalledWith({
        where: expectedWhere
      });
      expect(prismaMock.procedure.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        skip: 0,
        take: 10,
        orderBy: {
          code: 'asc'
        }
      });

      // Verify the result
      expect(result.procedures).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getProcedureByCode', () => {
    it('should return a procedure with its requirements', async () => {
      // Mock procedure with requirements
      const mockProcedureWithReqs = {
        ...mockProcedures[0],
        carrierProcedureRequirements: mockCarrierRequirements,
        documentationRequirements: mockDocumentationRequirements
      };

      // Mock Prisma response
      prismaMock.procedure.findUnique.mockResolvedValue(mockProcedureWithReqs);

      // Execute the service method
      const result = await PrismaProcedureService.getProcedureByCode('D1110');

      // Verify Prisma was called correctly
      expect(prismaMock.procedure.findUnique).toHaveBeenCalledWith({
        where: { code: 'D1110' },
        include: {
          carrierProcedureRequirements: true,
          documentationRequirements: true
        }
      });

      // Verify the result includes procedure with requirements
      expect(result.code).toBe('D1110');
      expect(result.carrier_requirements).toHaveLength(1);
      expect(result.documentation_requirements).toHaveLength(1);
    });

    it('should throw an error when procedure is not found', async () => {
      // Mock Prisma to return null (not found)
      prismaMock.procedure.findUnique.mockResolvedValue(null);

      // Execute and expect error
      await expect(PrismaProcedureService.getProcedureByCode('INVALID')).rejects.toThrow('Procedure not found');
    });

    it('should handle Prisma known request errors', async () => {
      // Mock Prisma to throw a known request error
      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '3.0.0'
      });
      prismaMock.procedure.findUnique.mockRejectedValue(prismaError);

      // Execute and expect error
      await expect(PrismaProcedureService.getProcedureByCode('D1110')).rejects.toThrow('Procedure not found');
    });
  });

  describe('getProcedureRequirements', () => {
    it('should return procedure requirements', async () => {
      // Mock Prisma response
      prismaMock.procedureRequirementsView.findMany.mockResolvedValue(mockProcedureRequirementsView);

      // Execute the service method
      const result = await PrismaProcedureService.getProcedureRequirements('D1110');

      // Verify Prisma was called correctly
      expect(prismaMock.procedureRequirementsView.findMany).toHaveBeenCalledWith({
        where: { procedure_code: 'D1110' }
      });

      // Verify the result
      expect(result).toEqual(mockProcedureRequirementsView);
    });

    it('should filter by carrier when carrierId is provided', async () => {
      // Mock Prisma response
      prismaMock.procedureRequirementsView.findMany.mockResolvedValue(mockProcedureRequirementsView);

      // Execute the service method with carrierId
      const result = await PrismaProcedureService.getProcedureRequirements('D1110', 1);

      // Verify Prisma was called with carrier filter
      expect(prismaMock.procedureRequirementsView.findMany).toHaveBeenCalledWith({
        where: {
          procedure_code: 'D1110',
          carrier_id: 1
        }
      });

      // Verify the result
      expect(result).toEqual(mockProcedureRequirementsView);
    });

    it('should throw an error when no requirements are found', async () => {
      // Mock Prisma to return empty array
      prismaMock.procedureRequirementsView.findMany.mockResolvedValue([]);

      // Execute and expect error
      await expect(PrismaProcedureService.getProcedureRequirements('D1110')).rejects.toThrow('No requirements found for procedure');
    });
  });
});

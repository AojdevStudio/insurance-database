/**
 * Procedure Code Search Tests
 * 
 * Tests for the procedure code search functionality in the FuzzyMatchingService
 */

import { FuzzyMatchingService } from '../../../src/api/services/fuzzy-matching.service';
import { prisma } from '../../../src/lib/prisma-optimized';

// Mock the Prisma client
jest.mock('../../../src/lib/prisma-optimized', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    procedureRequirement: {
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

describe('FuzzyMatchingService - Procedure Code Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should perform exact procedure code search', async () => {
    // Mock data
    const mockResults = [
      {
        id: '1',
        procedure_code: 'D0120',
        description: 'Periodic oral evaluation',
        category: 'Diagnostic',
        score: 1.0
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with exact search
    const results = await FuzzyMatchingService.findProceduresByCode('D0120', {
      searchType: 'exact'
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe(1);
    expect(results[0].item.procedureCode).toBe('D0120');
    expect(results[0].matchType).toBe('exact');
    expect(results[0].score).toBe(1.0);
  });

  it('should perform prefix procedure code search', async () => {
    // Mock data
    const mockResults = [
      {
        id: '2',
        procedure_code: 'D0140',
        description: 'Limited oral evaluation',
        category: 'Diagnostic',
        score: 0.9
      },
      {
        id: '3',
        procedure_code: 'D0145',
        description: 'Oral evaluation for patient under 3 years',
        category: 'Diagnostic',
        score: 0.9
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with prefix search
    const results = await FuzzyMatchingService.findProceduresByCode('D01', {
      searchType: 'prefix'
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results[0].item.procedureCode).toBe('D0140');
    expect(results[1].item.procedureCode).toBe('D0145');
    expect(results[0].matchType).toBe('prefix');
  });

  it('should perform suffix procedure code search', async () => {
    // Mock data
    const mockResults = [
      {
        id: '4',
        procedure_code: 'D0220',
        description: 'Intraoral - periapical first radiographic image',
        category: 'Diagnostic',
        score: 0.8
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with suffix search
    const results = await FuzzyMatchingService.findProceduresByCode('220', {
      searchType: 'suffix'
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].item.procedureCode).toBe('D0220');
    expect(results[0].matchType).toBe('suffix');
  });

  it('should perform contains procedure code search (default)', async () => {
    // Mock data
    const mockResults = [
      {
        id: '5',
        procedure_code: 'D1351',
        description: 'Sealant - per tooth',
        category: 'Preventive',
        score: 0.7
      },
      {
        id: '6',
        procedure_code: 'D1352',
        description: 'Preventive resin restoration',
        category: 'Preventive',
        score: 0.7
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with default search (contains)
    const results = await FuzzyMatchingService.findProceduresByCode('35');

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results[0].item.procedureCode).toBe('D1351');
    expect(results[1].item.procedureCode).toBe('D1352');
    expect(results[0].matchType).toBe('contains');
  });

  it('should perform fuzzy procedure code search', async () => {
    // Mock data
    const mockResults = [
      {
        id: '7',
        procedure_code: 'D2140',
        description: 'Amalgam - one surface, primary or permanent',
        category: 'Restorative',
        score: 0.6
      },
      {
        id: '8',
        procedure_code: 'D2150',
        description: 'Amalgam - two surfaces, primary or permanent',
        category: 'Restorative',
        score: 0.5
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with fuzzy search
    const results = await FuzzyMatchingService.findProceduresByCode('D214', {
      searchType: 'fuzzy',
      minScore: 0.5
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results[0].item.procedureCode).toBe('D2140');
    expect(results[1].item.procedureCode).toBe('D2150');
    expect(results[0].matchType).toBe('fuzzy');
    expect(results[0].score).toBe(0.6);
    expect(results[1].score).toBe(0.5);
  });

  it('should include procedure requirements when requested', async () => {
    // Mock procedure data
    const mockProcedures = [
      {
        id: '9',
        procedure_code: 'D4341',
        description: 'Periodontal scaling and root planing',
        category: 'Periodontics',
        score: 1.0
      }
    ];

    // Mock requirements data
    const mockRequirements = [
      {
        id: BigInt(101),
        procedureId: BigInt(9),
        requirementType: 'X-Ray',
        description: 'Requires periapical X-rays',
        carrierId: BigInt(1),
        carrier: {
          id: BigInt(1),
          carrierName: 'Delta Dental'
        }
      },
      {
        id: BigInt(102),
        procedureId: BigInt(9),
        requirementType: 'Documentation',
        description: 'Requires periodontal charting',
        carrierId: BigInt(1),
        carrier: {
          id: BigInt(1),
          carrierName: 'Delta Dental'
        }
      }
    ];

    // Mock the Prisma methods
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockProcedures);
    (prisma.procedureRequirement.findMany as jest.Mock).mockResolvedValue(mockRequirements);

    // Call the method with includeRequirements=true
    const results = await FuzzyMatchingService.findProceduresByCode('D4341', {
      searchType: 'exact',
      includeRequirements: true
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.procedureRequirement.findMany).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].item.procedureCode).toBe('D4341');
    expect(results[0].item.requirements).toHaveLength(2);
    expect(results[0].item.requirements[0].requirementType).toBe('X-Ray');
    expect(results[0].item.requirements[1].requirementType).toBe('Documentation');
    expect(results[0].item.requirements[0].carrierName).toBe('Delta Dental');
  });

  it('should apply category filter when provided', async () => {
    // Mock data
    const mockResults = [
      {
        id: '10',
        procedure_code: 'D7140',
        description: 'Extraction, erupted tooth or exposed root',
        category: 'Oral Surgery',
        score: 1.0
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with category filter
    const results = await FuzzyMatchingService.findProceduresByCode('D7140', {
      searchType: 'exact',
      category: 'Oral Surgery'
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].item.category).toBe('Oral Surgery');
  });

  it('should handle empty results', async () => {
    // Mock empty results
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    // Call the method
    const results = await FuzzyMatchingService.findProceduresByCode('NONEXISTENT');

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });

  it('should handle database errors gracefully', async () => {
    // Mock a database error
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    // Call the method and expect it to throw
    await expect(FuzzyMatchingService.findProceduresByCode('D0120')).rejects.toThrow('Failed to perform procedure code search');
  });
});

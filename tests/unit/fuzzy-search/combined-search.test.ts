/**
 * Combined Search Tests
 * 
 * Tests for the combined search functionality in the FuzzyMatchingService
 */

import { FuzzyMatchingService } from '../../../src/api/services/fuzzy-matching.service';

// Mock the service methods
jest.mock('../../../src/api/services/fuzzy-matching.service', () => {
  const originalModule = jest.requireActual('../../../src/api/services/fuzzy-matching.service');
  
  return {
    ...originalModule,
    FuzzyMatchingService: {
      ...originalModule.FuzzyMatchingService,
      findCarriersByFuzzyName: jest.fn(),
      findProceduresByCode: jest.fn(),
      fullTextSearch: jest.fn(),
      findNetworksByFuzzyName: jest.fn(),
      combinedSearch: originalModule.FuzzyMatchingService.combinedSearch
    }
  };
});

// Mock the logger
jest.mock('../../../src/api/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('FuzzyMatchingService - Combined Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should perform combined search across all entities', async () => {
    // Mock carrier results
    const mockCarriers = [
      {
        item: {
          id: 1,
          carrierName: 'Delta Dental',
          carrierCode: 'DELTA'
        },
        score: 0.8
      }
    ];

    // Mock procedure results
    const mockProcedures = [
      {
        item: {
          id: 101,
          procedureCode: 'D0120',
          description: 'Periodic oral evaluation',
          category: 'Diagnostic'
        },
        matchType: 'contains',
        score: 0.7
      }
    ];

    // Mock guideline results
    const mockGuidelines = [
      {
        item: {
          id: 201,
          title: 'Root Canal Guidelines',
          content: 'Detailed guidelines for root canal procedures',
          category: 'Endodontics',
          carrierId: 1,
          carrierName: 'Delta Dental'
        },
        rank: 0.75,
        highlights: ['<b>Root</b> Canal Guidelines']
      }
    ];

    // Mock network results
    const mockNetworks = [
      {
        item: {
          id: 301,
          networkName: 'Premier Network',
          networkCode: 'PREMIER'
        },
        score: 0.6
      }
    ];

    // Set up the mocks
    (FuzzyMatchingService.findCarriersByFuzzyName as jest.Mock).mockResolvedValue(mockCarriers);
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue(mockProcedures);
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue(mockGuidelines);
    (FuzzyMatchingService.findNetworksByFuzzyName as jest.Mock).mockResolvedValue(mockNetworks);

    // Call the method
    const results = await FuzzyMatchingService.combinedSearch('dental');

    // Assertions
    expect(FuzzyMatchingService.findCarriersByFuzzyName).toHaveBeenCalledWith('dental', expect.any(Object));
    expect(FuzzyMatchingService.findProceduresByCode).toHaveBeenCalledWith('dental', expect.any(Object));
    expect(FuzzyMatchingService.fullTextSearch).toHaveBeenCalledWith('dental', expect.any(Object));
    expect(FuzzyMatchingService.findNetworksByFuzzyName).toHaveBeenCalledWith('dental', expect.any(Object));
    
    expect(results.carriers).toEqual(mockCarriers);
    expect(results.procedures).toEqual(mockProcedures);
    expect(results.guidelines).toEqual(mockGuidelines);
    expect(results.networks).toEqual(mockNetworks);
    expect(results.totalResults).toBe(4);
  });

  it('should respect entity inclusion flags', async () => {
    // Set up the mocks
    (FuzzyMatchingService.findCarriersByFuzzyName as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findNetworksByFuzzyName as jest.Mock).mockResolvedValue([]);

    // Call the method with specific entity inclusions
    await FuzzyMatchingService.combinedSearch('dental', {
      includeCarriers: true,
      includeProcedures: false,
      includeGuidelines: true,
      includeNetworks: false
    });

    // Assertions
    expect(FuzzyMatchingService.findCarriersByFuzzyName).toHaveBeenCalled();
    expect(FuzzyMatchingService.findProceduresByCode).not.toHaveBeenCalled();
    expect(FuzzyMatchingService.fullTextSearch).toHaveBeenCalled();
    expect(FuzzyMatchingService.findNetworksByFuzzyName).not.toHaveBeenCalled();
  });

  it('should apply category filter where applicable', async () => {
    // Set up the mocks
    (FuzzyMatchingService.findCarriersByFuzzyName as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findNetworksByFuzzyName as jest.Mock).mockResolvedValue([]);

    // Call the method with category filter
    await FuzzyMatchingService.combinedSearch('dental', {
      filterCategory: 'Diagnostic'
    });

    // Assertions
    expect(FuzzyMatchingService.findProceduresByCode).toHaveBeenCalledWith('dental', expect.objectContaining({
      category: 'Diagnostic'
    }));
    expect(FuzzyMatchingService.fullTextSearch).toHaveBeenCalledWith('dental', expect.objectContaining({
      filterCategory: 'Diagnostic'
    }));
  });

  it('should apply minimum score threshold', async () => {
    // Set up the mocks
    (FuzzyMatchingService.findCarriersByFuzzyName as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findNetworksByFuzzyName as jest.Mock).mockResolvedValue([]);

    // Call the method with minimum score
    await FuzzyMatchingService.combinedSearch('dental', {
      minScore: 0.5
    });

    // Assertions
    expect(FuzzyMatchingService.findCarriersByFuzzyName).toHaveBeenCalledWith('dental', expect.objectContaining({
      threshold: 0.5
    }));
    expect(FuzzyMatchingService.findProceduresByCode).toHaveBeenCalledWith('dental', expect.objectContaining({
      minScore: 0.5
    }));
    expect(FuzzyMatchingService.fullTextSearch).toHaveBeenCalledWith('dental', expect.objectContaining({
      minRank: 0.5
    }));
    expect(FuzzyMatchingService.findNetworksByFuzzyName).toHaveBeenCalledWith('dental', expect.objectContaining({
      threshold: 0.5
    }));
  });

  it('should handle empty results', async () => {
    // Set up the mocks to return empty arrays
    (FuzzyMatchingService.findCarriersByFuzzyName as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findNetworksByFuzzyName as jest.Mock).mockResolvedValue([]);

    // Call the method
    const results = await FuzzyMatchingService.combinedSearch('nonexistent');

    // Assertions
    expect(results.carriers).toHaveLength(0);
    expect(results.procedures).toHaveLength(0);
    expect(results.guidelines).toHaveLength(0);
    expect(results.networks).toHaveLength(0);
    expect(results.totalResults).toBe(0);
  });

  it('should handle errors in individual search methods', async () => {
    // Mock one method to throw an error
    (FuzzyMatchingService.findCarriersByFuzzyName as jest.Mock).mockRejectedValue(new Error('Carrier search failed'));
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue([]);
    (FuzzyMatchingService.findNetworksByFuzzyName as jest.Mock).mockResolvedValue([]);

    // Call the method and expect it to throw
    await expect(FuzzyMatchingService.combinedSearch('error')).rejects.toThrow('Failed to perform combined search');
  });
});

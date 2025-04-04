/**
 * Combined Search API Integration Tests
 * 
 * Tests for the combined search API endpoint
 */

import request from 'supertest';
import app from '../../../src/api/app';
import { FuzzyMatchingService } from '../../../src/api/services/fuzzy-matching.service';

// Mock the FuzzyMatchingService
jest.mock('../../../src/api/services/fuzzy-matching.service');

describe('Combined Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return combined search results when query is provided', async () => {
    // Mock data
    const mockResults = {
      carriers: [
        {
          item: {
            id: 1,
            carrierName: 'Delta Dental',
            carrierCode: 'DELTA'
          },
          score: 0.8
        }
      ],
      procedures: [
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
      ],
      guidelines: [
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
      ],
      networks: [
        {
          item: {
            id: 301,
            networkName: 'Premier Network',
            networkCode: 'PREMIER'
          },
          score: 0.6
        }
      ],
      totalResults: 4
    };

    // Mock the service method
    (FuzzyMatchingService.combinedSearch as jest.Mock).mockResolvedValue(mockResults);

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/combined')
      .query({ query: 'dental' });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toEqual(mockResults);
    expect(response.body.totalResults).toBe(4);
    expect(response.body.entityCounts.carriers).toBe(1);
    expect(response.body.entityCounts.procedures).toBe(1);
    expect(response.body.entityCounts.guidelines).toBe(1);
    expect(response.body.entityCounts.networks).toBe(1);
    expect(FuzzyMatchingService.combinedSearch).toHaveBeenCalledWith('dental', expect.any(Object));
  });

  it('should return 400 when query is not provided', async () => {
    // Make the request without a query
    const response = await request(app)
      .get('/api/fuzzy-search/combined');

    // Assertions
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Query parameter is required');
    expect(FuzzyMatchingService.combinedSearch).not.toHaveBeenCalled();
  });

  it('should pass all query parameters to the service', async () => {
    // Mock empty results
    const mockResults = {
      carriers: [],
      procedures: [],
      guidelines: [],
      networks: [],
      totalResults: 0
    };

    // Mock the service method
    (FuzzyMatchingService.combinedSearch as jest.Mock).mockResolvedValue(mockResults);

    // Make the request with all parameters
    const response = await request(app)
      .get('/api/fuzzy-search/combined')
      .query({
        query: 'dental',
        limit: '10',
        includeCarriers: 'true',
        includeProcedures: 'false',
        includeGuidelines: 'true',
        includeNetworks: 'false',
        category: 'Diagnostic',
        minScore: '0.5'
      });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(FuzzyMatchingService.combinedSearch).toHaveBeenCalledWith('dental', {
      limit: 10,
      includeCarriers: true,
      includeProcedures: false,
      includeGuidelines: true,
      includeNetworks: false,
      filterCategory: 'Diagnostic',
      minScore: 0.5
    });
  });

  it('should handle service errors gracefully', async () => {
    // Mock a service error
    (FuzzyMatchingService.combinedSearch as jest.Mock).mockRejectedValue(new Error('Service error'));

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/combined')
      .query({ query: 'error test' });

    // Assertions
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to perform combined search');
    expect(response.body.message).toBe('Service error');
  });

  it('should return empty results when no matches are found', async () => {
    // Mock empty results
    const mockResults = {
      carriers: [],
      procedures: [],
      guidelines: [],
      networks: [],
      totalResults: 0
    };

    // Mock the service method
    (FuzzyMatchingService.combinedSearch as jest.Mock).mockResolvedValue(mockResults);

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/combined')
      .query({ query: 'nonexistent' });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.totalResults).toBe(0);
    expect(response.body.entityCounts.carriers).toBe(0);
    expect(response.body.entityCounts.procedures).toBe(0);
    expect(response.body.entityCounts.guidelines).toBe(0);
    expect(response.body.entityCounts.networks).toBe(0);
  });

  it('should use default entity inclusion flags when not specified', async () => {
    // Mock empty results
    const mockResults = {
      carriers: [],
      procedures: [],
      guidelines: [],
      networks: [],
      totalResults: 0
    };

    // Mock the service method
    (FuzzyMatchingService.combinedSearch as jest.Mock).mockResolvedValue(mockResults);

    // Make the request without entity inclusion flags
    const response = await request(app)
      .get('/api/fuzzy-search/combined')
      .query({ query: 'dental' });

    // Assertions
    expect(response.status).toBe(200);
    expect(FuzzyMatchingService.combinedSearch).toHaveBeenCalledWith('dental', expect.objectContaining({
      includeCarriers: true,
      includeProcedures: true,
      includeGuidelines: true,
      includeNetworks: true
    }));
  });
});

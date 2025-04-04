/**
 * Procedure Code Search API Integration Tests
 * 
 * Tests for the procedure code search API endpoint
 */

import request from 'supertest';
import app from '../../../src/api/app';
import { FuzzyMatchingService } from '../../../src/api/services/fuzzy-matching.service';

// Mock the FuzzyMatchingService
jest.mock('../../../src/api/services/fuzzy-matching.service');

describe('Procedure Code Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return search results when code is provided', async () => {
    // Mock data
    const mockResults = [
      {
        item: {
          id: 1,
          procedureCode: 'D0120',
          description: 'Periodic oral evaluation',
          category: 'Diagnostic'
        },
        matchType: 'exact',
        score: 1.0
      }
    ];

    // Mock the service method
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue(mockResults);

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/procedures/code')
      .query({ code: 'D0120', searchType: 'exact' });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].item.procedureCode).toBe('D0120');
    expect(response.body.results[0].matchType).toBe('exact');
    expect(FuzzyMatchingService.findProceduresByCode).toHaveBeenCalledWith('D0120', expect.objectContaining({
      searchType: 'exact'
    }));
  });

  it('should return 400 when code is not provided', async () => {
    // Make the request without a code
    const response = await request(app)
      .get('/api/fuzzy-search/procedures/code');

    // Assertions
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Code parameter is required');
    expect(FuzzyMatchingService.findProceduresByCode).not.toHaveBeenCalled();
  });

  it('should return 400 when an invalid search type is provided', async () => {
    // Make the request with an invalid search type
    const response = await request(app)
      .get('/api/fuzzy-search/procedures/code')
      .query({ code: 'D0120', searchType: 'invalid' });

    // Assertions
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid search type');
    expect(response.body.validOptions).toEqual(['exact', 'prefix', 'suffix', 'contains', 'fuzzy']);
    expect(FuzzyMatchingService.findProceduresByCode).not.toHaveBeenCalled();
  });

  it('should pass all query parameters to the service', async () => {
    // Mock data
    const mockResults = [
      {
        item: {
          id: 2,
          procedureCode: 'D0140',
          description: 'Limited oral evaluation',
          category: 'Diagnostic',
          requirements: [
            {
              id: 101,
              requirementType: 'X-Ray',
              description: 'Requires periapical X-rays',
              carrierId: 1,
              carrierName: 'Delta Dental'
            }
          ]
        },
        matchType: 'prefix',
        score: 0.9
      }
    ];

    // Mock the service method
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue(mockResults);

    // Make the request with all parameters
    const response = await request(app)
      .get('/api/fuzzy-search/procedures/code')
      .query({
        code: 'D01',
        searchType: 'prefix',
        limit: '5',
        offset: '10',
        category: 'Diagnostic',
        includeRequirements: 'true',
        minScore: '0.5'
      });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(FuzzyMatchingService.findProceduresByCode).toHaveBeenCalledWith('D01', {
      searchType: 'prefix',
      limit: 5,
      offset: 10,
      category: 'Diagnostic',
      includeRequirements: true,
      minScore: 0.5
    });
    expect(response.body.results[0].item.requirements).toHaveLength(1);
  });

  it('should use default search type when not specified', async () => {
    // Mock data
    const mockResults = [
      {
        item: {
          id: 3,
          procedureCode: 'D1351',
          description: 'Sealant - per tooth',
          category: 'Preventive'
        },
        matchType: 'contains',
        score: 0.7
      }
    ];

    // Mock the service method
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue(mockResults);

    // Make the request without specifying search type
    const response = await request(app)
      .get('/api/fuzzy-search/procedures/code')
      .query({ code: '35' });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.searchType).toBe('contains');
    expect(FuzzyMatchingService.findProceduresByCode).toHaveBeenCalledWith('35', expect.objectContaining({
      searchType: undefined
    }));
  });

  it('should handle service errors gracefully', async () => {
    // Mock a service error
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockRejectedValue(new Error('Service error'));

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/procedures/code')
      .query({ code: 'error test' });

    // Assertions
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to perform procedure code search');
    expect(response.body.message).toBe('Service error');
  });

  it('should return empty results when no matches are found', async () => {
    // Mock empty results
    (FuzzyMatchingService.findProceduresByCode as jest.Mock).mockResolvedValue([]);

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/procedures/code')
      .query({ code: 'NONEXISTENT' });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toHaveLength(0);
    expect(response.body.count).toBe(0);
  });
});

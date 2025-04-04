/**
 * Full-Text Search API Integration Tests
 * 
 * Tests for the full-text search API endpoint
 */

import request from 'supertest';
import app from '../../../src/api/app';
import { FuzzyMatchingService } from '../../../src/api/services/fuzzy-matching.service';

// Mock the FuzzyMatchingService
jest.mock('../../../src/api/services/fuzzy-matching.service');

describe('Full-Text Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return search results when query is provided', async () => {
    // Mock data
    const mockResults = [
      {
        item: {
          id: 1,
          title: 'Root Canal Guidelines',
          content: 'Detailed guidelines for root canal procedures',
          category: 'Endodontics',
          carrierId: 101,
          carrierName: 'Delta Dental'
        },
        rank: 0.75,
        highlights: [
          '<b>Root</b> Canal Guidelines',
          'Detailed guidelines for <b>root</b> canal procedures'
        ]
      }
    ];

    // Mock the service method
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue(mockResults);

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/full-text')
      .query({ query: 'root canal' });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].item.title).toBe('Root Canal Guidelines');
    expect(response.body.results[0].highlights).toHaveLength(2);
    expect(FuzzyMatchingService.fullTextSearch).toHaveBeenCalledWith('root canal', expect.any(Object));
  });

  it('should return 400 when query is not provided', async () => {
    // Make the request without a query
    const response = await request(app)
      .get('/api/fuzzy-search/full-text');

    // Assertions
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Query parameter is required');
    expect(FuzzyMatchingService.fullTextSearch).not.toHaveBeenCalled();
  });

  it('should pass all query parameters to the service', async () => {
    // Mock data
    const mockResults = [
      {
        item: {
          id: 2,
          title: 'Implant Guidelines',
          content: 'Guidelines for dental implant procedures',
          category: 'Implants',
          carrierId: 102,
          carrierName: 'Cigna Dental'
        },
        rank: 0.65,
        highlights: [
          'Implant Guidelines',
          'Guidelines for dental <b>implant</b> procedures'
        ]
      }
    ];

    // Mock the service method
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue(mockResults);

    // Make the request with all parameters
    const response = await request(app)
      .get('/api/fuzzy-search/full-text')
      .query({
        query: 'implant',
        limit: '5',
        offset: '10',
        carrierId: '102',
        category: 'Implants',
        includeHighlights: 'true',
        minRank: '0.5'
      });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(FuzzyMatchingService.fullTextSearch).toHaveBeenCalledWith('implant', {
      limit: 5,
      offset: 10,
      filterCarrierId: 102,
      filterCategory: 'Implants',
      includeHighlights: true,
      minRank: 0.5
    });
  });

  it('should handle service errors gracefully', async () => {
    // Mock a service error
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockRejectedValue(new Error('Service error'));

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/full-text')
      .query({ query: 'error test' });

    // Assertions
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to perform full-text search');
    expect(response.body.message).toBe('Service error');
  });

  it('should return empty results when no matches are found', async () => {
    // Mock empty results
    (FuzzyMatchingService.fullTextSearch as jest.Mock).mockResolvedValue([]);

    // Make the request
    const response = await request(app)
      .get('/api/fuzzy-search/full-text')
      .query({ query: 'nonexistent term' });

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toHaveLength(0);
    expect(response.body.count).toBe(0);
  });
});

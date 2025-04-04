/**
 * Full-Text Search Tests
 * 
 * Tests for the full-text search functionality in the FuzzyMatchingService
 */

import { FuzzyMatchingService } from '../../../src/api/services/fuzzy-matching.service';
import { prisma } from '../../../src/lib/prisma-optimized';

// Mock the Prisma client
jest.mock('../../../src/lib/prisma-optimized', () => ({
  prisma: {
    $queryRaw: jest.fn()
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

describe('FuzzyMatchingService - Full-Text Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should perform full-text search with default options', async () => {
    // Mock data
    const mockResults = [
      {
        id: '1',
        title: 'Root Canal Guidelines',
        content: 'Detailed guidelines for root canal procedures',
        category: 'Endodontics',
        carrier_id: '101',
        carrier_name: 'Delta Dental',
        rank: 0.75,
        title_highlights: '<b>Root</b> Canal Guidelines',
        content_highlights: 'Detailed guidelines for <b>root</b> canal procedures'
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method
    const results = await FuzzyMatchingService.fullTextSearch('root canal');

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe(1);
    expect(results[0].item.title).toBe('Root Canal Guidelines');
    expect(results[0].item.carrierId).toBe(101);
    expect(results[0].rank).toBe(0.75);
    expect(results[0].highlights).toContain('<b>Root</b> Canal Guidelines');
  });

  it('should apply filters when provided', async () => {
    // Mock data
    const mockResults = [
      {
        id: '2',
        title: 'Implant Guidelines',
        content: 'Guidelines for dental implant procedures',
        category: 'Implants',
        carrier_id: '102',
        carrier_name: 'Cigna Dental',
        rank: 0.65,
        title_highlights: 'Implant Guidelines',
        content_highlights: 'Guidelines for dental <b>implant</b> procedures'
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with filters
    const results = await FuzzyMatchingService.fullTextSearch('implant', {
      filterCarrierId: 102,
      filterCategory: 'Implants',
      limit: 5,
      offset: 0,
      minRank: 0.5
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe(2);
    expect(results[0].item.category).toBe('Implants');
    expect(results[0].item.carrierId).toBe(102);
  });

  it('should handle empty results', async () => {
    // Mock empty results
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    // Call the method
    const results = await FuzzyMatchingService.fullTextSearch('nonexistent term');

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });

  it('should disable highlights when requested', async () => {
    // Mock data
    const mockResults = [
      {
        id: '3',
        title: 'Orthodontic Coverage',
        content: 'Coverage details for orthodontic treatments',
        category: 'Orthodontics',
        carrier_id: '103',
        carrier_name: 'Aetna Dental',
        rank: 0.55
        // No highlight fields
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with includeHighlights=false
    const results = await FuzzyMatchingService.fullTextSearch('orthodontic', {
      includeHighlights: false
    });

    // Assertions
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe(3);
    expect(results[0].highlights).toBeUndefined();
  });

  it('should handle database errors gracefully', async () => {
    // Mock a database error
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    // Call the method and expect it to throw
    await expect(FuzzyMatchingService.fullTextSearch('query')).rejects.toThrow('Failed to perform full-text search');
  });

  it('should sanitize the search query properly', async () => {
    // Mock data
    const mockResults = [
      {
        id: '4',
        title: 'Periodontal Treatment',
        content: 'Guidelines for periodontal disease treatment',
        category: 'Periodontics',
        carrier_id: '104',
        carrier_name: 'MetLife Dental',
        rank: 0.85,
        title_highlights: '<b>Periodontal</b> Treatment',
        content_highlights: 'Guidelines for <b>periodontal</b> disease treatment'
      }
    ];

    // Mock the Prisma queryRaw method
    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

    // Call the method with a query that needs sanitization
    await FuzzyMatchingService.fullTextSearch('periodontal & disease; treatment');

    // Get the call arguments
    const callArgs = (prisma.$queryRaw as jest.Mock).mock.calls[0][0];
    
    // Convert the SQL template to a string for inspection
    const sqlString = callArgs.strings.join('?');
    
    // Assertions - check that special characters were properly handled
    expect(sqlString).toContain('to_tsquery');
    expect(sqlString).not.toContain('&');
    expect(sqlString).not.toContain(';');
  });
});

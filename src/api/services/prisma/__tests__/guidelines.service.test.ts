/**
 * Tests for the PrismaGuidelineService
 */

import { prismaMock } from '../../../../lib/__mocks__/prisma.js';
import { PrismaGuidelineService } from '../guidelines.service.js';
import { OpenAIService } from '../../openai.service.js';
import { Prisma } from '@prisma/client';

// Mock the dependencies
jest.mock('../../../../lib/prisma.js', () => ({
  prisma: prismaMock
}));

jest.mock('redis', () => {
  const mockRedis = {
    get: jest.fn(),
    setEx: jest.fn(),
    on: jest.fn()
  };
  return {
    createClient: jest.fn(() => mockRedis)
  };
});

jest.mock('../../openai.service.js', () => ({
  OpenAIService: {
    createEmbedding: jest.fn()
  }
}));

describe('PrismaGuidelineService', () => {
  // Sample data for tests
  const mockGuidelines = [
    {
      id: 1,
      title: 'Preventive Care Guidelines',
      content: 'Preventive care services are covered at 100% with no copay.',
      carrier_id: 1,
      category: 'Preventive',
      created_at: new Date('2023-01-01')
    },
    {
      id: 2,
      title: 'Restorative Coverage Policy',
      content: 'Restorative procedures require pre-authorization and are covered at 80%.',
      carrier_id: 1,
      category: 'Restorative',
      created_at: new Date('2023-01-02')
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchGuidelines', () => {
    it('should return paginated guidelines', async () => {
      // Mock Prisma responses
      prismaMock.guideline.count.mockResolvedValue(2);
      prismaMock.guideline.findMany.mockResolvedValue(mockGuidelines);

      // Execute the service method
      const result = await PrismaGuidelineService.searchGuidelines({
        page: 1,
        limit: 10
      });

      // Verify Prisma was called correctly
      expect(prismaMock.guideline.count).toHaveBeenCalledWith({
        where: {}
      });
      expect(prismaMock.guideline.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: {
          created_at: 'desc'
        }
      });

      // Verify the result
      expect(result).toEqual({
        guidelines: mockGuidelines,
        total: 2,
        page: 1,
        limit: 10,
        total_pages: 1
      });
    });

    it('should filter by text query when provided', async () => {
      // Mock Prisma responses
      prismaMock.guideline.count.mockResolvedValue(1);
      prismaMock.guideline.findMany.mockResolvedValue([mockGuidelines[0]]);

      // Execute the service method with text query
      const result = await PrismaGuidelineService.searchGuidelines({
        query: 'preventive'
      });

      // Verify Prisma was called with text search
      const expectedWhere = {
        OR: [
          { title: { contains: 'preventive', mode: 'insensitive' } },
          { content: { contains: 'preventive', mode: 'insensitive' } }
        ]
      };
      expect(prismaMock.guideline.count).toHaveBeenCalledWith({
        where: expectedWhere
      });
      expect(prismaMock.guideline.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        skip: 0,
        take: 10,
        orderBy: {
          created_at: 'desc'
        }
      });

      // Verify the result
      expect(result.guidelines).toHaveLength(1);
      expect(result.guidelines[0].category).toBe('Preventive');
    });

    it('should filter by carrier_id when provided', async () => {
      // Mock Prisma responses
      prismaMock.guideline.count.mockResolvedValue(2);
      prismaMock.guideline.findMany.mockResolvedValue(mockGuidelines);

      // Execute the service method with carrier_id
      const result = await PrismaGuidelineService.searchGuidelines({
        carrier_id: 1
      });

      // Verify Prisma was called with carrier filter
      expect(prismaMock.guideline.count).toHaveBeenCalledWith({
        where: { carrier_id: 1 }
      });
      expect(prismaMock.guideline.findMany).toHaveBeenCalledWith({
        where: { carrier_id: 1 },
        skip: 0,
        take: 10,
        orderBy: {
          created_at: 'desc'
        }
      });

      // Verify the result
      expect(result.guidelines).toHaveLength(2);
    });

    it('should handle Prisma errors properly', async () => {
      // Mock Prisma to throw an error
      const mockError = new Error('Database connection failed');
      prismaMock.guideline.count.mockRejectedValue(mockError);

      // Execute and expect error
      await expect(PrismaGuidelineService.searchGuidelines()).rejects.toThrow();
    });
  });

  describe('semanticSearch', () => {
    it('should search guidelines using vector similarity', async () => {
      // Mock embedding and Prisma responses
      const mockEmbedding = [0.1, 0.2, 0.3]; // Simplified embedding for test
      OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
      
      const mockSemanticResults = [
        {
          ...mockGuidelines[0],
          vector_similarity: 0.25
        }
      ];
      
      // Mock the raw query execution
      prismaMock.$queryRaw.mockResolvedValue(mockSemanticResults);

      // Execute the service method
      const result = await PrismaGuidelineService.semanticSearch({
        query: 'preventive care',
        limit: 5
      });

      // Verify OpenAI service was called
      expect(OpenAIService.createEmbedding).toHaveBeenCalledWith('preventive care');
      
      // Verify the result
      expect(result.guidelines).toHaveLength(1);
      expect(result.guidelines[0].vector_similarity).toBe(0.25);
    });

    it('should require a query for semantic search', async () => {
      // Execute and expect error for missing query
      await expect(PrismaGuidelineService.semanticSearch({
        limit: 5
      })).rejects.toThrow('Query is required for semantic search');
    });
  });

  describe('textSearch', () => {
    it('should search guidelines using text similarity', async () => {
      // Mock Prisma response for text search
      const mockTextResults = [
        {
          ...mockGuidelines[0],
          text_similarity: 0.85
        }
      ];
      
      // Mock the raw query execution
      prismaMock.$queryRaw.mockResolvedValue(mockTextResults);

      // Execute the service method
      const result = await PrismaGuidelineService.textSearch({
        query: 'preventive care',
        limit: 5
      });

      // Verify the result
      expect(result.guidelines).toHaveLength(1);
      expect(result.guidelines[0].text_similarity).toBe(0.85);
    });

    it('should require a query for text search', async () => {
      // Execute and expect error for missing query
      await expect(PrismaGuidelineService.textSearch({
        limit: 5
      })).rejects.toThrow('Query is required for text search');
    });
  });

  describe('hybridSearch', () => {
    it('should search guidelines using combined vector and text similarity', async () => {
      // Mock embedding and Prisma responses
      const mockEmbedding = [0.1, 0.2, 0.3]; // Simplified embedding for test
      OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
      
      const mockHybridResults = [
        {
          ...mockGuidelines[0],
          text_similarity: 0.85,
          vector_similarity: 0.25,
          combined_similarity: 0.67
        }
      ];
      
      // Mock the raw query execution
      prismaMock.$queryRaw.mockResolvedValue(mockHybridResults);

      // Execute the service method
      const result = await PrismaGuidelineService.hybridSearch({
        query: 'preventive care',
        text_weight: 0.4,
        vector_weight: 0.6,
        limit: 5
      });

      // Verify OpenAI service was called
      expect(OpenAIService.createEmbedding).toHaveBeenCalledWith('preventive care');
      
      // Verify the result
      expect(result.guidelines).toHaveLength(1);
      expect(result.guidelines[0].combined_similarity).toBe(0.67);
      expect(result.guidelines[0].text_similarity).toBe(0.85);
      expect(result.guidelines[0].vector_similarity).toBe(0.25);
    });

    it('should require a query for hybrid search', async () => {
      // Execute and expect error for missing query
      await expect(PrismaGuidelineService.hybridSearch({
        limit: 5
      })).rejects.toThrow('Query is required for hybrid search');
    });
  });

  describe('rrf_hybridSearch', () => {
    it('should search guidelines using RRF ranking', async () => {
      // Mock embedding and Prisma responses
      const mockEmbedding = [0.1, 0.2, 0.3]; // Simplified embedding for test
      OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
      
      const mockRRFResults = [
        {
          ...mockGuidelines[0],
          text_similarity: 0.85,
          vector_similarity: 0.25,
          rrf_score: 0.056,
          explanation: 'Found by both text and vector search'
        }
      ];
      
      // Mock the raw query execution
      prismaMock.$queryRaw.mockResolvedValue(mockRRFResults);

      // Execute the service method
      const result = await PrismaGuidelineService.rrf_hybridSearch({
        query: 'preventive care',
        rrf_k: 60.0,
        limit: 5
      });

      // Verify OpenAI service was called
      expect(OpenAIService.createEmbedding).toHaveBeenCalledWith('preventive care');
      
      // Verify the result
      expect(result.guidelines).toHaveLength(1);
      expect(result.guidelines[0].rrf_score).toBe(0.056);
      expect(result.guidelines[0].explanation).toBe('Found by both text and vector search');
    });

    it('should require a query for RRF hybrid search', async () => {
      // Execute and expect error for missing query
      await expect(PrismaGuidelineService.rrf_hybridSearch({
        limit: 5
      })).rejects.toThrow('Query is required for RRF hybrid search');
    });
  });

  describe('search', () => {
    it('should dispatch to semanticSearch by default', async () => {
      // Mock the semantic search method
      const mockSemantic = jest.spyOn(PrismaGuidelineService, 'semanticSearch').mockResolvedValue({
        guidelines: [],
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 0
      });

      // Execute the search method without specifying search_type
      await PrismaGuidelineService.search({
        query: 'test query'
      });

      // Verify semanticSearch was called
      expect(mockSemantic).toHaveBeenCalledWith({
        query: 'test query',
        search_type: 'semantic'
      });

      // Restore the original method
      mockSemantic.mockRestore();
    });

    it('should dispatch to the correct search method based on search_type', async () => {
      // Mock all search methods
      const mockSemantic = jest.spyOn(PrismaGuidelineService, 'semanticSearch').mockResolvedValue({
        guidelines: [],
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 0
      });
      const mockText = jest.spyOn(PrismaGuidelineService, 'textSearch').mockResolvedValue({
        guidelines: [],
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 0
      });
      const mockHybrid = jest.spyOn(PrismaGuidelineService, 'hybridSearch').mockResolvedValue({
        guidelines: [],
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 0
      });
      const mockRRF = jest.spyOn(PrismaGuidelineService, 'rrf_hybridSearch').mockResolvedValue({
        guidelines: [],
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 0
      });

      // Test text search
      await PrismaGuidelineService.search({
        query: 'test query',
        search_type: 'text'
      });
      expect(mockText).toHaveBeenCalled();

      // Test hybrid search
      await PrismaGuidelineService.search({
        query: 'test query',
        search_type: 'hybrid'
      });
      expect(mockHybrid).toHaveBeenCalled();

      // Test RRF hybrid search
      await PrismaGuidelineService.search({
        query: 'test query',
        search_type: 'rrf_hybrid'
      });
      expect(mockRRF).toHaveBeenCalled();

      // Restore the original methods
      mockSemantic.mockRestore();
      mockText.mockRestore();
      mockHybrid.mockRestore();
      mockRRF.mockRestore();
    });

    it('should throw an error for invalid search_type', async () => {
      // Execute and expect error for invalid search_type
      await expect(PrismaGuidelineService.search({
        query: 'test query',
        search_type: 'invalid_search_type'
      })).rejects.toThrow('Invalid search type: invalid_search_type');
    });
  });
});

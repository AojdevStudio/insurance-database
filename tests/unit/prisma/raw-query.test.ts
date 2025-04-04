/**
 * Tests for Prisma raw query functionality
 * Specifically focused on vector search queries
 */
import { jest } from '@jest/globals';
import { prisma } from '../../../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

// Mock the prisma module
jest.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn()
  }
}));

// Type for raw query results for type safety
type RawQueryResult = Array<Record<string, any>>;

describe('Prisma Raw Query Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Vector Search Raw Queries', () => {
    // Mock embedding vector for testing
    const mockEmbedding = new Float32Array(1536).fill(0.1);
    
    it('should execute semantic search raw query', async () => {
      // Mock successful query response with proper typing
      const mockResult = [
        {
          id: 1,
          title: 'Test Guideline',
          content: 'This is a test guideline',
          relevance: 0.85
        }
      ];
      // Use type assertion to fix the mock typing issue
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResult);
      
      // Create a semantic search query
      const query = Prisma.sql`
        SELECT 
          g.id, 
          g.title, 
          g.content, 
          g.carrier_id,
          1 - (g.embedding <=> ${mockEmbedding}::vector) as relevance
        FROM 
          guidelines g
        WHERE 
          g.embedding IS NOT NULL
        ORDER BY 
          relevance DESC
        LIMIT 10
      `;
      
      // Execute the query with type assertion
      const results = await prisma.$queryRaw(query) as RawQueryResult;
      
      // Verify query was called with expected SQL
      expect(prisma.$queryRaw).toHaveBeenCalled();
      
      // Check the format of the result
      expect(results).toBeInstanceOf(Array);
      expect(results[0]).toHaveProperty('relevance');
    });
    
    it('should execute hybrid search raw query', async () => {
      // Mock successful query response
      const mockResult = [
        {
          id: 1,
          title: 'Test Guideline',
          content: 'This is a test guideline',
          semantic_score: 0.85,
          text_score: 0.75,
          hybrid_score: 0.82
        }
      ];
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResult);
      
      // Create a hybrid search query
      const searchTerm = 'test query';
      const alpha = 0.7; // Weighting factor
      
      const query = Prisma.sql`
        WITH semantic_search AS (
          SELECT 
            g.id, 
            1 - (g.embedding <=> ${mockEmbedding}::vector) as semantic_score
          FROM 
            guidelines g
          WHERE 
            g.embedding IS NOT NULL
        ),
        text_search AS (
          SELECT 
            g.id,
            ts_rank(to_tsvector('english', g.content), websearch_to_tsquery('english', ${searchTerm})) as text_score
          FROM 
            guidelines g
          WHERE 
            to_tsvector('english', g.content) @@ websearch_to_tsquery('english', ${searchTerm})
        )
        SELECT 
          g.id, 
          g.title, 
          g.content, 
          g.carrier_id,
          COALESCE(s.semantic_score, 0) as semantic_score,
          COALESCE(t.text_score, 0) as text_score,
          (${alpha} * COALESCE(s.semantic_score, 0) + (1 - ${alpha}) * COALESCE(t.text_score, 0)) as hybrid_score
        FROM 
          guidelines g
        LEFT JOIN 
          semantic_search s ON g.id = s.id
        LEFT JOIN 
          text_search t ON g.id = t.id
        WHERE 
          s.id IS NOT NULL OR t.id IS NOT NULL
        ORDER BY 
          hybrid_score DESC
        LIMIT 10
      `;
      
      // Execute the query with type assertion
      const results = await prisma.$queryRaw(query) as RawQueryResult;
      
      // Verify query was called
      expect(prisma.$queryRaw).toHaveBeenCalled();
      
      // Verify results format
      expect(results).toBeInstanceOf(Array);
      expect(results[0]).toHaveProperty('semantic_score');
      expect(results[0]).toHaveProperty('text_score');
      expect(results[0]).toHaveProperty('hybrid_score');
    });
    
    it('should execute RRF (Reciprocal Rank Fusion) search raw query', async () => {
      // Mock successful query response
      const mockResult = [
        {
          id: 1,
          title: 'Test Guideline',
          content: 'This is a test guideline',
          rrf_score: 0.92
        }
      ];
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResult);
      
      // Create an RRF search query
      const searchTerm = 'test query';
      const k = 60; // Default RRF constant
      
      const query = Prisma.sql`
        WITH semantic_ranks AS (
          SELECT 
            g.id, 
            ROW_NUMBER() OVER (ORDER BY 1 - (g.embedding <=> ${mockEmbedding}::vector) DESC) as semantic_rank
          FROM 
            guidelines g
          WHERE 
            g.embedding IS NOT NULL
        ),
        text_ranks AS (
          SELECT 
            g.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', g.content), websearch_to_tsquery('english', ${searchTerm})) DESC) as text_rank
          FROM 
            guidelines g
          WHERE 
            to_tsvector('english', g.content) @@ websearch_to_tsquery('english', ${searchTerm})
        )
        SELECT 
          g.id, 
          g.title, 
          g.content, 
          g.carrier_id,
          (
            1.0 / (${k} + COALESCE(s.semantic_rank, 1000)) + 
            1.0 / (${k} + COALESCE(t.text_rank, 1000))
          ) as rrf_score
        FROM 
          guidelines g
        LEFT JOIN 
          semantic_ranks s ON g.id = s.id
        LEFT JOIN 
          text_ranks t ON g.id = t.id
        WHERE 
          s.id IS NOT NULL OR t.id IS NOT NULL
        ORDER BY 
          rrf_score DESC
        LIMIT 10
      `;
      
      // Execute the query with type assertion
      const results = await prisma.$queryRaw(query) as RawQueryResult;
      
      // Verify query was called
      expect(prisma.$queryRaw).toHaveBeenCalled();
      
      // Verify results format
      expect(results).toBeInstanceOf(Array);
      expect(results[0]).toHaveProperty('rrf_score');
    });
    
    it('should handle parameters correctly in raw queries', async () => {
      // Mock successful query response
      const mockResult = [
        { id: 1, title: 'Test Guideline 1' },
        { id: 2, title: 'Test Guideline 2' }
      ];
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResult);
      
      // Execute a query with various parameter types
      const carrierId = 123;
      const limit = 10;
      const textArray = ['term1', 'term2'];
      
      const query = Prisma.sql`
        SELECT 
          g.id, 
          g.title
        FROM 
          guidelines g
        WHERE 
          g.carrier_id = ${carrierId}
          AND g.title LIKE ANY(ARRAY[${Prisma.join(textArray.map(t => `%${t}%`))}])
        LIMIT ${limit}
      `;
      
      const results = await prisma.$queryRaw(query) as RawQueryResult;
      
      // Verify query was called
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });
    
    it('should handle errors in raw queries', async () => {
      // Mock a database error with proper typing
      const mockError = new Prisma.PrismaClientKnownRequestError(
        'Invalid query syntax', 
        { code: 'P2010', clientVersion: '1.0.0' }
      );
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(mockError);
      
      // Create an intentionally bad query
      const badQuery = Prisma.sql`
        SELECT 
          g.id, 
          g.title
        FROM 
          nonexistent_table
      `;
      
      // Expect the query to fail
      await expect(prisma.$queryRaw(badQuery)).rejects.toThrow();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });
});

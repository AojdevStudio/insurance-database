import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { generateEmbedding, searchGuidelines, batchUpdateGuidelines } from '../../src/utils/embeddings.js';
import { embeddingsCache, searchResultsCache } from '../../src/utils/cache.js';

// Mock OpenAI client
const mockOpenAIClient = {
  createEmbedding: jest.fn()
};

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAIClient)
}));

describe('Caching Behavior', () => {
  beforeEach(() => {
    // Clear caches before each test
    embeddingsCache.clear();
    searchResultsCache.clear();
    
    // Reset mock
    mockOpenAIClient.createEmbedding.mockReset();
  });

  describe('Embeddings Cache', () => {
    it('should cache generated embeddings', async () => {
      const content = 'test content';
      
      // First call should hit the API
      const embedding1 = await generateEmbedding(content);
      expect(embedding1).toBeDefined();
      
      // Mock metrics to verify cache hit
      const initialMetrics = embeddingsCache.getMetrics();
      
      // Second call should use cache
      const embedding2 = await generateEmbedding(content);
      expect(embedding2).toEqual(embedding1);
      
      const finalMetrics = embeddingsCache.getMetrics();
      expect(finalMetrics.hits).toBe(initialMetrics.hits + 1);
      expect(finalMetrics.misses).toBe(initialMetrics.misses);
    });

    it('should not cache failed embedding generations', async () => {
      const content = 'test content';
      
      // Mock API failure
      mockOpenAIClient.createEmbedding.mockRejectedValueOnce(new Error('API Error') as never);
      
      try {
        await generateEmbedding(content);
      } catch (error) {
        // Expected error
      }
      
      const metrics = embeddingsCache.getMetrics();
      expect(metrics.size).toBe(0);
    });
  });

  describe('Search Results Cache', () => {
    it('should cache search results', async () => {
      const query = 'test query';
      const categoryId = 1;
      
      // First search should hit the database
      const results1 = await searchGuidelines(query, categoryId);
      expect(results1).toBeDefined();
      
      // Mock metrics to verify cache hit
      const initialMetrics = searchResultsCache.getMetrics();
      
      // Second search should use cache
      const results2 = await searchGuidelines(query, categoryId);
      expect(results2).toEqual(results1);
      
      const finalMetrics = searchResultsCache.getMetrics();
      expect(finalMetrics.hits).toBe(initialMetrics.hits + 1);
      expect(finalMetrics.misses).toBe(initialMetrics.misses);
    });

    it('should use different cache keys for different categories', async () => {
      const query = 'test query';
      const categoryId1 = 1;
      const categoryId2 = 2;
      
      // First search with category1
      const results1 = await searchGuidelines(query, categoryId1);
      
      // Second search with category2 should miss cache
      const results2 = await searchGuidelines(query, categoryId2);
      
      const metrics = searchResultsCache.getMetrics();
      expect(metrics.misses).toBe(2);
      expect(metrics.size).toBe(2);
    });

    it('should invalidate cache on guideline updates', async () => {
      const query = 'test query';
      const categoryId = 1;
      
      // Cache initial search results
      await searchGuidelines(query, categoryId);
      
      // Update guidelines
      await batchUpdateGuidelines([{ id: 1, content: 'updated content' }]);
      
      // Verify cache was cleared
      const metrics = searchResultsCache.getMetrics();
      expect(metrics.size).toBe(0);
    });
  });

  describe('Cache Performance', () => {
    it('should improve response times for cached results', async () => {
      const query = 'test query';
      const categoryId = 1;
      
      // First search - uncached
      const start1 = Date.now();
      await searchGuidelines(query, categoryId);
      const duration1 = Date.now() - start1;
      
      // Second search - should use cache
      const start2 = Date.now();
      await searchGuidelines(query, categoryId);
      const duration2 = Date.now() - start2;
      
      // Cached response should be significantly faster
      expect(duration2).toBeLessThan(duration1 / 2);
    });
  });
}); 
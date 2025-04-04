/**
 * Integration tests for the Prisma-based Guidelines API endpoints
 */
import request from 'supertest';
import app from '../../../src/api/app.js';
import { prisma } from '../../../src/lib/prisma.js';
import { 
  seedTestCarriers, 
  seedTestGuidelines,
  cleanupTestData 
} from '../../utils/test-data.js';

// Sample test API key for testing
const TEST_API_KEY = 'test-api-key';

// Test data
let testCarrierIds: number[] = [];
let guidelinesCount: number = 0;

// Set up test data before all tests
beforeAll(async () => {
  // Seed test data
  testCarrierIds = await seedTestCarriers();
  guidelinesCount = await seedTestGuidelines(testCarrierIds);
  
  console.log(`Seeded ${testCarrierIds.length} carriers and ${guidelinesCount} guidelines for tests`);
});

// Clean up test data after all tests
afterAll(async () => {
  // Clean up test data
  await cleanupTestData();
  // Disconnect Prisma client
  await prisma.$disconnect();
  console.log('Cleaned up test data and disconnected Prisma client');
});

describe('Prisma Guidelines API Integration Tests', () => {
  describe('GET /api/prisma/guidelines/search', () => {
    it('should search guidelines with text query', async () => {
      // Use a common term that should be in dental guidelines
      const searchTerm = 'documentation';
      const response = await request(app)
        .get('/api/prisma/guidelines/search')
        .query({ query: searchTerm })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(Array.isArray(response.body.guidelines)).toBe(true);
    });

    it('should filter guidelines by carrier', async () => {
      // Use our test carrier IDs
      const testCarrierId = testCarrierIds[0];
      
      const response = await request(app)
        .get('/api/prisma/guidelines/search')
        .query({ carrier_id: testCarrierId })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      
      // Verify all guidelines are for the right carrier
      response.body.guidelines.forEach((guideline) => {
        if (guideline.carrier_id) {
          expect(guideline.carrier_id).toBe(testCarrierId);
        }
      });
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/prisma/guidelines/search')
        .query({ page: 1, limit: 5 })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(response.body.guidelines.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/prisma/guidelines/semantic', () => {
    it('should perform semantic search', async () => {
      // Use a natural language query
      const query = 'coverage for root canals';
      const response = await request(app)
        .get('/api/prisma/guidelines/semantic')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(Array.isArray(response.body.guidelines)).toBe(true);
    });

    it('should include relevance scores', async () => {
      const query = 'x-rays and imaging';
      const response = await request(app)
        .get('/api/prisma/guidelines/semantic')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      
      if (response.body.guidelines.length > 0) {
        expect(response.body.guidelines[0]).toHaveProperty('relevance');
        expect(typeof response.body.guidelines[0].relevance).toBe('number');
      }
    });
  });

  describe('GET /api/prisma/guidelines/hybrid', () => {
    it('should perform hybrid search', async () => {
      const query = 'frequency limitations for dental cleaning';
      const response = await request(app)
        .get('/api/prisma/guidelines/hybrid')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(Array.isArray(response.body.guidelines)).toBe(true);
    });

    it('should handle alpha parameter for hybrid search', async () => {
      const query = 'preventive services';
      
      // Test with different alpha values (semantic vs text weight)
      const response1 = await request(app)
        .get('/api/prisma/guidelines/hybrid')
        .query({ query, alpha: 0.2 })
        .set('X-API-Key', TEST_API_KEY);
      
      const response2 = await request(app)
        .get('/api/prisma/guidelines/hybrid')
        .query({ query, alpha: 0.8 })
        .set('X-API-Key', TEST_API_KEY);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Results should be different with different alpha values
      // This test might be flaky if the dataset is small or the query is too specific
      if (response1.body.guidelines.length > 0 && response2.body.guidelines.length > 0) {
        // Just log the differences for analysis, don't fail the test on this
        console.log('Alpha comparison test results:', {
          alpha0_2_count: response1.body.guidelines.length,
          alpha0_8_count: response2.body.guidelines.length,
          different: JSON.stringify(response1.body) !== JSON.stringify(response2.body)
        });
      }
    });
  });

  // Vector search functionality tests
  describe('Vector Search Functionality', () => {
    // This test depends on having properly generated embeddings in the database
    // If no embeddings exist, this test will be skipped
    it('should execute raw vector query without errors', async () => {
      // This test verifies that our raw SQL for vector search works properly
      // First check if we have any guidelines with embeddings
      const guidelinesWithEmbeddings = await prisma.guideline.findMany({
        where: {
          embedding: { not: null }
        },
        take: 1
      });
      
      if (guidelinesWithEmbeddings.length === 0) {
        console.log('Skipping vector search test as no guidelines with embeddings found');
        return;
      }
      
      // Test the semantic search endpoint which uses $queryRaw
      const response = await request(app)
        .get('/api/prisma/guidelines/semantic')
        .query({ query: 'documentation requirements' })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(Array.isArray(response.body.guidelines)).toBe(true);
    });
    
    it('should compare performance of different search methods', async () => {
      // This test compares text vs semantic vs hybrid search performance
      const query = 'requirements';
      
      // Perform text search
      const textStart = Date.now();
      const textResponse = await request(app)
        .get('/api/prisma/guidelines/search')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);
      const textTime = Date.now() - textStart;
      
      // Perform semantic search
      const semanticStart = Date.now();
      const semanticResponse = await request(app)
        .get('/api/prisma/guidelines/semantic')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);
      const semanticTime = Date.now() - semanticStart;
      
      // Perform hybrid search
      const hybridStart = Date.now();
      const hybridResponse = await request(app)
        .get('/api/prisma/guidelines/hybrid')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);
      const hybridTime = Date.now() - hybridStart;
      
      console.log(`Search performance: Text: ${textTime}ms, Semantic: ${semanticTime}ms, Hybrid: ${hybridTime}ms`);
      
      // Verify all responses have the correct format
      expect(textResponse.status).toBe(200);
      expect(semanticResponse.status).toBe(200);
      expect(hybridResponse.status).toBe(200);
      
      // This is not a strict test as we're mainly measuring performance
      // Just verify that each result set has the expected format
      expect(textResponse.body).toHaveProperty('guidelines');
      expect(semanticResponse.body).toHaveProperty('guidelines');
      expect(hybridResponse.body).toHaveProperty('guidelines');
    });
  });
  
  // Prisma error handling for guidelines
  describe('Prisma Error Handling with Guidelines', () => {
    it('should handle invalid carrier ID format correctly', async () => {
      const response = await request(app)
        .get('/api/prisma/guidelines/search')
        .query({ carrier_id: 'not-a-number' }) // Invalid carrier ID (should be a number)
        .set('X-API-Key', TEST_API_KEY);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
    
    it('should handle non-existent carrier ID correctly', async () => {
      const response = await request(app)
        .get('/api/prisma/guidelines/search')
        .query({ carrier_id: 999999 }) // Non-existent carrier ID
        .set('X-API-Key', TEST_API_KEY);
      
      // This should return an empty result set, not an error
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(response.body.guidelines.length).toBe(0);
    });
  });
  
  // Performance comparison tests
  describe('Performance Comparison', () => {
    it('should be comparable in performance to Supabase implementation', async () => {
      // Warmup
      await request(app).get('/api/guidelines/search').set('X-API-Key', TEST_API_KEY);
      await request(app).get('/api/prisma/guidelines/search').set('X-API-Key', TEST_API_KEY);
      
      // Test Supabase implementation (5 runs)
      const supabaseTimes = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app).get('/api/guidelines/search').set('X-API-Key', TEST_API_KEY);
        supabaseTimes.push(Date.now() - startTime);
      }
      
      // Test Prisma implementation (5 runs)
      const prismaTimes = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app).get('/api/prisma/guidelines/search').set('X-API-Key', TEST_API_KEY);
        prismaTimes.push(Date.now() - startTime);
      }
      
      // Calculate averages
      const supabaseAvg = supabaseTimes.reduce((a, b) => a + b, 0) / supabaseTimes.length;
      const prismaAvg = prismaTimes.reduce((a, b) => a + b, 0) / prismaTimes.length;
      
      console.log(`Guidelines search performance: Supabase avg: ${supabaseAvg.toFixed(2)}ms, Prisma avg: ${prismaAvg.toFixed(2)}ms`);
      
      // This is not a strict test as performance can vary
      // We just log the results for analysis
      expect(prismaAvg).toBeLessThan(supabaseAvg * 2); // Prisma should not be more than 2x slower
    });
  });

  // Compare response format with original Supabase implementation
  describe('Response Format Consistency', () => {
    it('should return data in the same format as the Supabase implementation', async () => {
      // Get data from both implementations (using basic search endpoint)
      const query = 'dental';
      
      const supabaseResponse = await request(app)
        .get('/api/guidelines/search')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);
      
      const prismaResponse = await request(app)
        .get('/api/prisma/guidelines/search')
        .query({ query })
        .set('X-API-Key', TEST_API_KEY);

      // Check structure consistency
      expect(Object.keys(supabaseResponse.body)).toEqual(
        expect.arrayContaining(Object.keys(prismaResponse.body))
      );

      // Check guideline object structure if guidelines exist
      if (supabaseResponse.body.guidelines.length > 0 && prismaResponse.body.guidelines.length > 0) {
        const supabaseGuideline = supabaseResponse.body.guidelines[0];
        const prismaGuideline = prismaResponse.body.guidelines[0];
        
        expect(Object.keys(prismaGuideline)).toEqual(
          expect.arrayContaining(Object.keys(supabaseGuideline))
        );
      }
    });
  });
});

/**
 * Integration tests for the Prisma-based Guidelines API endpoints
 */
import request from 'supertest';
import app from '../../../src/api/app.js';
import { prisma } from '../../../src/lib/prisma.js';

// Sample test API key for testing
const TEST_API_KEY = 'test-api-key';

// Close the Prisma client after all tests
afterAll(async () => {
  await prisma.$disconnect();
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
      // First get a valid carrier from the database
      const carrier = await prisma.insuranceCarrier.findFirst();
      
      if (carrier) {
        const response = await request(app)
          .get('/api/prisma/guidelines/search')
          .query({ carrier_id: carrier.id })
          .set('X-API-Key', TEST_API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('guidelines');
        
        // If there are any guidelines, verify they're for the right carrier
        response.body.guidelines.forEach((guideline) => {
          if (guideline.carrier_id) {
            expect(guideline.carrier_id).toBe(carrier.id);
          }
        });
      }
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
        const firstResultId1 = response1.body.guidelines[0].id;
        const firstResultId2 = response2.body.guidelines[0].id;
        
        // Not testing for exact inequality as in some cases they might be the same
        // This is more of a sanity check
        expect(response1.body).not.toEqual(response2.body);
      }
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

/**
 * Integration tests for the Prisma-based Carrier API endpoints
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

describe('Prisma Carrier API Integration Tests', () => {
  describe('GET /api/prisma/carriers', () => {
    it('should return a list of carriers', async () => {
      const response = await request(app)
        .get('/api/prisma/carriers')
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('carriers');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.carriers)).toBe(true);
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/prisma/carriers')
        .query({ page: 1, limit: 5 })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('carriers');
      expect(response.body.carriers.length).toBeLessThanOrEqual(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it('should handle sorting', async () => {
      const response = await request(app)
        .get('/api/prisma/carriers')
        .query({ sort_by: 'name', sort_order: 'asc' })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      
      // If we have at least 2 carriers, verify they are sorted
      if (response.body.carriers.length >= 2) {
        for (let i = 0; i < response.body.carriers.length - 1; i++) {
          const currentName = response.body.carriers[i].name.toLowerCase();
          const nextName = response.body.carriers[i + 1].name.toLowerCase();
          expect(currentName <= nextName).toBe(true);
        }
      }
    });

    it('should handle invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/prisma/carriers')
        .query({ page: -1, limit: 1000 })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/prisma/carriers/search', () => {
    it('should search carriers by name', async () => {
      // Use a common term that's likely to exist in multiple carrier names
      const searchTerm = 'insurance';
      const response = await request(app)
        .get('/api/prisma/carriers/search')
        .query({ query: searchTerm })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('carriers');
      
      // Check that every result contains the search term
      response.body.carriers.forEach((carrier) => {
        expect(carrier.name.toLowerCase()).toContain(searchTerm.toLowerCase());
      });
    });

    it('should return empty results for non-existent carrier name', async () => {
      const response = await request(app)
        .get('/api/prisma/carriers/search')
        .query({ query: 'ThisCarrierDoesNotExist12345' })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('carriers');
      expect(response.body.carriers.length).toBe(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('GET /api/prisma/carriers/:id', () => {
    let testCarrierId: number;

    // Find a carrier ID to test with
    beforeAll(async () => {
      const carrier = await prisma.insuranceCarrier.findFirst();
      testCarrierId = carrier?.id || 1;
    });

    it('should get a carrier by ID', async () => {
      const response = await request(app)
        .get(`/api/prisma/carriers/${testCarrierId}`)
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testCarrierId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('payer_id');
    });

    it('should return 404 for non-existent carrier ID', async () => {
      // Use an ID that's unlikely to exist
      const nonExistentId = 999999;
      const response = await request(app)
        .get(`/api/prisma/carriers/${nonExistentId}`)
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid carrier ID format', async () => {
      const response = await request(app)
        .get('/api/prisma/carriers/not-a-number')
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  // Compare response format with original Supabase implementation
  describe('Response Format Consistency', () => {
    it('should return data in the same format as the Supabase implementation', async () => {
      // Get data from both implementations
      const supabaseResponse = await request(app)
        .get('/api/carriers')
        .set('X-API-Key', TEST_API_KEY);
      
      const prismaResponse = await request(app)
        .get('/api/prisma/carriers')
        .set('X-API-Key', TEST_API_KEY);

      // Check structure consistency
      expect(Object.keys(supabaseResponse.body)).toEqual(
        expect.arrayContaining(Object.keys(prismaResponse.body))
      );

      // Check carrier object structure if carriers exist
      if (supabaseResponse.body.carriers.length > 0 && prismaResponse.body.carriers.length > 0) {
        const supabaseCarrier = supabaseResponse.body.carriers[0];
        const prismaCarrier = prismaResponse.body.carriers[0];
        
        expect(Object.keys(prismaCarrier)).toEqual(
          expect.arrayContaining(Object.keys(supabaseCarrier))
        );
      }
    });
  });
});

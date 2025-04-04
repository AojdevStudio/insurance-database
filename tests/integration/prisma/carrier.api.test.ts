/**
 * Integration tests for the Prisma-based Carrier API endpoints
 */
import request from 'supertest';
import app from '../../../src/api/app.js';
import { prisma } from '../../../src/lib/prisma.js';
import { 
  seedTestCarriers, 
  cleanupTestData 
} from '../../utils/test-data.js';

// Sample test API key for testing
const TEST_API_KEY = 'test-api-key';

// Test data
let testCarrierIds: number[] = [];

// Set up test data before all tests
beforeAll(async () => {
  // Seed test carriers
  testCarrierIds = await seedTestCarriers();
  console.log(`Seeded ${testCarrierIds.length} test carriers for integration tests`);
});

// Clean up test data after all tests
afterAll(async () => {
  // Clean up test data
  await cleanupTestData();
  // Disconnect Prisma client
  await prisma.$disconnect();
  console.log('Cleaned up test data and disconnected Prisma client');
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
  
  // Tests for Prisma-specific error handling
  describe('Prisma Error Handling', () => {
    // Test endpoint for creating carriers - this would need to be added to your API
    // For this test, assume it exists at POST /api/prisma/carriers
    const createEndpoint = '/api/prisma/carriers';
    
    it('should handle validation errors correctly', async () => {
      // Invalid data (missing required fields)
      const invalidData = {
        name: '' // Empty name should fail validation
      };
      
      const response = await request(app)
        .post(createEndpoint)
        .set('X-API-Key', TEST_API_KEY)
        .send(invalidData);
      
      // Should return 400 Bad Request
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should handle unique constraint violations', async () => {
      // First, get an existing carrier
      const existingCarrier = await prisma.insuranceCarrier.findFirst({
        where: { id: testCarrierIds[0] }
      });
      
      if (existingCarrier) {
        // Try to create a carrier with the same payer_id (should violate unique constraint)
        const duplicateData = {
          name: 'Duplicate Carrier',
          payer_id: existingCarrier.payer_id,
          address: '123 Duplicate St, Testville, TX 12345',
          phone: '555-000-0000',
          network_id: 1
        };
        
        const response = await request(app)
          .post(createEndpoint)
          .set('X-API-Key', TEST_API_KEY)
          .send(duplicateData);
        
        // Should return 409 Conflict due to our Prisma error middleware
        expect(response.status).toBe(409);
        expect(response.body.error).toHaveProperty('code', 'UNIQUE_CONSTRAINT_VIOLATION');
      }
    });
  });
  
  // Performance comparison tests
  describe('Performance Comparison', () => {
    it('should be comparable in performance to Supabase implementation', async () => {
      // Warmup
      await request(app).get('/api/carriers').set('X-API-Key', TEST_API_KEY);
      await request(app).get('/api/prisma/carriers').set('X-API-Key', TEST_API_KEY);
      
      // Test Supabase implementation (5 runs)
      const supabaseTimes = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app).get('/api/carriers').set('X-API-Key', TEST_API_KEY);
        supabaseTimes.push(Date.now() - startTime);
      }
      
      // Test Prisma implementation (5 runs)
      const prismaTimes = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app).get('/api/prisma/carriers').set('X-API-Key', TEST_API_KEY);
        prismaTimes.push(Date.now() - startTime);
      }
      
      // Calculate averages
      const supabaseAvg = supabaseTimes.reduce((a, b) => a + b, 0) / supabaseTimes.length;
      const prismaAvg = prismaTimes.reduce((a, b) => a + b, 0) / prismaTimes.length;
      
      console.log(`Performance comparison: Supabase avg: ${supabaseAvg.toFixed(2)}ms, Prisma avg: ${prismaAvg.toFixed(2)}ms`);
      
      // This is not a strict test as performance can vary, but log for analysis
      // For very poor performance, we might want to assert something
      expect(prismaAvg).toBeLessThan(supabaseAvg * 2); // Prisma should not be more than 2x slower
    });
  });
});

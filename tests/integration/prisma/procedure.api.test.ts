/**
 * Integration tests for the Prisma-based Procedure API endpoints
 */
import request from 'supertest';
import app from '../../../src/api/app.js';
import { prisma } from '../../../src/lib/prisma.js';
import { 
  seedTestCarriers, 
  seedTestProcedures, 
  seedTestRequirements,
  cleanupTestData 
} from '../../utils/test-data.js';

// Sample test API key for testing
const TEST_API_KEY = 'test-api-key';

// Test data
let testCarrierIds: number[] = [];
let testProcedureCodes: string[] = [];

// Set up test data before all tests
beforeAll(async () => {
  // Seed test data
  testCarrierIds = await seedTestCarriers();
  testProcedureCodes = await seedTestProcedures();
  const requirementsCount = await seedTestRequirements(testCarrierIds);
  
  console.log(`Seeded ${testCarrierIds.length} carriers, ${testProcedureCodes.length} procedures, and ${requirementsCount} requirements for tests`);
});

// Clean up test data after all tests
afterAll(async () => {
  // Clean up test data
  await cleanupTestData();
  // Disconnect Prisma client
  await prisma.$disconnect();
  console.log('Cleaned up test data and disconnected Prisma client');
});

describe('Prisma Procedure API Integration Tests', () => {
  describe('GET /api/prisma/procedures', () => {
    it('should return a list of procedures', async () => {
      const response = await request(app)
        .get('/api/prisma/procedures')
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('procedures');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.procedures)).toBe(true);
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/prisma/procedures')
        .query({ page: 1, limit: 5 })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('procedures');
      expect(response.body.procedures.length).toBeLessThanOrEqual(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it('should handle category filtering', async () => {
      // First get a valid category from the database
      const procedure = await prisma.procedure.findFirst();
      const category = procedure?.category;

      if (category) {
        const response = await request(app)
          .get('/api/prisma/procedures')
          .query({ category: category })
          .set('X-API-Key', TEST_API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.procedures.length).toBeGreaterThan(0);
        
        // Verify all returned procedures have the specified category
        response.body.procedures.forEach((proc) => {
          expect(proc.category).toBe(category);
        });
      }
    });
  });

  describe('GET /api/prisma/procedures/search', () => {
    it('should search procedures by code', async () => {
      // Use a common code pattern like D or D0 to ensure results
      const searchCode = 'D0';
      const response = await request(app)
        .get('/api/prisma/procedures/search')
        .query({ query: searchCode })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('procedures');
      
      // Check that results contain the search term
      if (response.body.procedures.length > 0) {
        const hasMatch = response.body.procedures.some(proc => 
          proc.code.includes(searchCode) || 
          proc.description.toLowerCase().includes(searchCode.toLowerCase())
        );
        expect(hasMatch).toBe(true);
      }
    });

    it('should search procedures by description', async () => {
      // Use a common term that should be in dental procedure descriptions
      const searchTerm = 'exam';
      const response = await request(app)
        .get('/api/prisma/procedures/search')
        .query({ query: searchTerm })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('procedures');
      
      // Check that at least one result contains the search term
      if (response.body.procedures.length > 0) {
        const hasMatch = response.body.procedures.some(proc => 
          proc.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        expect(hasMatch).toBe(true);
      }
    });
  });

  describe('GET /api/prisma/procedures/:code', () => {
    let testProcedureCode: string;

    // Find a procedure code to test with
    beforeAll(async () => {
      const procedure = await prisma.procedure.findFirst();
      testProcedureCode = procedure?.code || 'D0120';
    });

    it('should get a procedure by code', async () => {
      const response = await request(app)
        .get(`/api/prisma/procedures/${testProcedureCode}`)
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('code', testProcedureCode);
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('category');
    });

    it('should include requirements when requested', async () => {
      const response = await request(app)
        .get(`/api/prisma/procedures/${testProcedureCode}`)
        .query({ include_requirements: true })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('code', testProcedureCode);
      expect(response.body).toHaveProperty('requirements');
      expect(Array.isArray(response.body.requirements)).toBe(true);
    });

    it('should return 404 for non-existent procedure code', async () => {
      const nonExistentCode = 'D99999';
      const response = await request(app)
        .get(`/api/prisma/procedures/${nonExistentCode}`)
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/prisma/procedures/:code/requirements', () => {
    it('should get requirements for a procedure', async () => {
      // Use one of our test procedure codes with requirements
      const testProcedureCode = 'D0120';
      
      const response = await request(app)
        .get(`/api/prisma/procedures/${testProcedureCode}/requirements`)
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requirements');
      expect(Array.isArray(response.body.requirements)).toBe(true);
      expect(response.body.requirements.length).toBeGreaterThan(0);
    });

    it('should filter requirements by carrier', async () => {
      // Use one of our test procedure codes and carrier IDs
      const testProcedureCode = 'D0120';
      const testCarrierId = testCarrierIds[0];
      
      const response = await request(app)
        .get(`/api/prisma/procedures/${testProcedureCode}/requirements`)
        .query({ carrier_id: testCarrierId })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requirements');
      
      // Verify all requirements are for the specified carrier
      response.body.requirements.forEach((req) => {
        expect(req.carrier_id).toBe(testCarrierId);
      });
      
      // Verify at least one requirement was returned
      expect(response.body.requirements.length).toBeGreaterThan(0);
    });
    
    it('should return empty array when procedure has no requirements for specified carrier', async () => {
      // Test with a procedure-carrier combination that has no requirements
      // D0150 should have no requirements for carrier[1]
      const testProcedureCode = 'D0150';
      const testCarrierId = testCarrierIds[1];
      
      const response = await request(app)
        .get(`/api/prisma/procedures/${testProcedureCode}/requirements`)
        .query({ carrier_id: testCarrierId })
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requirements');
      expect(Array.isArray(response.body.requirements)).toBe(true);
      expect(response.body.requirements.length).toBe(0);
    });
    
    it('should handle invalid procedure code', async () => {
      const response = await request(app)
        .get('/api/prisma/procedures/INVALID_CODE/requirements')
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  // Compare response format with original Supabase implementation
  describe('Response Format Consistency', () => {
    it('should return data in the same format as the Supabase implementation', async () => {
      // Get data from both implementations
      const supabaseResponse = await request(app)
        .get('/api/procedures')
        .set('X-API-Key', TEST_API_KEY);
      
      const prismaResponse = await request(app)
        .get('/api/prisma/procedures')
        .set('X-API-Key', TEST_API_KEY);

      // Check structure consistency
      expect(Object.keys(supabaseResponse.body)).toEqual(
        expect.arrayContaining(Object.keys(prismaResponse.body))
      );

      // Check procedure object structure if procedures exist
      if (supabaseResponse.body.procedures.length > 0 && prismaResponse.body.procedures.length > 0) {
        const supabaseProcedure = supabaseResponse.body.procedures[0];
        const prismaProcedure = prismaResponse.body.procedures[0];
        
        expect(Object.keys(prismaProcedure)).toEqual(
          expect.arrayContaining(Object.keys(supabaseProcedure))
        );
      }
    });
  });
});

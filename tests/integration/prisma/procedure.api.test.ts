/**
 * Integration tests for the Prisma-based Procedure API endpoints
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
    let testProcedureCode: string;

    // Find a procedure code to test with
    beforeAll(async () => {
      const procedure = await prisma.procedure.findFirst({
        where: {
          requirements: {
            some: {}
          }
        },
        include: {
          requirements: true
        }
      });
      
      // If no procedure with requirements is found, use a known code
      testProcedureCode = procedure?.code || 'D0120';
    });

    it('should get requirements for a procedure', async () => {
      const response = await request(app)
        .get(`/api/prisma/procedures/${testProcedureCode}/requirements`)
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requirements');
      expect(Array.isArray(response.body.requirements)).toBe(true);
    });

    it('should filter requirements by carrier', async () => {
      // First get a valid carrier from the database
      const carrier = await prisma.insuranceCarrier.findFirst();
      
      if (carrier) {
        const response = await request(app)
          .get(`/api/prisma/procedures/${testProcedureCode}/requirements`)
          .query({ carrier_id: carrier.id })
          .set('X-API-Key', TEST_API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('requirements');
        
        // If there are any requirements, check they're for the right carrier
        response.body.requirements.forEach((req) => {
          if (req.carrier_id) {
            expect(req.carrier_id).toBe(carrier.id);
          }
        });
      }
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

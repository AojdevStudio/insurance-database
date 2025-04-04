import { prisma, testConnection } from '../../../../src/lib/prisma';

describe('Prisma Client Integration Tests', () => {
  
  beforeAll(async () => {
    // Test database connection
    const isConnected = await testConnection();
    expect(isConnected).toBe(true);
  });

  afterAll(async () => {
    // Disconnect Prisma after all tests
    await prisma.$disconnect();
  });

  describe('Basic CRUD Operations', () => {
    
    // Test carrier to be used/cleaned up during tests
    const testCarrierName = 'Test Carrier For Prisma Integration';
    let testCarrierId: bigint;

    // Clean up after tests
    afterAll(async () => {
      try {
        // Clean up test carrier if it exists
        if (testCarrierId) {
          await prisma.insuranceCarrier.delete({
            where: { id: testCarrierId }
          });
        }
      } catch (error) {
        console.error('Error cleaning up test data:', error);
      }
    });

    test('Should create a new insurance carrier', async () => {
      const newCarrier = await prisma.insuranceCarrier.create({
        data: {
          name: testCarrierName,
        }
      });
      
      expect(newCarrier).toBeDefined();
      expect(newCarrier.name).toBe(testCarrierName);
      expect(newCarrier.id).toBeDefined();
      
      // Save the ID for later cleanup
      testCarrierId = newCarrier.id;
    });

    test('Should find the created carrier by ID', async () => {
      // Skip if creation test failed
      if (!testCarrierId) {
        return;
      }

      const foundCarrier = await prisma.insuranceCarrier.findUnique({
        where: { id: testCarrierId }
      });
      
      expect(foundCarrier).toBeDefined();
      expect(foundCarrier?.name).toBe(testCarrierName);
    });

    test('Should update the carrier', async () => {
      // Skip if creation test failed
      if (!testCarrierId) {
        return;
      }

      const updatedName = `${testCarrierName} Updated`;
      const updatedCarrier = await prisma.insuranceCarrier.update({
        where: { id: testCarrierId },
        data: { name: updatedName }
      });
      
      expect(updatedCarrier).toBeDefined();
      expect(updatedCarrier.name).toBe(updatedName);
    });
  });

  describe('Relation Queries', () => {
    test('Should fetch carriers with related documents', async () => {
      const carriersWithDocs = await prisma.insuranceCarrier.findMany({
        take: 5, // Limit results
        include: {
          documents: true
        }
      });
      
      expect(Array.isArray(carriersWithDocs)).toBe(true);
      // Carriers might not have documents, but the query should execute successfully
      carriersWithDocs.forEach(carrier => {
        expect(carrier).toHaveProperty('documents');
        expect(Array.isArray(carrier.documents)).toBe(true);
      });
    });

    test('Should fetch networks with carriers', async () => {
      const networksWithCarriers = await prisma.insuranceNetwork.findMany({
        take: 5, // Limit results
        include: {
          networkCarrierRelationships: {
            include: {
              carrier: true
            }
          }
        }
      });
      
      expect(Array.isArray(networksWithCarriers)).toBe(true);
      networksWithCarriers.forEach(network => {
        expect(network).toHaveProperty('networkCarrierRelationships');
        expect(Array.isArray(network.networkCarrierRelationships)).toBe(true);
      });
    });
  });

  describe('Complex Queries', () => {
    test('Should find procedures with specific code pattern', async () => {
      const dentistryProcedures = await prisma.procedure.findMany({
        where: {
          procedure_code: {
            startsWith: 'D'
          }
        },
        take: 10 // Limit results
      });
      
      expect(Array.isArray(dentistryProcedures)).toBe(true);
      // This might fail if there are no procedures with the pattern,
      // but the query should still execute
    });

    test('Should filter carriers by name containing specific text', async () => {
      const carriers = await prisma.insuranceCarrier.findMany({
        where: {
          name: {
            contains: 'Dental',
            mode: 'insensitive' // Case-insensitive search
          }
        },
        take: 10 // Limit results
      });
      
      expect(Array.isArray(carriers)).toBe(true);
      // This might return empty if no carriers match, but query should execute
    });
  });
});

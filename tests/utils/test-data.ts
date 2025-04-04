/**
 * Test data utilities for integration tests
 */
import { prisma } from '../../src/lib/prisma.js';

/**
 * Seeds the database with test carriers
 * @returns Created carrier IDs
 */
export async function seedTestCarriers() {
  const result = await prisma.insuranceCarrier.createMany({
    data: [
      {
        name: 'Test Carrier 1',
        payer_id: 'TEST001',
        address: '123 Test St, Testville, TX 12345',
        phone: '555-123-4567',
        network_id: 1
      },
      {
        name: 'Test Carrier 2',
        payer_id: 'TEST002',
        address: '456 Test Ave, Testville, TX 12345',
        phone: '555-987-6543',
        network_id: 1
      },
      {
        name: 'Test Carrier 3',
        payer_id: 'TEST003',
        address: '789 Test Blvd, Testville, TX 12345',
        phone: '555-111-2222',
        network_id: 2
      }
    ],
    skipDuplicates: true
  });

  // Get IDs of created carriers
  const carriers = await prisma.insuranceCarrier.findMany({
    where: {
      payer_id: {
        in: ['TEST001', 'TEST002', 'TEST003']
      }
    },
    select: { id: true }
  });

  return carriers.map(c => c.id);
}

/**
 * Seeds the database with test procedures
 * @returns Created procedure codes
 */
export async function seedTestProcedures() {
  const result = await prisma.procedure.createMany({
    data: [
      {
        code: 'D0120',
        description: 'Periodic oral evaluation',
        category: 'Diagnostic'
      },
      {
        code: 'D0150',
        description: 'Comprehensive oral evaluation',
        category: 'Diagnostic'
      },
      {
        code: 'D1110',
        description: 'Prophylaxis - adult',
        category: 'Preventive'
      }
    ],
    skipDuplicates: true
  });

  return ['D0120', 'D0150', 'D1110'];
}

/**
 * Seeds the database with test procedure requirements
 * @param carrierIds IDs of carriers to associate with requirements
 * @returns Number of requirements created
 */
export async function seedTestRequirements(carrierIds: number[]) {
  if (carrierIds.length < 2) {
    throw new Error('At least 2 carrier IDs are required');
  }

  const result = await prisma.procedureRequirement.createMany({
    data: [
      {
        procedure_code: 'D0120',
        carrier_id: carrierIds[0],
        documentation: 'Patient must have been seen in the last 6 months',
        frequency: '2 per 12 months'
      },
      {
        procedure_code: 'D0150',
        carrier_id: carrierIds[0],
        documentation: 'Required for new patients or patients not seen in 3+ years',
        frequency: '1 per 3 years per provider'
      },
      {
        procedure_code: 'D1110',
        carrier_id: carrierIds[1],
        documentation: 'No special documentation required',
        frequency: '2 per calendar year'
      }
    ],
    skipDuplicates: true
  });

  return result.count;
}

/**
 * Seeds the database with test guidelines
 * @param carrierIds IDs of carriers to associate with guidelines
 * @returns Number of guidelines created
 */
export async function seedTestGuidelines(carrierIds: number[]) {
  if (carrierIds.length < 2) {
    throw new Error('At least 2 carrier IDs are required');
  }

  // This assumes your guideline table structure
  // Adjust the query based on your actual schema
  try {
    // Insert test guidelines
    await prisma.guideline.createMany({
      data: [
        {
          title: 'Documentation Requirements',
          content: 'All procedures require proper documentation including date of service and provider information',
          carrier_id: carrierIds[0],
          // Set embedding to empty vector if required
          embedding: null
        },
        {
          title: 'Frequency Limitations',
          content: 'Preventive services are generally limited to 2 per calendar year',
          carrier_id: carrierIds[1],
          embedding: null
        },
        {
          title: 'Clinical Review Guidelines',
          content: 'All complex restorative procedures require pre-authorization with full clinical documentation',
          carrier_id: carrierIds[0],
          embedding: null
        }
      ],
      skipDuplicates: true
    });
    
    return 3; // Number of guidelines created
  } catch (error) {
    console.error('Error seeding guidelines:', error);
    return 0;
  }
}

/**
 * Cleans up all test data
 */
export async function cleanupTestData() {
  // Delete in correct order to respect foreign key constraints
  await prisma.procedureRequirement.deleteMany({
    where: {
      carrier_id: {
        in: await getTestCarrierIds()
      }
    }
  });
  
  await prisma.guideline.deleteMany({
    where: {
      carrier_id: {
        in: await getTestCarrierIds()
      }
    }
  });
  
  await prisma.procedure.deleteMany({
    where: {
      code: {
        in: ['D0120', 'D0150', 'D1110']
      }
    }
  });
  
  await prisma.insuranceCarrier.deleteMany({
    where: {
      payer_id: {
        in: ['TEST001', 'TEST002', 'TEST003']
      }
    }
  });
}

/**
 * Helper to get IDs of test carriers
 */
async function getTestCarrierIds(): Promise<number[]> {
  const carriers = await prisma.insuranceCarrier.findMany({
    where: {
      payer_id: {
        in: ['TEST001', 'TEST002', 'TEST003']
      }
    },
    select: { id: true }
  });
  
  return carriers.map(c => c.id);
}

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

/**
 * Validates the database connection
 * This script is used in CI/CD pipelines to ensure the database is accessible
 */
async function validateDatabaseConnection() {
  console.log('Validating database connection...');
  
  try {
    // Attempt to connect to the database
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Perform a simple query to verify schema access
    const carrierCount = await prisma.carrier.count();
    console.log(`✅ Schema validation successful (Found ${carrierCount} carriers)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the validation
validateDatabaseConnection();

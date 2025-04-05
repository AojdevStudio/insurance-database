/**
 * CI/CD Database Initialization Script
 * 
 * This script initializes the database for CI/CD environments by:
 * 1. Ensuring the vector extension is installed
 * 2. Running Prisma migrations
 * 3. Validating the database schema
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connection successful');

    // Ensure vector extension is installed
    console.log('Ensuring vector extension is installed...');
    try {
      await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('Vector extension installed/confirmed');
    } catch (error) {
      console.warn('Warning: Could not install vector extension:', error.message);
      console.warn('This may be expected if the database user does not have superuser privileges');
      console.warn('The workflow will continue, but vector operations may fail');
    }

    // Run Prisma migrations
    console.log('Running Prisma migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Migrations completed successfully');

    // Validate schema by testing a simple query
    console.log('Validating schema...');
    try {
      await prisma.insuranceCarrier.findFirst();
      console.log('Schema validation successful');
    } catch (error) {
      console.error('Schema validation failed:', error.message);
      console.error('Stack Trace:', error.stack);
      process.exit(1);
    }

    console.log('Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    console.error('Stack Trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase();

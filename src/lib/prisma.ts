/**
 * Singleton pattern for PrismaClient to prevent multiple instances during hot-reload in development
 */

import { PrismaClient } from '@prisma/client';

// Define global variable for PrismaClient instance
declare global {
  var prisma: PrismaClient | undefined;
}

// Configuration for PrismaClient
const prismaClientOptions: { log: any[] } = {
  // Configure logging based on environment
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
};

// Create or reuse PrismaClient instance
export const prisma = global.prisma || new PrismaClient(prismaClientOptions);

// Save the instance to the global object in development to prevent duplicate instances
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Function to handle graceful shutdown
export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    console.log('Prisma Client disconnected.');
  } catch (error) {
    console.error('Error disconnecting Prisma Client:', error);
    process.exit(1);
  }
}

// Utility function to check database connection
export async function testConnection() {
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection successful!');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export default prisma;

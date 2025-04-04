/**
 * Enhanced Singleton pattern for PrismaClient with performance optimizations
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../api/utils/logger.js';

// Define global variable for PrismaClient instance
declare global {
  var prisma: PrismaClient | undefined;
}

// Performance-optimized configuration for PrismaClient
const prismaClientOptions: { log: any[]; maxWait?: number; timeout?: number } = {
  // Configure logging based on environment
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
  
  // Add connection timeout (ms) to prevent hanging operations
  timeout: 30000,
  
  // Maximum wait time (ms) for a connection from the pool
  maxWait: 5000,
};

// Connection management vars
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// Create or reuse PrismaClient instance with connection retry logic
export const createPrismaClient = async (): Promise<PrismaClient> => {
  // If we already have a client in development, reuse it
  if (global.prisma) {
    return global.prisma;
  }

  // Create a new client with optimized settings
  const client = new PrismaClient(prismaClientOptions);

  // Test connection with retry logic
  while (!isConnected && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    try {
      // Simple query to test connection
      await client.$queryRaw`SELECT 1`;
      isConnected = true;
      logger.info('Database connection established successfully');
    } catch (error) {
      connectionAttempts++;
      logger.warn(`Database connection attempt ${connectionAttempts} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Wait before retrying (exponential backoff)
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        const backoffTime = Math.pow(2, connectionAttempts) * 1000;
        logger.info(`Retrying in ${backoffTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        logger.error('Maximum connection attempts reached, unable to connect to database');
        throw new Error('Failed to connect to database after multiple attempts');
      }
    }
  }

  // Save the instance to the global object in development to prevent duplicate instances
  if (process.env.NODE_ENV !== 'production') {
    global.prisma = client;
  }

  return client;
};

// Export the singleton instance with lazy initialization
export const prisma = global.prisma || new PrismaClient(prismaClientOptions);

// Save instance in development
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Function to handle graceful shutdown with proper client cleanup
export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    isConnected = false;
    connectionAttempts = 0;
    logger.info('Prisma Client disconnected gracefully');
  } catch (error) {
    logger.error('Error disconnecting Prisma Client:', error);
    process.exit(1);
  }
}

// Enhanced connection test function with detailed error reporting
export async function testConnection() {
  try {
    const startTime = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    logger.info(`Database connection successful! Response time: ${responseTime.toFixed(2)}ms`);
    
    // Performance warning if response is slow
    if (responseTime > 1000) {
      logger.warn(`Database connection is slow (${responseTime.toFixed(2)}ms). Check network or database load.`);
    }
    
    return {
      connected: true,
      responseTime
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database connection failed:', errorMessage);
    
    return {
      connected: false,
      error: errorMessage
    };
  }
}

// Query performance monitoring middleware
export const withQueryPerformance = async <T>(
  queryName: string, 
  queryFn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  try {
    const result = await queryFn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log slow queries for optimization
    if (duration > 500) {
      logger.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
    } else {
      logger.debug(`Query ${queryName} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    logger.error(`Query ${queryName} failed after ${duration.toFixed(2)}ms with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};

// Connection pool management helper
export const optimizePrismaConnections = async () => {
  // Reset client connections if too many open connections
  try {
    // Check current metrics (available in Prisma preview features)
    const metrics = await prisma.$metrics.json();
    logger.debug('Prisma connection metrics:', metrics);
    
    // If too many idle connections, reset the client
    if (metrics.connectionInfo?.idle > 5) {
      logger.info('Too many idle connections, disconnecting Prisma client');
      await prisma.$disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await prisma.$connect();
      logger.info('Prisma client reconnected with fresh connection pool');
    }
  } catch (error) {
    // Metrics might not be available in all Prisma versions
    logger.debug('Could not retrieve Prisma metrics:', error);
  }
};

export default prisma;

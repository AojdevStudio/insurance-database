/**
 * Jest global teardown
 * Runs after all tests complete
 */

// Define global console for linting
/* global console */

export default async function() {
  console.log('\nCleaning up test environment...');
  
  try {
    // Import using dynamic import for ESM compatibility
    const prismaModule = await import('../src/lib/prisma.js');
    
    // Disconnect from Prisma to prevent hanging connections
    if (typeof prismaModule.disconnectPrisma === 'function') {
      await prismaModule.disconnectPrisma();
      console.log('Successfully disconnected Prisma client');
    } else {
      console.log('Warning: disconnectPrisma function not found');
    }
    
    console.log('Test environment cleanup completed');
  } catch (error) {
    console.error('Failed to disconnect Prisma:', error.message);
  }
} 
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

/**
 * Checks for schema drift between the Prisma schema and the database
 * This script is used in CI/CD pipelines to detect schema changes
 */
async function checkSchemaDrift() {
  console.log('Checking for schema drift...');
  
  const tempSchemaPath = path.join(process.cwd(), 'prisma', 'temp-schema.prisma');
  const mainSchemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  
  try {
    // Pull the current database schema to a temporary file
    console.log('Pulling current database schema...');
    await execAsync(`npx prisma db pull --schema=${tempSchemaPath}`);
    
    // Read both schema files
    const tempSchema = await fs.readFile(tempSchemaPath, 'utf8');
    const mainSchema = await fs.readFile(mainSchemaPath, 'utf8');
    
    // Compare schemas (simple string comparison)
    if (tempSchema === mainSchema) {
      console.log('✅ No schema drift detected');
      return true;
    } else {
      console.log('❌ Schema drift detected!');
      console.log('The database schema differs from the Prisma schema.');
      console.log('Run `prisma db pull` locally to update your schema.');
      
      // Compare and show differences (simplified)
      const tempLines = tempSchema.split('\n');
      const mainLines = mainSchema.split('\n');
      
      console.log('\nDifferences:');
      if (tempLines.length !== mainLines.length) {
        console.log(`- Line count: ${mainLines.length} (schema.prisma) vs ${tempLines.length} (database)`);
      }
      
      // Show a few differences as examples
      let diffCount = 0;
      for (let i = 0; i < Math.min(tempLines.length, mainLines.length); i++) {
        if (tempLines[i] !== mainLines[i] && diffCount < 5) {
          console.log(`- Line ${i + 1}:`);
          console.log(`  schema.prisma: ${mainLines[i]}`);
          console.log(`  database:      ${tempLines[i]}`);
          diffCount++;
        }
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking schema drift:');
    console.error(error);
    return false;
  } finally {
    // Clean up temporary schema file
    try {
      await fs.unlink(tempSchemaPath);
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
}

// Execute the check
checkSchemaDrift()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });

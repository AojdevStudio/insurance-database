/**
 * Tests for the Prisma schema workflow
 * 
 * This tests the workflow of:
 * 1. Creating a SQL migration
 * 2. Applying it to the database
 * 3. Running prisma db pull to update schema.prisma
 * 4. Generating Prisma client
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// Skip this test if running in CI environment
const isCI = process.env.CI === 'true';

describe('Schema Change Workflow', () => {
  // Only run this test locally, not in CI
  (isCI ? describe.skip : describe)('Schema synchronization', () => {
    const testTableName = `test_schema_workflow_${uuidv4().replace(/-/g, '_')}`;
    const migrationTimestamp = Date.now().toString();
    const migrationName = `${migrationTimestamp}_test_schema_workflow`;
    const migrationPath = path.join('supabase/migrations', `${migrationName}.sql`);
    
    // Clean up any leftover test table
    beforeAll(() => {
      try {
        // This will fail if the table doesn't exist, which is fine
        execSync(`psql "${process.env.DATABASE_URL}" -c "DROP TABLE IF EXISTS ${testTableName};"`);
      } catch (error) {
        console.log('Table did not exist (expected)');
      }
    });
    
    // Clean up test artifacts after tests
    afterAll(() => {
      // Remove test migration if it exists
      if (fs.existsSync(migrationPath)) {
        fs.unlinkSync(migrationPath);
      }
      
      // Remove test table if it exists
      try {
        execSync(`psql "${process.env.DATABASE_URL}" -c "DROP TABLE IF EXISTS ${testTableName};"`);
      } catch (error) {
        console.error('Failed to drop test table:', error);
      }
      
      // Reset Prisma schema to previous state
      try {
        execSync('npm run db:pull-generate');
      } catch (error) {
        console.error('Failed to reset Prisma schema:', error);
      }
    });
    
    it('should properly reflect SQL migrations in Prisma schema', () => {
      // 1. Create a test SQL migration
      const migrationSQL = `
      CREATE TABLE IF NOT EXISTS "${testTableName}" (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      `;
      
      // 2. Write migration to a file
      fs.writeFileSync(migrationPath, migrationSQL);
      
      // 3. Apply migration
      try {
        execSync(`psql "${process.env.DATABASE_URL}" -f "${migrationPath}"`);
      } catch (error) {
        console.error('Failed to apply migration:', error);
        throw error;
      }
      
      // 4. Run Prisma DB pull
      try {
        execSync('npm run prisma:pull');
      } catch (error) {
        console.error('Failed to run Prisma DB pull:', error);
        throw error;
      }
      
      // 5. Verify schema contains the new table
      const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');
      expect(schemaContent).toContain(testTableName);
      
      // 6. Generate Prisma client
      try {
        execSync('npm run prisma:generate');
      } catch (error) {
        console.error('Failed to generate Prisma client:', error);
        throw error;
      }
      
      // 7. Verify client was generated
      expect(fs.existsSync('node_modules/.prisma/client')).toBe(true);
      
      console.log('Successfully tested schema workflow with table:', testTableName);
    });
    
    it('should handle column additions in SQL migrations', () => {
      // Skip if the first test failed (table doesn't exist)
      if (!fs.existsSync('prisma/schema.prisma') ||
          !fs.readFileSync('prisma/schema.prisma', 'utf8').includes(testTableName)) {
        console.log('Skipping column addition test as table was not created');
        return;
      }
      
      // 1. Create a column addition migration
      const columnMigrationTimestamp = (Date.now() + 1).toString();
      const columnMigrationName = `${columnMigrationTimestamp}_add_column`;
      const columnMigrationPath = path.join('supabase/migrations', `${columnMigrationName}.sql`);
      
      const columnMigrationSQL = `
      ALTER TABLE "${testTableName}" 
      ADD COLUMN "description" TEXT,
      ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
      `;
      
      // 2. Write migration to a file
      fs.writeFileSync(columnMigrationPath, columnMigrationSQL);
      
      try {
        // 3. Apply column migration
        execSync(`psql "${process.env.DATABASE_URL}" -f "${columnMigrationPath}"`);
        
        // 4. Run Prisma DB pull
        execSync('npm run prisma:pull');
        
        // 5. Verify schema contains the new columns
        const updatedSchemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');
        expect(updatedSchemaContent).toContain('description');
        expect(updatedSchemaContent).toContain('is_active');
        
        // 6. Generate Prisma client again
        execSync('npm run prisma:generate');
        
        console.log('Successfully tested schema workflow with column additions');
      } catch (error) {
        console.error('Failed while testing column additions:', error);
        throw error;
      } finally {
        // Clean up column migration file
        if (fs.existsSync(columnMigrationPath)) {
          fs.unlinkSync(columnMigrationPath);
        }
      }
    });
  });
});

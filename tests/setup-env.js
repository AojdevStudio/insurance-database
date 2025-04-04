/**
 * Jest setup file to configure the test environment
 */

/* global process, console, global */

// Load environment variables from .env.test
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.test
dotenv.config({ path: resolve(__dirname, '../.env.test') });

// Fall back to .env if needed
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: resolve(__dirname, '../.env') });
}

// Make sure we're using the test database URL for all tests
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 
  'postgresql://postgres:postgres@localhost:54322/postgres_test';

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Print setup information
console.log('Test environment setup complete:');
console.log(`- Database URL: ${process.env.DATABASE_URL}`);
console.log(`- Node ENV: ${process.env.NODE_ENV}`);

// Define console as global to fix linting issues in test files
global.console = console; 
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../src/types/supabase.js';
import { config } from '../../src/config/index.js';

// Create a Supabase client for integration tests
export const supabase = createClient<Database>(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
    },
  }
);

// Initialize test database
export async function initTestDatabase() {
  try {
    // Run migrations
    await supabase.rpc('reset_test_database');
    
    // Load test data
    await loadTestData();
    
    return true;
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
}

// Load test data
async function loadTestData() {
  try {
    // Insert test carriers
    await supabase.from('insurance_carriers').insert([
      {
        name: 'Test Carrier 1',
        code: 'TC1',
        active: true,
      },
      {
        name: 'Test Carrier 2',
        code: 'TC2',
        active: true,
      },
    ]);

    // Insert test guidelines
    await supabase.from('guidelines').insert([
      {
        carrier_id: 1,
        title: 'Test Guideline 1',
        content: 'This is a test guideline for carrier 1',
        category: 'test',
      },
      {
        carrier_id: 2,
        title: 'Test Guideline 2',
        content: 'This is a test guideline for carrier 2',
        category: 'test',
      },
    ]);

  } catch (error) {
    console.error('Failed to load test data:', error);
    throw error;
  }
}

// Clean up test database
export async function cleanupTestDatabase() {
  try {
    await supabase.rpc('cleanup_test_database');
    return true;
  } catch (error) {
    console.error('Failed to clean up test database:', error);
    throw error;
  }
}

// Reset test database to initial state
export async function resetTestDatabase() {
  await cleanupTestDatabase();
  await initTestDatabase();
}

// Global setup
export async function setupIntegrationTests() {
  try {
    // Initialize test database
    await initTestDatabase();
    
    // Additional setup if needed
    
    return true;
  } catch (error) {
    console.error('Failed to setup integration tests:', error);
    throw error;
  }
}

// Global teardown
export async function teardownIntegrationTests() {
  try {
    // Clean up test database
    await cleanupTestDatabase();
    
    // Additional cleanup if needed
    
    return true;
  } catch (error) {
    console.error('Failed to teardown integration tests:', error);
    throw error;
  }
} 
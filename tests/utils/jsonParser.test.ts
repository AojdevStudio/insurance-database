import { parseAndImportJSON } from '../../src/utils/jsonParser.js';
import { CarrierJSON } from '../../src/types/carrier.js';
import { createClient } from '@supabase/supabase-js';
import { MockPostgrestResponse } from '../setup.js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('JSON Parser', () => {
  let mockSupabase: any;
  
  const validCarrierData: CarrierJSON = {
    carrier_name: 'Test Insurance',
    carrier_type: 'National',
    payer_id: '12345',
    claims_address: '123 Test St, City, ST 12345',
    phone_number: '1-800-555-1234',
    networks: [
      {
        network_name: 'Test Network',
        plan_type: 'PPO',
        effective_date: '2024-01-01'
      }
    ]
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn()
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('should successfully import new carrier data', async () => {
    // Mock carrier check (not found)
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    // Mock carrier insert
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'test-id' },
      error: null
    });

    // Mock network insert
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });

    const result = await parseAndImportJSON(JSON.stringify(validCarrierData), mockSupabase);

    expect(result.success).toBe(true);
    expect(result.progress.successful).toBe(1);
    expect(result.progress.failed).toBe(0);
  });

  it('should successfully update existing carrier data', async () => {
    // Mock carrier check (found)
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-id' },
      error: null
    });

    // Mock carrier update
    mockSupabase.eq.mockResolvedValueOnce({ error: null });

    // Mock network insert
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });

    const result = await parseAndImportJSON(JSON.stringify(validCarrierData), mockSupabase);

    expect(result.success).toBe(true);
    expect(result.progress.successful).toBe(1);
    expect(result.progress.failed).toBe(0);
  });

  it('should handle invalid JSON data', async () => {
    const invalidJson = '{invalid json';
    
    const result = await parseAndImportJSON(invalidJson, mockSupabase);

    expect(result.success).toBe(false);
    expect(result.progress.failed).toBe(1);
    expect(result.error).toBeDefined();
  });

  it('should handle database errors during carrier check', async () => {
    // Mock carrier check error
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('Database error')
    });

    const result = await parseAndImportJSON(JSON.stringify(validCarrierData), mockSupabase);

    expect(result.success).toBe(false);
    expect(result.progress.failed).toBe(1);
    expect(result.error).toContain('Failed to check carrier existence');
  });

  it('should handle database errors during carrier insert', async () => {
    // Mock carrier check (not found)
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    // Mock carrier insert error
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: new Error('Insert error')
    });

    const result = await parseAndImportJSON(JSON.stringify(validCarrierData), mockSupabase);

    expect(result.success).toBe(false);
    expect(result.progress.failed).toBe(1);
    expect(result.error).toContain('Failed to insert carrier');
  });

  it('should handle database errors during network insert', async () => {
    // Mock carrier check (not found)
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    // Mock carrier insert
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'test-id' },
      error: null
    });

    // Mock network insert error
    mockSupabase.upsert.mockResolvedValueOnce({
      error: new Error('Network insert error')
    });

    const result = await parseAndImportJSON(JSON.stringify(validCarrierData), mockSupabase);

    expect(result.success).toBe(false);
    expect(result.progress.failed).toBe(1);
    expect(result.error).toContain('Failed to import network');
  });

  it('should successfully import carrier with all optional data', async () => {
    const dataWithOptionals: CarrierJSON = {
      ...validCarrierData,
      procedures: [{
        code: 'TEST001',
        description: 'Test Procedure',
        requirements: ['Requirement 1']
      }],
      guidelines: [{
        title: 'Test Guideline',
        content: 'Test content',
        effective_date: '2024-01-01'
      }],
      appeal_procedures: {
        first_level: 'First level appeal process'
      }
    };

    // Mock all necessary database calls
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'test-id' },
      error: null
    });
    mockSupabase.upsert
      .mockResolvedValueOnce({ error: null }) // networks
      .mockResolvedValueOnce({ error: null }) // procedures
      .mockResolvedValueOnce({ error: null }) // guidelines
      .mockResolvedValueOnce({ error: null }); // appeal procedures

    const result = await parseAndImportJSON(JSON.stringify(dataWithOptionals), mockSupabase);

    expect(result.success).toBe(true);
    expect(result.progress.successful).toBe(1);
    expect(result.progress.failed).toBe(0);
  });
}); 
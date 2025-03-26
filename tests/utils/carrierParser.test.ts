import { parseCarrierCSV, CarrierData } from '../../src/utils/carrierParser.js';

describe('parseCarrierCSV', () => {
  const validCSV = `carrier_name,network_name,plan_type,effective_date,carrier_type,payer_id,claims_address,phone_number
Aetna,National,PPO,2024-01-01,National,12345,123 Main St,555-0123`;

  test('should parse valid CSV data correctly', async () => {
    const result = await parseCarrierCSV(validCSV);
    expect(result.success).toBe(true);
    if (!result.carriers) {
      throw new Error('Expected carriers to be defined');
    }
    expect(result.carriers[0]).toEqual({
      carrier_name: 'Aetna',
      carrier_type: 'National',
      payer_id: '12345',
      claims_address: '123 Main St',
      phone_number: '555-0123',
      networks: [{
        network_name: 'National',
        plan_type: 'PPO',
        effective_date: '2024-01-01'
      }]
    });
  });

  test('should handle empty CSV data', async () => {
    const result = await parseCarrierCSV('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('CSV validation failed');
  });

  test('should validate CSV data before parsing', async () => {
    const invalidCSV = `carrier_name,network_name
Aetna,National`;
    const result = await parseCarrierCSV(invalidCSV);
    expect(result.success).toBe(false);
    expect(result.error).toContain('CSV validation failed');
  });

  test('should group multiple networks under the same carrier', async () => {
    const multiNetworkCSV = `carrier_name,network_name,plan_type,effective_date,carrier_type,payer_id,claims_address,phone_number
Aetna,National,PPO,2024-01-01,National,12345,123 Main St,555-0123
Aetna,Premier,HMO,2024-01-01,National,12345,123 Main St,555-0123`;
    
    const result = await parseCarrierCSV(multiNetworkCSV);
    expect(result.success).toBe(true);
    if (!result.carriers) {
      throw new Error('Expected carriers to be defined');
    }
    expect(result.carriers[0].networks).toHaveLength(2);
  });

  test('should handle optional fields', async () => {
    const csvWithOptionalFields = `carrier_name,network_name,plan_type,effective_date,carrier_type
Aetna,National,PPO,2024-01-01,National`;
    
    const result = await parseCarrierCSV(csvWithOptionalFields);
    expect(result.success).toBe(true);
    if (!result.carriers) {
      throw new Error('Expected carriers to be defined');
    }
    expect(result.carriers[0]).toEqual({
      carrier_name: 'Aetna',
      carrier_type: 'National',
      payer_id: null,
      claims_address: null,
      phone_number: null,
      networks: [{
        network_name: 'National',
        plan_type: 'PPO',
        effective_date: '2024-01-01'
      }]
    });
  });

  test('should validate carrier type values', async () => {
    const invalidCarrierType = `carrier_name,network_name,plan_type,effective_date,carrier_type
Aetna,National,PPO,2024-01-01,Invalid`;
    
    const result = await parseCarrierCSV(invalidCarrierType);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid carrier_type');
  });

  test('should handle large datasets efficiently', async () => {
    // Generate a large CSV with 1000 rows
    const header = 'carrier_name,network_name,plan_type,effective_date,carrier_type,payer_id,claims_address,phone_number\n';
    const row = 'Aetna,National,PPO,2024-01-01,National,12345,123 Main St,555-0123\n';
    const largeCSV = header + row.repeat(1000);
    
    const startTime = Date.now();
    const result = await parseCarrierCSV(largeCSV);
    const endTime = Date.now();
    
    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(1000); // Should process within 1 second
  });

  test('should handle multiple carriers with different types', async () => {
    const multiCarrierCSV = `carrier_name,network_name,plan_type,effective_date,carrier_type,payer_id,claims_address,phone_number
Aetna,National,PPO,2024-01-01,National,12345,123 Main St,555-0123
UnitedHealth,Medicare,HMO,2024-01-01,Medicare Advantage,67890,456 Oak St,555-4567
TPA Corp,Local,PPO,2024-01-01,TPA,11111,789 Pine St,555-8901
Other Inc,Regional,EPO,2024-01-01,Other,22222,321 Elm St,555-2345`;
    
    const result = await parseCarrierCSV(multiCarrierCSV);
    expect(result.success).toBe(true);
    if (!result.carriers) {
      throw new Error('Expected carriers to be defined');
    }
    expect(result.carriers).toHaveLength(4);
    expect(result.carriers.map(c => c.carrier_type)).toEqual([
      'National',
      'Medicare Advantage',
      'TPA',
      'Other'
    ]);
  });

  test('should handle malformed CSV data', async () => {
    const malformedCSV = `carrier_name,network_name,plan_type,effective_date,carrier_type
Aetna,"National PPO,PPO,2024-01-01,National`;  // Missing closing quote
    
    const result = await parseCarrierCSV(malformedCSV);
    expect(result.success).toBe(false);
    expect(result.error).toContain('CSV validation failed');
  });

  test('should handle empty rows', async () => {
    const csvWithEmptyRows = `carrier_name,network_name,plan_type,effective_date,carrier_type,payer_id,claims_address,phone_number
Aetna,National,PPO,2024-01-01,National,12345,123 Main St,555-0123

UnitedHealth,Medicare,HMO,2024-01-01,Medicare Advantage,67890,456 Oak St,555-4567`;
    
    const result = await parseCarrierCSV(csvWithEmptyRows);
    expect(result.success).toBe(true);
    if (!result.carriers) {
      throw new Error('Expected carriers to be defined');
    }
    expect(result.carriers).toHaveLength(2);
  });

  test('should handle missing carrier type', async () => {
    const csvWithMissingType = `carrier_name,network_name,plan_type,effective_date,carrier_type
Aetna,National,PPO,2024-01-01,`;
    
    const result = await parseCarrierCSV(csvWithMissingType);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing carrier_type');
  });
}); 
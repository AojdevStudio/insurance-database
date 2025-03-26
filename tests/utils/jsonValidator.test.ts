import { validateJSON } from '../../src/utils/jsonValidator.js';
import { CarrierJSON } from '../../src/types/carrier.js';

describe('JSON Validator', () => {
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

  it('should validate correct JSON data', async () => {
    const jsonString = JSON.stringify(validCarrierData);
    const result = await validateJSON(jsonString);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toBeDefined();
  });

  it('should reject invalid JSON syntax', async () => {
    const invalidJson = '{invalid json';
    const result = await validateJSON(invalidJson);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Failed to parse JSON');
  });

  it('should reject missing required fields', async () => {
    const invalidData = {
      carrier_type: 'National',
      networks: []
    };
    
    const result = await validateJSON(JSON.stringify(invalidData));
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('carrier_name'))).toBe(true);
  });

  it('should reject invalid carrier type', async () => {
    const invalidData = {
      ...validCarrierData,
      carrier_type: 'Invalid'
    };
    
    const result = await validateJSON(JSON.stringify(invalidData));
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('carrier_type'))).toBe(true);
  });

  it('should reject invalid plan type', async () => {
    const invalidData = {
      ...validCarrierData,
      networks: [{
        ...validCarrierData.networks[0],
        plan_type: 'Invalid'
      }]
    };
    
    const result = await validateJSON(JSON.stringify(invalidData));
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('plan_type'))).toBe(true);
  });

  it('should reject invalid date format', async () => {
    const invalidData = {
      ...validCarrierData,
      networks: [{
        ...validCarrierData.networks[0],
        effective_date: '2024/01/01'
      }]
    };
    
    const result = await validateJSON(JSON.stringify(invalidData));
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('effective_date'))).toBe(true);
  });

  it('should validate optional fields', async () => {
    const dataWithOptionals: CarrierJSON = {
      ...validCarrierData,
      procedures: [{
        code: 'TEST001',
        description: 'Test Procedure',
        requirements: ['Requirement 1', 'Requirement 2']
      }],
      guidelines: [{
        title: 'Test Guideline',
        content: 'Test content',
        effective_date: '2024-01-01'
      }],
      appeal_procedures: {
        first_level: 'First level appeal process',
        second_level: 'Second level appeal process',
        external_review: 'External review process'
      }
    };
    
    const result = await validateJSON(JSON.stringify(dataWithOptionals));
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toBeDefined();
  });
}); 
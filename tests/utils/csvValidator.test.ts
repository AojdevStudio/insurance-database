import { validateCSV, ValidationResult, CSVValidationError } from '../../src/utils/csvValidator.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('CSV Validator', () => {
  const validCSVContent = `carrier_name,network_name,plan_type,effective_date
Aetna,National,PPO,2024-01-01
BlueCross,Regional,HMO,2024-02-01`;

  const invalidCSVContent = `carrier_name,network_name,plan_type
Aetna,National,PPO,2024-01-01
BlueCross,Regional,HMO`;

  beforeEach(() => {
    // Clear any test files if they exist
    try {
      // Implementation will be added when needed
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Basic CSV Structure Validation', () => {
    it('should validate a well-formed CSV file', async () => {
      const result = await validateCSV(validCSVContent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(2);
    });

    it('should reject empty CSV file', async () => {
      const result = await validateCSV('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 0,
        type: 'COLUMN_COUNT_MISMATCH',
        message: 'CSV file is empty'
      });
    });

    it('should reject CSV with inconsistent column counts', async () => {
      const inconsistentCSV = `carrier_name,network_name,plan_type,effective_date
Aetna,National,PPO,2024-01-01,Extra`;
      
      const result = await validateCSV(inconsistentCSV);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 2,
        type: 'COLUMN_COUNT_MISMATCH',
        message: 'Row has 5 columns but header has 4 columns'
      });
    });

    it('should validate required column presence', async () => {
      const missingRequiredColumn = `network_name,plan_type,effective_date
National,PPO,2024-01-01`;
      
      const result = await validateCSV(missingRequiredColumn);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 0,
        type: 'MISSING_REQUIRED_COLUMN',
        message: 'Required column "carrier_name" is missing'
      });
    });

    it('should handle malformed CSV content', async () => {
      const malformedCSV = `carrier_name,network_name,plan_type,effective_date
Aetna,"National,PPO,2024-01-01`;  // Missing closing quote
      
      const result = await validateCSV(malformedCSV);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('COLUMN_COUNT_MISMATCH');
    });
  });

  describe('Data Type Validation', () => {
    it('should validate date format', async () => {
      const invalidDateFormat = `carrier_name,network_name,plan_type,effective_date
Aetna,National,PPO,01/01/2024`;
      
      const result = await validateCSV(invalidDateFormat);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 1,
        type: 'INVALID_DATE_FORMAT',
        message: 'Invalid date format in column "effective_date". Expected YYYY-MM-DD'
      });
    });

    it('should validate invalid date values', async () => {
      const invalidDate = `carrier_name,network_name,plan_type,effective_date
Aetna,National,PPO,2024-13-45`;  // Invalid month and day
      
      const result = await validateCSV(invalidDate);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 1,
        type: 'INVALID_DATE_FORMAT',
        message: 'Invalid date value in column "effective_date"'
      });
    });

    it('should validate enum values', async () => {
      const invalidPlanType = `carrier_name,network_name,plan_type,effective_date
Aetna,National,INVALID_TYPE,2024-01-01`;
      
      const result = await validateCSV(invalidPlanType);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 1,
        type: 'INVALID_ENUM_VALUE',
        message: 'Invalid plan_type value. Expected one of: PPO, HMO, EPO'
      });
    });
  });

  describe('Content Validation', () => {
    it('should validate carrier name length', async () => {
      const longCarrierName = `carrier_name,network_name,plan_type,effective_date
${('A').repeat(101)},National,PPO,2024-01-01`;
      
      const result = await validateCSV(longCarrierName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 1,
        type: 'INVALID_FIELD_LENGTH',
        message: 'carrier_name exceeds maximum length of 100 characters'
      });
    });

    it('should validate network name length', async () => {
      const longNetworkName = `carrier_name,network_name,plan_type,effective_date
Aetna,${('A').repeat(101)},PPO,2024-01-01`;
      
      const result = await validateCSV(longNetworkName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 1,
        type: 'INVALID_FIELD_LENGTH',
        message: 'network_name exceeds maximum length of 100 characters'
      });
    });

    it('should validate against empty required fields', async () => {
      const emptyRequiredField = `carrier_name,network_name,plan_type,effective_date
,National,PPO,2024-01-01`;
      
      const result = await validateCSV(emptyRequiredField);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        row: 1,
        type: 'EMPTY_REQUIRED_FIELD',
        message: 'Required field "carrier_name" is empty'
      });
    });
  });

  describe('Performance', () => {
    it('should handle large CSV files efficiently', async () => {
      const largeCSV = Array(1000)
        .fill(validCSVContent.split('\n')[1])
        .join('\n');
      
      const fullCSV = `${validCSVContent.split('\n')[0]}\n${largeCSV}`;
      const startTime = Date.now();
      
      const result = await validateCSV(fullCSV);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should process within 1 second
      expect(result.isValid).toBe(true);
      expect(result.data).toHaveLength(1000);
    });
  });
});

describe('validateCSV', () => {
  const validCSV = `carrier_name,network_name,plan_type,effective_date,carrier_type,payer_id,claims_address,phone_number
Aetna,National,PPO,2024-01-01,National,12345,123 Main St,555-0123`;

  test('should validate a well-formed CSV file', async () => {
    const result = await validateCSV(validCSV);
    expect(result.isValid).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  test('should reject empty CSV file', async () => {
    const result = await validateCSV('');
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('CSV file is empty');
  });

  test('should reject CSV with inconsistent column counts', async () => {
    const inconsistentCSV = `carrier_name,network_name,plan_type,effective_date
Aetna,National,PPO,2024-01-01,Extra`;
    const result = await validateCSV(inconsistentCSV);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('Row has 5 columns but header has 4 columns');
  });

  test('should validate required columns', async () => {
    const missingRequiredColumn = `network_name,plan_type,effective_date
National,PPO,2024-01-01`;
    const result = await validateCSV(missingRequiredColumn);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('Required column "carrier_name" is missing');
  });

  test('should handle malformed CSV content', async () => {
    const malformedCSV = `carrier_name,network_name,plan_type,effective_date
Aetna,"National PPO,PPO,2024-01-01`;  // Missing closing quote
    const result = await validateCSV(malformedCSV);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('Failed to parse CSV: Quote Not Closed: the parsing is finished with an opening quote at line 2');
  });

  test('should validate date format', async () => {
    const invalidDateFormat = `carrier_name,network_name,plan_type,effective_date
Aetna,National,PPO,01/01/2024`;
    const result = await validateCSV(invalidDateFormat);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid date format');
  });

  test('should validate date value', async () => {
    const invalidDateValue = `carrier_name,network_name,plan_type,effective_date
Aetna,National,PPO,2024-13-01`;
    const result = await validateCSV(invalidDateValue);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid date');
  });

  test('should validate plan type enum', async () => {
    const invalidPlanType = `carrier_name,network_name,plan_type,effective_date
Aetna,National,INVALID,2024-01-01`;
    const result = await validateCSV(invalidPlanType);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid plan_type');
  });

  test('should validate carrier name length', async () => {
    const longCarrierName = `carrier_name,network_name,plan_type,effective_date
${'A'.repeat(256)},National,PPO,2024-01-01`;
    const result = await validateCSV(longCarrierName);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('carrier_name exceeds maximum length of 100 characters');
  });

  test('should validate network name length', async () => {
    const longNetworkName = `carrier_name,network_name,plan_type,effective_date
Aetna,${'A'.repeat(256)},PPO,2024-01-01`;
    const result = await validateCSV(longNetworkName);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('network_name exceeds maximum length of 100 characters');
  });

  test('should validate empty required fields', async () => {
    const emptyRequiredField = `carrier_name,network_name,plan_type,effective_date
,National,PPO,2024-01-01`;
    const result = await validateCSV(emptyRequiredField);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('Required field "carrier_name" is empty');
  });

  test('should handle CSV with whitespace in values', async () => {
    const csvWithWhitespace = `carrier_name,network_name,plan_type,effective_date,carrier_type
  Aetna  ,  National  ,  PPO  ,  2024-01-01  ,  National  `;
    const result = await validateCSV(csvWithWhitespace);
    expect(result.isValid).toBe(true);
    expect(result.data![0].carrier_name).toBe('Aetna');
    expect(result.data![0].network_name).toBe('National');
    expect(result.data![0].plan_type).toBe('PPO');
    expect(result.data![0].effective_date).toBe('2024-01-01');
  });

  test('should handle CSV with quoted values', async () => {
    const csvWithQuotes = `carrier_name,network_name,plan_type,effective_date,carrier_type
"Aetna, Inc.","National Network",PPO,2024-01-01,National`;
    const result = await validateCSV(csvWithQuotes);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe('Row has 6 columns but header has 5 columns');
  });

  test('should handle CSV with empty optional fields', async () => {
    const csvWithEmptyOptional = `carrier_name,network_name,plan_type,effective_date,carrier_type,payer_id,claims_address,phone_number
Aetna,National,PPO,2024-01-01,National,,,`;
    const result = await validateCSV(csvWithEmptyOptional);
    expect(result.isValid).toBe(true);
    expect(result.data![0].payer_id).toBe('');
    expect(result.data![0].claims_address).toBe('');
    expect(result.data![0].phone_number).toBe('');
  });

  test('should handle CSV with different line endings', async () => {
    const csvWithCRLF = validCSV.replace(/\n/g, '\r\n');
    const result = await validateCSV(csvWithCRLF);
    expect(result.isValid).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});
import { validateRow, validateBatch, validateHeaders } from '../validator.js';
import { ImportErrorType } from '../types.js';

describe('CSV Validator', () => {
  describe('validateHeaders', () => {
    const requiredHeaders = [
      'carrierName',
      'policyType',
      'coverageDetails',
      'effectiveDate',
      'expirationDate',
      'premium',
      'status',
    ];

    it('should validate correct headers', async () => {
      const result = validateHeaders(requiredHeaders);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect missing headers', async () => {
      const headers = ['carrierName', 'policyType', 'premium'];
      const result = validateHeaders(headers);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe(ImportErrorType.VALIDATION_ERROR);
      expect(result.error?.message).toContain('Missing required columns');
    });

    it('should handle unknown columns when not allowed', async () => {
      const headers = [...requiredHeaders, 'unknownColumn'];
      const result = validateHeaders(headers, { allowUnknownColumns: false });
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe(ImportErrorType.VALIDATION_ERROR);
      expect(result.error?.message).toContain('Unknown columns found');
    });

    it('should allow unknown columns when configured', async () => {
      const headers = [...requiredHeaders, 'extraColumn'];
      const result = validateHeaders(headers, { allowUnknownColumns: true });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateRow', () => {
    const validRow = {
      carrierName: 'ABC Insurance',
      policyType: 'Auto',
      coverageDetails: 'Comprehensive Coverage',
      effectiveDate: '2024-01-01',
      expirationDate: '2024-12-31',
      premium: '1200.50',
      status: 'Active',
    };

    it('should validate correct row', async () => {
      const result = await validateRow(validRow, 1);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should detect missing required fields', async () => {
      const invalidRow = { ...validRow, carrierName: '' };
      const result = await validateRow(invalidRow, 1);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe(ImportErrorType.VALIDATION_ERROR);
      expect(result.error?.message).toContain('required');
    });

    it('should validate date order', async () => {
      const invalidRow = {
        ...validRow,
        effectiveDate: '2024-12-31',
        expirationDate: '2024-01-01',
      };
      const result = await validateRow(invalidRow, 1);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe(ImportErrorType.VALIDATION_ERROR);
      expect(result.error?.message).toContain('Effective date must be before expiration date');
    });

    it('should validate premium value', async () => {
      const invalidRow = { ...validRow, premium: '-100' };
      const result = await validateRow(invalidRow, 1);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe(ImportErrorType.VALIDATION_ERROR);
      expect(result.error?.message).toContain('Premium must be positive');
    });
  });

  describe('validateBatch', () => {
    const validRows = [
      {
        carrierName: 'ABC Insurance',
        policyType: 'Auto',
        coverageDetails: 'Comprehensive Coverage',
        effectiveDate: '2024-01-01',
        expirationDate: '2024-12-31',
        premium: '1200.50',
        status: 'Active',
      },
      {
        carrierName: 'XYZ Insurance',
        policyType: 'Home',
        coverageDetails: 'Basic Coverage',
        effectiveDate: '2024-02-01',
        expirationDate: '2025-01-31',
        premium: '850.75',
        status: 'Active',
      },
    ];

    it('should validate batch of correct rows', async () => {
      const result = await validateBatch(validRows, 1);
      expect(result.valid).toBe(true);
      expect(result.validRows.length).toBe(2);
      expect(result.errors.length).toBe(0);
    });

    it('should handle mixed valid and invalid rows', async () => {
      const mixedRows = [
        ...validRows,
        {
          carrierName: 'Invalid Insurance',
          policyType: '',
          coverageDetails: 'Missing Details',
          effectiveDate: '2024-01-01',
          expirationDate: '2023-12-31',
          premium: '-100',
          status: 'Unknown',
        },
      ];

      const result = await validateBatch(mixedRows, 1);
      expect(result.valid).toBe(false);
      expect(result.validRows.length).toBe(2);
      expect(result.errors.length).toBe(1);
    });

    it('should respect batch size limit', async () => {
      const result = await validateBatch(validRows, 1, { batchSize: 1 });
      expect(result.validRows.length).toBe(1);
    });
  });
}); 
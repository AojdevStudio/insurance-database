import { jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostgrestResponse, PostgrestError } from '@supabase/postgrest-js';
import { DataNormalizer } from '../../src/utils/DataNormalizer.js';
import { Logger } from '../../src/utils/logging.js';
import { createChainableMock, createMockResponse } from '../setup.js';

type InsuranceCarrier = {
  name: string;
};

// Mock setup
const mockSupabase = {
  from: jest.fn().mockReturnThis()
} as unknown as jest.Mocked<SupabaseClient>;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as unknown as jest.Mocked<Logger>;

const dataNormalizer = new DataNormalizer(mockSupabase, mockLogger);
const mockBuilder = createChainableMock<InsuranceCarrier>();

describe('DataNormalizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSupabase.from as jest.Mock).mockReturnValue(mockBuilder);
  });

  describe('deduplicateName', () => {
    it('should return exact match if found', async () => {
      const testName = 'Test Insurance';
      const mockResponse = {
        data: [{ name: testName }],
        error: null,
        count: 1,
        status: 200,
        statusText: 'OK'
      };
      
      mockBuilder.select.mockReturnValue({
        then: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dataNormalizer.deduplicateName(testName);
      expect(result).toBe(testName);
    });

    it('should return similar match if found', async () => {
      const testName = 'Test Insurance Co';
      const similarName = 'Test Insurance Company';
      const mockResponse = {
        data: [{ name: similarName }],
        error: null,
        count: 1,
        status: 200,
        statusText: 'OK'
      };
      
      mockBuilder.select.mockReturnValue({
        then: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dataNormalizer.deduplicateName(testName);
      expect(result).toBe(similarName);
    });

    it('should return original name if no match found', async () => {
      const testName = 'Unique Insurance';
      const mockResponse = {
        data: [],
        error: null,
        count: 0,
        status: 200,
        statusText: 'OK'
      };
      
      mockBuilder.select.mockReturnValue({
        then: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dataNormalizer.deduplicateName(testName);
      expect(result).toBe(testName);
    });

    it('should handle database errors', async () => {
      const testName = 'Test Insurance';
      const mockError: PostgrestError = {
        message: 'Database error',
        details: '',
        hint: '',
        code: '500',
        name: 'PostgrestError'
      };
      const mockResponse = {
        data: null,
        error: mockError,
        count: null,
        status: 500,
        statusText: 'Internal Server Error'
      };
      
      mockBuilder.select.mockReturnValue({
        then: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dataNormalizer.deduplicateName(testName);
      expect(result).toBe(testName);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
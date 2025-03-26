import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { NetworkMapper } from '../../../utils/NetworkMapper.js';
import { Logger } from '../../../utils/logging.js';

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

// Create a mock logger instance
const mockLogger = {
  service: 'test-service',
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  getLogs: jest.fn()
} as unknown as Logger;

describe('NetworkMapper', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  let networkMapper: NetworkMapper;

  const mockNetworkData = {
    network_name: 'Test Network',
    contact_phone: '123-456-7890',
    contact_email: 'test@network.com',
    resource_url: 'https://test.network.com',
    notes: 'Test notes'
  };

  const mockRelationship = {
    network_id: 1,
    carrier_id: 1,
    effective_date: new Date('2024-01-01'),
    termination_date: new Date('2024-12-31'),
    special_notes: 'Test relationship',
    verification_required: true
  };

  beforeEach(() => {
    // Setup mock Supabase client
    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockInsert = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockReturnThis();
    const mockNot = jest.fn().mockReturnThis();

    mockSupabase = {
      from: mockFrom,
      select: mockSelect,
      insert: mockInsert,
      single: mockSingle,
      not: mockNot
    } as unknown as jest.Mocked<SupabaseClient>;

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    networkMapper = new NetworkMapper(mockSupabase, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectNetworks', () => {
    it('should detect networks based on naming patterns', async () => {
      const mockCarriers = [
        { id: 1, name: 'Test Network Group', website: 'https://test.network.com' },
        { id: 2, name: 'Regular Insurance', website: 'https://regular.com' }
      ];

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(Promise.resolve({
          data: mockCarriers,
          error: null
        }))
      });

      const networks = await networkMapper.detectNetworks();
      expect(networks).toContain('Test Network Group');
      expect(networks).not.toContain('Regular Insurance');
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error') as PostgrestError;
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(Promise.resolve({
          data: null,
          error: dbError
        }))
      });

      await expect(networkMapper.detectNetworks())
        .rejects
        .toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createNetwork', () => {
    it('should create a network successfully', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockReturnValue(Promise.resolve({
              data: { network_id: 1 },
              error: null
            }))
          })
        })
      });

      const networkId = await networkMapper.createNetwork(mockNetworkData);
      expect(networkId).toBe(1);
    });

    it('should handle network creation errors', async () => {
      const dbError = new Error('Creation failed') as PostgrestError;
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockReturnValue(Promise.resolve({
              data: null,
              error: dbError
            }))
          })
        })
      });

      await expect(networkMapper.createNetwork(mockNetworkData))
        .rejects
        .toThrow('Creation failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createNetworkRelationship', () => {
    it('should create a relationship successfully', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue(Promise.resolve({
          data: { relationship_id: 1 },
          error: null
        }))
      });

      await expect(networkMapper.createNetworkRelationship(mockRelationship))
        .resolves
        .not.toThrow();
    });

    it('should handle relationship creation errors', async () => {
      const dbError = new Error('Relationship creation failed') as PostgrestError;
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue(Promise.resolve({
          data: null,
          error: dbError
        }))
      });

      await expect(networkMapper.createNetworkRelationship(mockRelationship))
        .rejects
        .toThrow('Relationship creation failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateNetworkRelationships', () => {
    it('should validate relationships successfully', async () => {
      const mockValidationErrors = ['Invalid date range for Network 1'];
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue(Promise.resolve({
            data: mockValidationErrors,
            error: null
          }))
        })
      });

      const errors = await networkMapper.validateNetworkRelationships();
      expect(errors).toEqual(mockValidationErrors);
    });

    it('should handle validation query errors', async () => {
      const dbError = new Error('Validation query failed') as PostgrestError;
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue(Promise.resolve({
            data: null,
            error: dbError
          }))
        })
      });

      await expect(networkMapper.validateNetworkRelationships())
        .rejects
        .toThrow('Validation query failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('generateMappingReport', () => {
    it('should generate a report successfully', async () => {
      const mockReport = {
        total_networks: 5,
        total_relationships: 10,
        unmapped_carriers: 2,
        validation_errors: ['Error 1', 'Error 2'],
        timestamp: new Date()
      };

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(Promise.resolve({
          data: mockReport,
          error: null
        }))
      });

      const report = await networkMapper.generateMappingReport();
      expect(report).toEqual(mockReport);
    });

    it('should handle report generation errors', async () => {
      const dbError = new Error('Report generation failed') as PostgrestError;
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(Promise.resolve({
          data: null,
          error: dbError
        }))
      });

      await expect(networkMapper.generateMappingReport())
        .rejects
        .toThrow('Report generation failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
}); 
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { NetworkMapper, NetworkMappingError } from '../NetworkMapper.js';
import { Logger } from '../logging.js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

// Mock Logger
jest.mock('../logging.js', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }))
}));

describe('NetworkMapper', () => {
  let networkMapper: NetworkMapper;
  let mockSupabase: jest.Mocked<SupabaseClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Setup mock Supabase client with proper types
    const mockFrom = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockInsert = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockReturnThis();
    const mockOr = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockRange = jest.fn().mockReturnThis();

    mockSupabase = {
      from: mockFrom,
      select: mockSelect,
      insert: mockInsert,
      eq: mockEq,
      single: mockSingle,
      or: mockOr,
      order: mockOrder,
      range: mockRange
    } as unknown as jest.Mocked<SupabaseClient>;

    // Setup mock Logger
    mockLogger = new Logger('test') as jest.Mocked<Logger>;

    // Create NetworkMapper instance
    networkMapper = new NetworkMapper(mockSupabase, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectNetworks', () => {
    const mockCarriers = [
      { name: 'Test PPO Network', website: 'www.testppo.com', contact_info: null },
      { name: 'Regular Insurance', website: 'www.network-provider.com', contact_info: null },
      { name: 'Test Alliance', website: 'www.test.com', contact_info: null }
    ];

    it('should detect networks based on carrier names and websites', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        data: mockCarriers,
        error: null
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const networks = await networkMapper.detectNetworks();

      expect(networks).toContain('Test PPO Network');
      expect(networks).toContain('Test Alliance');
      expect(networks).toHaveLength(2);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error') as PostgrestError;
      const mockSelect = jest.fn().mockReturnValue({
        data: null,
        error: dbError
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      await expect(networkMapper.detectNetworks())
        .rejects
        .toThrow(NetworkMappingError);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createNetwork', () => {
    const mockNetworkData = {
      network_name: 'Test Network',
      contact_phone: '123-456-7890',
      contact_email: 'test@network.com'
    };

    it('should create a network and return network ID', async () => {
      const mockSingle = jest.fn().mockReturnValue({
        data: { network_id: 1 },
        error: null
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (mockSupabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const networkId = await networkMapper.createNetwork(mockNetworkData);

      expect(networkId).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('insurance_networks');
    });

    it('should handle network creation errors', async () => {
      const dbError = new Error('Duplicate network') as PostgrestError;
      const mockSingle = jest.fn().mockReturnValue({
        data: null,
        error: dbError
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (mockSupabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      await expect(networkMapper.createNetwork(mockNetworkData))
        .rejects
        .toThrow(NetworkMappingError);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createNetworkRelationship', () => {
    const mockRelationship = {
      network_id: 1,
      carrier_id: 1,
      effective_date: new Date('2024-01-01'),
      verification_required: true
    };

    it('should create a network-carrier relationship', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        data: null,
        error: null
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      await networkMapper.createNetworkRelationship(mockRelationship);

      expect(mockSupabase.from).toHaveBeenCalledWith('network_carrier_relationships');
    });

    it('should handle relationship creation errors', async () => {
      const dbError = new Error('Invalid relationship') as PostgrestError;
      const mockInsert = jest.fn().mockReturnValue({
        data: null,
        error: dbError
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      await expect(networkMapper.createNetworkRelationship(mockRelationship))
        .rejects
        .toThrow(NetworkMappingError);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateNetworkRelationships', () => {
    const mockRelationships = [
      { 
        relationship_id: 1,
        network_id: 1,
        carrier_id: 1,
        effective_date: '2024-01-01',
        termination_date: null
      },
      {
        relationship_id: 2,
        network_id: 1,
        carrier_id: 2,
        effective_date: '2024-01-01',
        termination_date: '2023-12-31' // Invalid: termination before effective
      }
    ];

    it('should validate network relationships and return errors', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        data: mockRelationships,
        error: null
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const errors = await networkMapper.validateNetworkRelationships();

      expect(errors).toContain('Relationship ID 2: Termination date is before effective date');
      expect(errors).toHaveLength(1);
    });

    it('should handle validation query errors', async () => {
      const dbError = new Error('Validation query failed') as PostgrestError;
      const mockSelect = jest.fn().mockReturnValue({
        data: null,
        error: dbError
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      await expect(networkMapper.validateNetworkRelationships())
        .rejects
        .toThrow(NetworkMappingError);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('generateMappingReport', () => {
    const mockNetworks = [{ id: 1 }, { id: 2 }];
    const mockRelationships = [
      { network_id: 1, carrier_id: 1 },
      { network_id: 2, carrier_id: 2 }
    ];
    const mockUnmappedCarriers = [{ id: 3, name: 'Unmapped Carrier' }];

    it('should generate a complete mapping report', async () => {
      let callCount = 0;
      const mockSelect = jest.fn().mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1:
            return { data: mockNetworks, error: null };
          case 2:
            return { data: mockRelationships, error: null };
          case 3:
            return { data: mockUnmappedCarriers, error: null };
          default:
            return { data: [], error: null };
        }
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const report = await networkMapper.generateMappingReport();

      expect(report).toEqual({
        total_networks: 2,
        total_relationships: 2,
        unmapped_carriers: 1,
        validation_errors: expect.any(Array),
        timestamp: expect.any(Date)
      });
    });

    it('should handle report generation errors', async () => {
      const dbError = new Error('Report generation failed') as PostgrestError;
      const mockSelect = jest.fn().mockReturnValue({
        data: null,
        error: dbError
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      await expect(networkMapper.generateMappingReport())
        .rejects
        .toThrow(NetworkMappingError);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
}); 
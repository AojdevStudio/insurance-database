import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient, SupabaseClient, PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';
import { NetworkMapper } from '../../src/utils/NetworkMapper.js';
import { Logger } from '../../src/utils/logging.js';

jest.mock('../../src/utils/logging.js');

// Mock Logger
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  getLogs: jest.fn()
} as unknown as Logger;

// Helper function to create a mock PostgrestResponse
function createMockResponse<T>(data: T[] | T, count: number = 0): PostgrestResponse<T> {
  return {
    data: Array.isArray(data) ? data : [data],
    error: null,
    count,
    status: 200,
    statusText: 'OK'
  } as PostgrestResponse<T>;
}

interface MockBuilder {
  select: jest.Mock;
  from: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  then: jest.Mock;
  insert: jest.Mock;
  data: any[];
  error: Error | null;
}

// Define types for our test data
type UnmappedCarrierType = { id: number; name: string };
interface CarrierType {
  name: string;
  website: string | null;
  contact_info: Record<string, any> | null;
}
type NetworkResponseType = { network_id: number };
type RelationshipType = {
  relationship_id: number;
  network_id: number;
  carrier_id: number;
  effective_date: string | null;
  termination_date: string | null;
};

describe('NetworkMapper', () => {
  let networkMapper: NetworkMapper;
  let mockLogger: jest.Mocked<Logger>;
  let mockBuilder: MockBuilder;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn()
    } as any;

    mockBuilder = {
      select: jest.fn(() => mockBuilder),
      from: jest.fn(() => mockBuilder),
      eq: jest.fn(() => mockBuilder),
      in: jest.fn(() => mockBuilder),
      then: jest.fn(),
      insert: jest.fn(() => mockBuilder),
      data: [],
      error: null
    };

    mockSupabase = {
      from: jest.fn(() => mockBuilder)
    } as any;

    networkMapper = new NetworkMapper(mockSupabase as any, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectNetworks', () => {
    it('should detect networks from carrier data', async () => {
      const mockCarriers = [
        { name: 'Test Network', website: 'test.com', contact_info: {} },
        { name: 'Regular Insurance', website: 'network.test.com', contact_info: {} }
      ];

      const mockResponse = Promise.resolve(createMockResponse<CarrierType>(mockCarriers));
      mockBuilder.select.mockImplementation(() => ({
        ...mockBuilder,
        then: (onfulfilled: (value: PostgrestResponse<CarrierType>) => any) => mockResponse.then(onfulfilled)
      }));

      const networks = await networkMapper.detectNetworks();
      expect(networks).toContain('Test Network');
      expect(networks).toContain('Regular Insurance');
    });

    it('should handle errors', async () => {
      const mockError = new Error('Database error');
      const mockRejection = Promise.reject(mockError);
      mockBuilder.select.mockImplementation(() => ({
        ...mockBuilder,
        then: (_: any, onrejected: (reason: any) => any) => mockRejection.catch(onrejected)
      }));

      await expect(networkMapper.detectNetworks()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createNetwork', () => {
    it('should create a network successfully', async () => {
      const networkData = { network_name: 'Test Network' };
      const mockResponse = Promise.resolve({
        data: { network_id: 1 },
        error: null,
        status: 200,
        statusText: 'OK'
      });

      mockBuilder.insert.mockImplementation(() => ({
        ...mockBuilder,
        select: jest.fn().mockReturnValue({
          ...mockBuilder,
          single: jest.fn().mockReturnValue({
            then: (onfulfilled: any) => mockResponse.then(onfulfilled)
          })
        })
      }));

      const networkId = await networkMapper.createNetwork(networkData);
      expect(networkId).toBe(1);
    });

    it('should handle creation errors', async () => {
      const mockError = new Error('Creation failed');
      const mockRejection = Promise.reject(mockError);
      mockBuilder.insert.mockImplementation(() => ({
        ...mockBuilder,
        select: jest.fn().mockReturnValue({
          ...mockBuilder,
          single: jest.fn().mockReturnValue({
            ...mockBuilder,
            then: (_: any, onrejected: (reason: any) => any) => mockRejection.catch(onrejected)
          })
        })
      }));

      await expect(networkMapper.createNetwork({ network_name: 'Test' })).rejects.toThrow('Creation failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateNetworkRelationships', () => {
    it('should identify unmapped carriers', async () => {
      const mockUnmappedCarriers = [
        { id: 1, name: 'Unmapped Carrier' }
      ];

      const mockResponse = Promise.resolve(createMockResponse<UnmappedCarrierType>(mockUnmappedCarriers));
      mockBuilder.select.mockImplementation(() => ({
        ...mockBuilder,
        not: jest.fn().mockReturnValue({
          ...mockBuilder,
          then: (onfulfilled: (value: PostgrestResponse<UnmappedCarrierType>) => any) => mockResponse.then(onfulfilled)
        })
      }));

      const errors = await networkMapper.validateNetworkRelationships();
      expect(errors).toContain('Carrier Unmapped Carrier (ID: 1) has no network relationships');
    });

    it('should identify invalid date ranges', async () => {
      const mockRelationships = [{
        relationship_id: 1,
        network_id: 1,
        effective_date: '2023-01-01',
        termination_date: '2022-12-31' // Invalid: end date before start date
      }];

      mockBuilder.data = mockRelationships;
      const result = await networkMapper.validateNetworkRelationships();
      
      expect(result).toContain('Invalid date range for relationship ID 1');
    }, 10000);
  });

  describe('generateMappingReport', () => {
    it('should generate a complete mapping report', async () => {
      const mockNetworks = [{ id: 1, name: 'Network 1' }];
      const mockRelationships = [{ network_id: 1, carrier_id: 1 }];

      mockBuilder.data = mockNetworks;
      mockBuilder.select.mockImplementation(() => ({
        ...mockBuilder,
        data: mockRelationships
      }));

      const report = await networkMapper.generateMappingReport();
      
      expect(report).toBeDefined();
      expect(report.total_networks).toBe(1);
      expect(report.unmapped_carriers).toBeDefined();
    }, 10000);

    it('should handle report generation errors', async () => {
      mockBuilder.error = new Error('Database error');

      await expect(networkMapper.generateMappingReport())
        .rejects.toThrow('Report generation failed');
      expect(mockLogger.error).toHaveBeenCalled();
    }, 10000);
  });

  describe('createNetworkRelationship', () => {
    it('should create a network-carrier relationship', async () => {
      const mockRelationship = {
        network_id: 1,
        carrier_id: 1,
        effective_date: new Date('2024-01-01'),
        termination_date: new Date('2024-12-31'),
        special_notes: 'Test notes',
        verification_required: true
      };

      const mockResponse = Promise.resolve(createMockResponse(null));
      mockBuilder.insert.mockImplementation(() => ({
        ...mockBuilder,
        then: (onfulfilled: (value: PostgrestResponse<null>) => any) => mockResponse.then(onfulfilled)
      }));

      await expect(networkMapper.createNetworkRelationship(mockRelationship)).resolves.not.toThrow();
      expect(mockSupabase.from).toHaveBeenCalledWith('network_carrier_relationships');
      expect(mockBuilder.insert).toHaveBeenCalledWith(mockRelationship);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockRejection = Promise.reject(mockError);
      mockBuilder.insert.mockImplementation(() => ({
        ...mockBuilder,
        then: (_: any, onrejected: (reason: any) => any) => mockRejection.catch(onrejected)
      }));

      await expect(networkMapper.createNetworkRelationship({
        network_id: 1,
        carrier_id: 1
      })).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('detectNetworks edge cases', () => {
    it('should handle empty carrier list', async () => {
      const mockResponse = Promise.resolve(createMockResponse<CarrierType[]>([]));
      mockBuilder.select.mockImplementation(() => ({
        ...mockBuilder,
        then: (onfulfilled: (value: PostgrestResponse<CarrierType[]>) => any) => mockResponse.then(onfulfilled)
      }));

      const networks = await networkMapper.detectNetworks();
      expect(networks).toEqual([]);
    });

    it('should handle null website and contact info', async () => {
      const mockCarriers: CarrierType[] = [
        { name: 'Test Network', website: null, contact_info: null }
      ];

      const mockResponse = Promise.resolve(createMockResponse<CarrierType[]>(mockCarriers));
      mockBuilder.select.mockImplementation(() => ({
        ...mockBuilder,
        then: (onfulfilled: (value: PostgrestResponse<CarrierType[]>) => any) => mockResponse.then(onfulfilled)
      }));

      const networks = await networkMapper.detectNetworks();
      expect(networks).toContain('Test Network');
    });

    it('should handle database query error', async () => {
      mockBuilder.error = new Error('Database error');

      await expect(networkMapper.detectNetworks())
        .rejects.toThrow('Failed to detect networks');
      expect(mockLogger.error).toHaveBeenCalled();
    }, 10000);
  });

  describe('validateNetworkRelationships edge cases', () => {
    it('should handle empty relationships list', async () => {
      const mockEmptyResponse = Promise.resolve(createMockResponse([]));
      mockBuilder.select.mockImplementation(() => ({
        ...mockBuilder,
        not: jest.fn().mockReturnValue({
          ...mockBuilder,
          then: (onfulfilled: (value: PostgrestResponse<any>) => any) => mockEmptyResponse.then(onfulfilled)
        })
      }));

      const errors = await networkMapper.validateNetworkRelationships();
      expect(errors).toEqual([]);
    });

    it('should handle null dates in relationships', async () => {
      const mockRelationships = [{
        relationship_id: 1,
        network_id: 1,
        effective_date: null,
        termination_date: null
      }];

      mockBuilder.data = mockRelationships;
      const result = await networkMapper.validateNetworkRelationships();
      
      expect(result).toEqual([]);
    }, 10000);
  });
}); 
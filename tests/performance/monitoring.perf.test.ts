import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mockFrom } from '../setup.js';
import * as monitoring from '../../src/utils/monitoring.js';

jest.mock('@supabase/supabase-js');

describe('Monitoring Performance Tests', () => {
  const mockClient = {
    from: mockFrom,
    // Add required properties with minimal implementations
    supabaseUrl: 'http://localhost:54321',
    supabaseKey: 'test-key',
    auth: {},
    realtime: { connect: () => {}, disconnect: () => {} },
    rest: { get: () => Promise.resolve(null) },
    channel: () => ({ subscribe: () => ({}) }),
    getChannels: () => [],
    removeChannel: () => {},
    removeAllChannels: () => {},
    queryBuilder: () => ({}),
    rpc: () => Promise.resolve(null),
    storage: {},
    functions: {},
    schema: () => ({}),
    headers: {},
    setAuth: () => {},
    getAuth: () => null
  } as unknown as SupabaseClient;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockClient);
    monitoring.setSupabaseClient(mockClient);
  });

  describe('Request Metrics', () => {
    it('should track request metrics within latency threshold', async () => {
      const startTime = Date.now();
      
      // Simulate multiple requests
      const requests = Array(100).fill(null).map(async () => {
        const operation = async () => 'success';
        return monitoring.trackRequestMetrics(operation, 'test-endpoint');
      });

      await Promise.all(requests);
      
      const endTime = Date.now();
      const avgLatency = (endTime - startTime) / requests.length;

      expect(avgLatency).toBeLessThan(50); // 50ms threshold
      expect(mockClient.from).toHaveBeenCalledWith('request_metrics');
    });

    it('should maintain reasonable memory usage during tracking', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate high load
      const requests = Array(1000).fill(null).map(async () => {
        const operation = async () => 'success';
        return monitoring.trackRequestMetrics(operation, 'test-endpoint');
      });

      await Promise.all(requests);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(10); // 10MB threshold
    });
  });

  describe('API Usage', () => {
    it('should track API usage efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate multiple API calls
      const calls = Array(100).fill(null).map(async () => {
        return monitoring.trackAPIUsage('test-endpoint');
      });

      await Promise.all(calls);
      
      const endTime = Date.now();
      const avgLatency = (endTime - startTime) / calls.length;

      expect(avgLatency).toBeLessThan(20); // 20ms threshold
      expect(mockClient.from).toHaveBeenCalledWith('api_usage');
    });
  });

  describe('Error Rate Calculation', () => {
    it('should calculate error rates efficiently', async () => {
      const startTime = Date.now();
      
      const errorRates = await Promise.all(
        Array(10).fill(null).map(async () => {
          return monitoring.getErrorRate(
            'test-endpoint',
            new Date(Date.now() - 3600000), // 1 hour ago
            new Date()
          );
        })
      );
      
      const endTime = Date.now();
      const avgLatency = (endTime - startTime) / errorRates.length;

      expect(avgLatency).toBeLessThan(100); // 100ms threshold
      expect(mockClient.from).toHaveBeenCalledWith('request_metrics');
    });
  });

  describe('Average Latency Calculation', () => {
    it('should calculate average latency efficiently', async () => {
      const startTime = Date.now();
      
      const latencies = await Promise.all(
        Array(10).fill(null).map(async () => {
          return monitoring.getAverageLatency('test-endpoint', 60);
        })
      );
      
      const endTime = Date.now();
      const avgLatency = (endTime - startTime) / latencies.length;

      expect(avgLatency).toBeLessThan(100); // 100ms threshold
      expect(mockClient.from).toHaveBeenCalledWith('request_metrics');
    });
  });
}); 
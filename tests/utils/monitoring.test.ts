import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as monitoring from '../../src/utils/monitoring.js';
import { trackRequestMetrics, trackAPIUsage, getErrorRate, getAverageLatency } from '../../src/utils/monitoring.js';
import { mockFrom } from '../setup.js';

jest.mock('@supabase/supabase-js');

interface RequestMetric {
  success: boolean;
  duration?: number;
}

describe('Monitoring Module', () => {
  const mockClient = {
    from: mockFrom
  } as unknown as SupabaseClient;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockClient);
    monitoring.setSupabaseClient(mockClient);
  });

  describe('trackRequestMetrics', () => {
    it('should track successful requests', async () => {
      const operation = async () => 'success';
      const result = await trackRequestMetrics(operation, 'test-endpoint');

      expect(result).toBe('success');
      expect(mockClient.from).toHaveBeenCalledWith('request_metrics');
    });

    it('should track failed requests', async () => {
      const testError = new Error('test error');
      const operation = async () => { throw testError; };

      await expect(trackRequestMetrics(operation, 'test-endpoint'))
        .rejects
        .toThrow(testError);
      
      expect(mockClient.from).toHaveBeenCalledWith('request_metrics');
    });
  });

  describe('trackAPIUsage', () => {
    it('should track API usage', async () => {
      await trackAPIUsage('test-endpoint');
      expect(mockClient.from).toHaveBeenCalledWith('api_usage');
    });

    it('should handle tracking errors gracefully', async () => {
      const mockError = new Error('test error');
      mockFrom.mockImplementationOnce(() => ({
        upsert: jest.fn(() => Promise.resolve({ data: null, error: mockError }))
      }));
      await expect(trackAPIUsage('test-endpoint')).resolves.not.toThrow();
    });
  });

  describe('getErrorRate', () => {
    it('should calculate error rate correctly', async () => {
      const mockData: RequestMetric[] = [
        { success: true },
        { success: false },
        { success: true }
      ];

      mockFrom.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => Promise.resolve({ data: mockData, error: null }))
            }))
          }))
        }))
      }));

      const errorRate = await getErrorRate(
        'test-endpoint',
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(errorRate).toBe(1/3);
      expect(mockClient.from).toHaveBeenCalledWith('request_metrics');
    });

    it('should handle empty data', async () => {
      const errorRate = await getErrorRate(
        'test-endpoint',
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(errorRate).toBe(0);
    });
  });

  describe('getAverageLatency', () => {
    it('should calculate average latency correctly', async () => {
      const mockData: RequestMetric[] = [
        { success: true, duration: 100 },
        { success: true, duration: 200 },
        { success: true, duration: 300 }
      ];

      mockFrom.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => Promise.resolve({ data: mockData, error: null }))
          }))
        }))
      }));

      const avgLatency = await getAverageLatency('test-endpoint', 60);
      expect(avgLatency).toBe(200);
      expect(mockClient.from).toHaveBeenCalledWith('request_metrics');
    });

    it('should handle empty data', async () => {
      const avgLatency = await getAverageLatency('test-endpoint', 60);
      expect(avgLatency).toBe(0);
    });
  });
}); 
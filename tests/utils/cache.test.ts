import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { LRUCache, CacheConfig } from '../../src/utils/cache.js';

describe('LRUCache', () => {
  let cache: LRUCache<string, number>;
  const config: CacheConfig = {
    maxSize: 3,
    ttlMs: 1000,
    name: 'test-cache'
  };

  beforeEach(() => {
    cache = new LRUCache<string, number>(config);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 1);
      const value = await cache.get('key1');
      expect(value).toBe(1);
    });

    it('should return undefined for missing keys', async () => {
      const value = await cache.get('missing');
      expect(value).toBeUndefined();
    });

    it('should update existing values', async () => {
      await cache.set('key1', 1);
      await cache.set('key1', 2);
      const value = await cache.get('key1');
      expect(value).toBe(2);
    });

    it('should delete values', async () => {
      await cache.set('key1', 1);
      cache.delete('key1');
      const value = await cache.get('key1');
      expect(value).toBeUndefined();
    });

    it('should clear all values', async () => {
      await cache.set('key1', 1);
      await cache.set('key2', 2);
      cache.clear();
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item when full', async () => {
      await cache.set('key1', 1);
      await cache.set('key2', 2);
      await cache.set('key3', 3);
      
      // Access key1 to make it most recently used
      await cache.get('key1');
      
      // Add new item, should evict key2
      await cache.set('key4', 4);
      
      expect(await cache.get('key1')).toBe(1);
      expect(await cache.get('key2')).toBeUndefined();
      expect(await cache.get('key3')).toBe(3);
      expect(await cache.get('key4')).toBe(4);
    });
  });

  describe('TTL Behavior', () => {
    it('should expire items after TTL', async () => {
      await cache.set('key1', 1);
      
      // Advance time past TTL
      jest.advanceTimersByTime(config.ttlMs + 100);
      
      const value = await cache.get('key1');
      expect(value).toBeUndefined();
    });

    it('should not expire recently accessed items', async () => {
      await cache.set('key1', 1);
      
      // Advance time almost to TTL
      jest.advanceTimersByTime(config.ttlMs - 100);
      
      // Access the item
      await cache.get('key1');
      
      // Advance time almost to new TTL
      jest.advanceTimersByTime(config.ttlMs - 100);
      
      const value = await cache.get('key1');
      expect(value).toBe(1);
    });
  });

  describe('Cache Metrics', () => {
    it('should track hits and misses', async () => {
      await cache.set('key1', 1);
      
      await cache.get('key1'); // hit
      await cache.get('missing'); // miss
      
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });

    it('should track evictions', async () => {
      await cache.set('key1', 1);
      await cache.set('key2', 2);
      await cache.set('key3', 3);
      await cache.set('key4', 4); // Should cause eviction
      
      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBe(1);
      expect(metrics.size).toBe(3);
    });

    it('should track size correctly', async () => {
      await cache.set('key1', 1);
      await cache.set('key2', 2);
      
      let metrics = cache.getMetrics();
      expect(metrics.size).toBe(2);
      
      cache.delete('key1');
      
      metrics = cache.getMetrics();
      expect(metrics.size).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should periodically clean up expired items', async () => {
      await cache.set('key1', 1);
      await cache.set('key2', 2);
      
      // Advance time past TTL
      jest.advanceTimersByTime(config.ttlMs + 100);
      
      // Trigger cleanup
      jest.runOnlyPendingTimers();
      
      const metrics = cache.getMetrics();
      expect(metrics.size).toBe(0);
      expect(metrics.evictions).toBe(2);
    });
  });
}); 
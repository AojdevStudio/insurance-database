import { Logger } from './logging.js';
import { trackRequestMetrics } from './monitoring.js';

const logger = new Logger('cache-service');

interface CacheConfig {
  maxSize: number;
  ttlMs: number;
  name: string;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  lastAccessed: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

/**
 * LRU Cache implementation with TTL and monitoring
 */
class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private metrics: CacheMetrics;
  private readonly config: CacheConfig;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };

    // Start periodic cleanup
    setInterval(() => this.cleanup(), Math.min(config.ttlMs / 2, 60000));
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns Cached value or undefined if not found
   */
  async get(key: K): Promise<V | undefined> {
    return trackRequestMetrics(async () => {
      const entry = this.cache.get(key);

      if (!entry) {
        this.metrics.misses++;
        return undefined;
      }

      const now = Date.now();
      if (now - entry.timestamp > this.config.ttlMs) {
        this.delete(key);
        this.metrics.misses++;
        return undefined;
      }

      // Update both timestamp and last accessed time
      entry.timestamp = now;
      entry.lastAccessed = now;
      this.metrics.hits++;
      return entry.value;
    }, `cache-get-${this.config.name}`);
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   */
  async set(key: K, value: V): Promise<void> {
    return trackRequestMetrics(async () => {
      const now = Date.now();

      // Evict if at capacity and key doesn't exist
      if (!this.cache.has(key) && this.cache.size >= this.config.maxSize) {
        this.evictOldest();
      }

      this.cache.set(key, {
        value,
        timestamp: now,
        lastAccessed: now
      });

      this.metrics.size = this.cache.size;

      logger.debug('Cache entry added', {
        cache: this.config.name,
        key: String(key),
        size: this.cache.size
      });
    }, `cache-set-${this.config.name}`);
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   */
  delete(key: K): void {
    const existed = this.cache.delete(key);
    if (existed) {
      this.metrics.size = this.cache.size;
      logger.debug('Cache entry deleted', {
        cache: this.config.name,
        key: String(key),
        size: this.cache.size
      });
    }
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.metrics.size = 0;
    if (previousSize > 0) {
      logger.info('Cache cleared', {
        cache: this.config.name,
        previousSize
      });
    }
  }

  /**
   * Get current cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Remove expired entries and update metrics
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        this.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.metrics.evictions += expiredCount;
      logger.debug('Cache entries expired', {
        cache: this.config.name,
        count: expiredCount,
        remainingSize: this.cache.size
      });
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictOldest(): void {
    let oldestKey: K | undefined;
    let oldestAccessed = Infinity;

    // Find the least recently accessed entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccessed) {
        oldestAccessed = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.metrics.evictions++;
      logger.debug('Cache entry evicted', {
        cache: this.config.name,
        key: String(oldestKey)
      });
    }
  }
}

// Cache configurations
const CACHE_CONFIG = {
  EMBEDDINGS: {
    maxSize: 1000,
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours
    name: 'embeddings'
  },
  SEARCH_RESULTS: {
    maxSize: 100,
    ttlMs: 60 * 60 * 1000, // 1 hour
    name: 'search-results'
  },
  METRICS: {
    maxSize: 50,
    ttlMs: 5 * 60 * 1000, // 5 minutes
    name: 'metrics'
  }
} as const;

// Create cache instances
export const embeddingsCache = new LRUCache<string, number[]>(CACHE_CONFIG.EMBEDDINGS);
export const searchResultsCache = new LRUCache<string, Array<{ id: number; content: string; similarity: number }>>(CACHE_CONFIG.SEARCH_RESULTS);
export const metricsCache = new LRUCache<string, number>(CACHE_CONFIG.METRICS);

export type { CacheMetrics, CacheConfig };
export { LRUCache, CACHE_CONFIG }; 
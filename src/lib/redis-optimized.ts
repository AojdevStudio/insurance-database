/**
 * Enhanced Redis client implementation with performance optimizations
 * Provides a robust caching layer for the Prisma ORM implementation
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../api/utils/logger.js';

// Redis client singleton
let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// Create or return Redis client instance
export const getRedisClient = async (): Promise<RedisClientType> => {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    // Wait for connection to complete if already in progress
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (redisClient?.isOpen) {
      return redisClient;
    }
  }

  isConnecting = true;
  connectionAttempts = 0;

  try {
    // Initialize Redis client with optimized configuration
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000, // 5 seconds
        reconnectStrategy: (retries) => {
          // Reconnect with increasing delays up to 30 seconds
          return Math.min(retries * 1000, 30000);
        }
      }
    });

    // Set up event listeners
    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      connectionAttempts = 0;
    });

    // Connect with retry logic
    while (!redisClient.isOpen && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      try {
        connectionAttempts++;
        logger.info(`Redis connection attempt ${connectionAttempts}...`);
        await redisClient.connect();
      } catch (err) {
        if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
          logger.error('Failed to connect to Redis after multiple attempts:', err);
          throw err;
        }
        
        // Wait before retrying with exponential backoff
        const backoffTime = Math.pow(2, connectionAttempts) * 1000;
        logger.info(`Redis connection failed, retrying in ${backoffTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    // Success - reset state
    isConnecting = false;
    
    return redisClient;
  } catch (err) {
    // Failed to connect
    isConnecting = false;
    logger.error('Redis connection error:', err);
    
    // Return disabled client that won't crash the application
    return createDisabledClient();
  }
};

// Graceful shutdown helper
export const disconnectRedis = async (): Promise<void> => {
  if (redisClient?.isOpen) {
    try {
      await redisClient.quit();
      logger.info('Redis client disconnected gracefully');
    } catch (err) {
      logger.error('Error disconnecting Redis client:', err);
    }
  }
};

// Cache class with performance optimizations
export class RedisCache {
  private static readonly DEFAULT_TTL = 3600; // 1 hour in seconds
  private static readonly LONG_TTL = 86400; // 24 hours
  private static readonly SHORT_TTL = 300; // 5 minutes

  /**
   * Generate a deterministic cache key
   * @param prefix Cache key prefix/namespace
   * @param params Parameters that define the cached content
   * @returns Unique cache key
   */
  static generateKey(prefix: string, params: Record<string, any>): string {
    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);
    
    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get data from cache with error handling
   * @param key Cache key
   * @returns Cached data or null if not found
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      const data = await client.get(key);
      
      if (data) {
        logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(data) as T;
      }
      
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (err) {
      logger.warn('Redis get error:', err);
      return null; // Fail open on cache errors
    }
  }

  /**
   * Set data in cache with TTL
   * @param key Cache key
   * @param value Data to cache
   * @param ttl TTL in seconds
   * @returns Success status
   */
  static async set(key: string, value: any, ttl = this.DEFAULT_TTL): Promise<boolean> {
    try {
      const client = await getRedisClient();
      await client.setEx(key, ttl, JSON.stringify(value));
      logger.debug(`Cached data with key: ${key}, TTL: ${ttl}s`);
      return true;
    } catch (err) {
      logger.warn('Redis set error:', err);
      return false;
    }
  }

  /**
   * Delete a single cache entry
   * @param key Cache key
   * @returns Success status
   */
  static async delete(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      await client.del(key);
      logger.debug(`Deleted cache key: ${key}`);
      return true;
    } catch (err) {
      logger.warn('Redis delete error:', err);
      return false;
    }
  }

  /**
   * Delete multiple cache entries by pattern
   * @param pattern Key pattern to match (e.g., "users:*")
   * @returns Number of keys deleted
   */
  static async deleteByPattern(pattern: string): Promise<number> {
    try {
      const client = await getRedisClient();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const deletedCount = await client.del(keys);
      logger.info(`Deleted ${deletedCount} cache keys matching pattern: ${pattern}`);
      return deletedCount;
    } catch (err) {
      logger.warn('Redis delete by pattern error:', err);
      return 0;
    }
  }

  /**
   * Get and set cache with automatic fetcher function
   * @param key Cache key
   * @param fetcher Function to fetch data if not cached
   * @param ttl TTL in seconds
   * @returns Data from cache or fetcher
   */
  static async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl = this.DEFAULT_TTL
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Not in cache, fetch fresh data
    try {
      const startTime = performance.now();
      const data = await fetcher();
      const fetchTime = performance.now() - startTime;
      
      // Adjust TTL based on fetch time for expensive operations
      let adjustedTtl = ttl;
      if (fetchTime > 500) {
        // Longer TTL for expensive operations
        adjustedTtl = Math.min(ttl * 2, this.LONG_TTL);
        logger.debug(`Expensive operation (${fetchTime.toFixed(2)}ms), extending TTL to ${adjustedTtl}s`);
      }
      
      // Cache the result
      await this.set(key, data, adjustedTtl);
      return data;
    } catch (err) {
      logger.error('Error fetching data for cache:', err);
      throw err; // Propagate the error
    }
  }

  /**
   * Get cache statistics for a pattern
   * @param pattern Key pattern to match
   * @returns Statistics about matching keys
   */
  static async getStats(pattern: string): Promise<{
    keyCount: number;
    memoryUsage: number;
    keyList: string[];
  }> {
    try {
      const client = await getRedisClient();
      const keys = await client.keys(pattern);
      
      // No matching keys
      if (keys.length === 0) {
        return { keyCount: 0, memoryUsage: 0, keyList: [] };
      }
      
      // Get memory usage for each key
      let totalMemory = 0;
      for (const key of keys) {
        const memory = await client.memoryUsage(key);
        totalMemory += memory;
      }
      
      return {
        keyCount: keys.length,
        memoryUsage: totalMemory,
        keyList: keys
      };
    } catch (err) {
      logger.warn('Redis stats error:', err);
      return { keyCount: 0, memoryUsage: 0, keyList: [] };
    }
  }
}

// Create a disabled client for fallback mode
function createDisabledClient(): RedisClientType {
  // @ts-ignore - Creating mock Redis client
  return {
    isOpen: true,
    isReady: true,
    connect: async () => {},
    disconnect: async () => {},
    quit: async () => {},
    get: async () => null,
    set: async () => 'OK',
    setEx: async () => 'OK',
    del: async () => 0,
    keys: async () => [],
    memoryUsage: async () => 0,
    on: () => ({ isOpen: true })
  };
}

// Export singleton instance
export const redis = {
  getClient: getRedisClient,
  disconnect: disconnectRedis,
  cache: RedisCache
};

export default redis;

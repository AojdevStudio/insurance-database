/**
 * Optimization service for Prisma queries
 * Provides utilities for query performance, caching, and optimization
 */

import { Prisma } from '@prisma/client';
import { prisma, withQueryPerformance } from '../../../lib/prisma-optimized.js';
import { createClient as createRedisClient } from 'redis';
import { logger } from '../../utils/logger.js';

// Initialize Redis client
const redis = createRedisClient({
  url: process.env.REDIS_URL
});

redis.on('error', (err: Error) => logger.error('Redis Client Error', err));

export class PrismaOptimizationService {
  private static readonly CACHE_TTL = 3600; // 1 hour in seconds

  /**
   * Generates a deterministic cache key for query parameters
   * @param prefix Cache key prefix for the query type
   * @param params Query parameters
   * @returns A unique cache key string
   */
  static async getCacheKey(prefix: string, params: Record<string, any>): Promise<string> {
    // Sort keys alphabetically for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = params[key];
        return result;
      }, {});
      
    return `prisma:${prefix}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Retrieves data from Redis cache
   * @param key Cache key
   * @returns Cached data or null if not found
   */
  static async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(cached);
      }
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Stores data in Redis cache with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Optional TTL in seconds (defaults to CACHE_TTL)
   */
  static async setCache(key: string, data: any, ttl: number = this.CACHE_TTL): Promise<void> {
    try {
      await redis.setEx(key, ttl, JSON.stringify(data));
      logger.debug(`Cached data with key: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      logger.error('Cache setting error:', error);
    }
  }

  /**
   * Invalidates cache entries that match a pattern
   * @param pattern Cache key pattern to invalidate (e.g., "prisma:carriers:*")
   */
  static async invalidateCache(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error('Cache invalidation error:', error);
    }
  }

  /**
   * Executes a query with caching and performance monitoring
   * @param queryName Name of the query for logging
   * @param cacheKey Cache key for the query
   * @param queryFn Function that executes the query
   * @param ttl Optional cache TTL in seconds
   * @returns Query result
   */
  static async executeWithCache<T>(
    queryName: string,
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute query with performance monitoring
    const result = await withQueryPerformance(queryName, queryFn);
    
    // Cache the result
    await this.setCache(cacheKey, result, ttl);
    
    return result;
  }

  /**
   * Optimizes SELECT fields to fetch only needed data
   * @param fields Required fields for the query
   * @returns A Prisma select object
   */
  static createSelectFields<T extends Record<string, any>>(fields: (keyof T)[]): Record<string, boolean> {
    const select: Record<string, boolean> = {};
    fields.forEach(field => {
      select[field as string] = true;
    });
    return select;
  }

  /**
   * Executes a vector similarity search with optimized parameters
   * @param embedding Vector embedding
   * @param options Search options
   * @returns Search results with similarity scores
   */
  static async vectorSimilaritySearch<T>(
    tableName: string,
    embedding: number[],
    options: {
      limit?: number;
      minSimilarity?: number;
      selectFields?: string[];
      whereClause?: Prisma.Sql;
    }
  ): Promise<T[]> {
    const {
      limit = 10,
      minSimilarity = 0.7,
      selectFields = [],
      whereClause
    } = options;

    // Convert embedding to string format for raw query
    const embedString = `[${embedding.join(',')}]`;
    
    // Build the SELECT portion of the query
    let selectClause = '*';
    if (selectFields.length > 0) {
      selectClause = selectFields.map(field => `g.${field}`).join(', ');
    }

    // Build the base query
    let query = Prisma.sql`
      SELECT ${Prisma.raw(selectClause)}, g.embedding <=> ${embedString}::vector as vector_similarity
      FROM ${Prisma.raw(tableName)} g
      WHERE g.embedding <=> ${embedString}::vector < ${minSimilarity}
    `;

    // Add additional WHERE clause if provided
    if (whereClause) {
      query = Prisma.sql`${query} AND ${whereClause}`;
    }

    // Add ORDER BY and LIMIT
    query = Prisma.sql`
      ${query}
      ORDER BY vector_similarity ASC
      LIMIT ${limit}
    `;

    // Execute optimized query
    return await prisma.$queryRaw(query);
  }

  /**
   * Optimizes pagination for large dataset queries
   * @param page Page number
   * @param limit Items per page
   * @param orderByField Field to order by
   * @param orderByDirection Sort direction
   * @returns Prisma query parameters for pagination
   */
  static getPaginationParams(
    page: number = 1,
    limit: number = 10,
    orderByField: string = 'id',
    orderByDirection: 'asc' | 'desc' = 'desc'
  ): {
    skip: number;
    take: number;
    orderBy: Record<string, string>;
  } {
    const skip = (page - 1) * limit;
    return {
      skip,
      take: limit,
      orderBy: { [orderByField]: orderByDirection }
    };
  }

  /**
   * Creates an optimized full-text search condition
   * @param searchText Search text
   * @param searchFields Fields to search in
   * @returns Prisma WHERE condition
   */
  static getFullTextSearchCondition(
    searchText: string,
    searchFields: string[]
  ): Prisma.Sql {
    // Split search text into terms
    const terms = searchText
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 0);

    if (terms.length === 0) {
      return Prisma.sql`1=1`; // No search terms, return all
    }

    // Create conditions for each term and field
    const conditions = terms.flatMap(term => 
      searchFields.map(field => 
        Prisma.sql`${Prisma.raw(field)} ILIKE ${'%' + term + '%'}`
      )
    );

    // Combine with OR
    return this.combineConditions(conditions, 'OR');
  }

  /**
   * Combines multiple SQL conditions with a logical operator
   * @param conditions Array of SQL conditions
   * @param operator Logical operator (AND or OR)
   * @returns Combined SQL condition
   */
  static combineConditions(
    conditions: Prisma.Sql[],
    operator: 'AND' | 'OR' = 'AND'
  ): Prisma.Sql {
    if (conditions.length === 0) {
      return Prisma.sql`1=1`;
    }
    
    if (conditions.length === 1) {
      return conditions[0];
    }
    
    return Prisma.sql`(${Prisma.join(conditions, Prisma.raw(` ${operator} `))})`;
  }
}

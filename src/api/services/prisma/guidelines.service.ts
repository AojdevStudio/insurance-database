/**
 * Prisma-based implementation of the GuidelineService
 * Handles search operations for insurance guidelines with various search methods
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { 
  IGuideline, 
  IGuidelineSearchQuery, 
  IGuidelineSearchResponse, 
  IGuidelineSearchResult 
} from '../../types/guidelines.js';
import { createClient as createRedisClient } from 'redis';
import { logger } from '../../utils/logger.js';
import { OpenAIService } from '../openai.service.js';

// Initialize Redis client
const redis = createRedisClient({
  url: process.env.REDIS_URL
});

redis.on('error', (err: Error) => logger.error('Redis Client Error', err));

export class PrismaGuidelineService {
  private static readonly CACHE_TTL = 3600; // 1 hour in seconds
  private static readonly DEFAULT_MIN_SIMILARITY = 0.7;
  private static readonly DEFAULT_TEXT_WEIGHT = 0.3;
  private static readonly DEFAULT_VECTOR_WEIGHT = 0.7;
  private static readonly DEFAULT_RRF_K = 60.0;

  private static async getCacheKey(params: Record<string, any>): Promise<string> {
    return `prisma_guidelines:${JSON.stringify(params)}`;
  }

  private static async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Cache retrieval error:', error);
      return null;
    }
  }

  private static async setCache(key: string, data: any): Promise<void> {
    try {
      await redis.setEx(key, this.CACHE_TTL, JSON.stringify(data));
    } catch (error) {
      logger.error('Cache setting error:', error);
    }
  }

  private static formatGuideline(guideline: IGuidelineSearchResult): IGuidelineSearchResult {
    return {
      ...guideline,
      created_at: new Date(guideline.created_at),
      text_similarity: guideline.text_similarity,
      vector_similarity: guideline.vector_similarity,
      combined_similarity: guideline.combined_similarity
    };
  }

  /**
   * Standard search for guidelines with pagination and filtering
   * @param options Search parameters including pagination and filtering
   * @returns Paginated list of guidelines
   */
  static async searchGuidelines(options: IGuidelineSearchQuery = {}): Promise<IGuidelineSearchResponse> {
    const {
      query = '',
      carrier_id,
      category,
      page = 1,
      limit = 10
    } = options;

    const cacheKey = await this.getCacheKey({ query, carrier_id, category, page, limit });
    const cached = await this.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    // Ensure numeric types
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build where clause for filtering
      const where: Prisma.GuidelineWhereInput = {};
      
      // Apply text search if query provided
      if (query) {
        where.OR = [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } }
        ];
      }
      
      // Apply carrier filter if provided
      if (carrier_id) {
        where.carrier_id = Number(carrier_id);
      }

      // Apply category filter if provided
      if (category) {
        where.category = category;
      }

      // Get total count with applied filters
      const total = await prisma.guideline.count({ where });

      // Get paginated guidelines
      const guidelines = await prisma.guideline.findMany({
        where,
        skip: offset,
        take: limitNum,
        orderBy: {
          created_at: 'desc'
        }
      });

      // Map to application interface
      const mappedGuidelines: IGuideline[] = guidelines.map(guideline => ({
        id: guideline.id as number,
        title: guideline.title,
        content: guideline.content,
        carrier_id: guideline.carrier_id as number,
        category: guideline.category,
        created_at: guideline.created_at || new Date()
      }));

      const result: IGuidelineSearchResponse = {
        guidelines: mappedGuidelines as IGuidelineSearchResult[],
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error('Prisma known error:', error.message, error.code);
        throw new Error(`Database error: ${error.message}`);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        logger.error('Prisma validation error:', error.message);
        throw new Error('Invalid data provided');
      } else {
        logger.error('Error searching guidelines:', error);
        throw error;
      }
    }
  }

  /**
   * Semantic search using vector embeddings
   * @param options Search parameters including query and filters
   * @returns Relevant guidelines sorted by vector similarity
   */
  static async semanticSearch(options: IGuidelineSearchQuery): Promise<IGuidelineSearchResponse> {
    const {
      query,
      carrier_id,
      category,
      limit = 10,
      min_similarity = this.DEFAULT_MIN_SIMILARITY
    } = options;

    if (!query) {
      throw new Error('Query is required for semantic search');
    }

    const cacheKey = await this.getCacheKey({ 
      query, 
      carrier_id, 
      category, 
      limit, 
      min_similarity,
      type: 'semantic' 
    });
    const cached = await this.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    try {
      // Get query embedding from OpenAI
      const embedding = await OpenAIService.createEmbedding(query);

      // Build SQL query for vector search
      let sql = `
        SELECT 
          g.id, 
          g.title, 
          g.content, 
          g.carrier_id, 
          g.category,
          g.created_at,
          g.embedding <=> $1 as vector_similarity
        FROM "guidelines" g
        WHERE g.embedding <=> $1 < $2
      `;

      const params: any[] = [embedding, min_similarity];
      let paramIndex = 3;  // Next parameter index

      // Add carrier filter if provided
      if (carrier_id !== undefined) {
        sql += ` AND g.carrier_id = $${paramIndex}`;
        params.push(Number(carrier_id));
        paramIndex++;
      }

      // Add category filter if provided
      if (category) {
        sql += ` AND g.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Add order by and limit
      sql += `
        ORDER BY vector_similarity ASC
        LIMIT $${paramIndex}
      `;
      params.push(Number(limit));

      // Execute raw query
      const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>(
        Prisma.sql([sql, ...params])
      );

      // Format the response
      const result: IGuidelineSearchResponse = {
        guidelines: guidelines.map(g => this.formatGuideline(g)),
        total: guidelines.length,
        page: 1,
        limit: Number(limit),
        total_pages: 1
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error in semantic search:', error);
      throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Text search using PostgreSQL text search capabilities
   * @param options Search parameters including query and filters
   * @returns Relevant guidelines sorted by text similarity
   */
  static async textSearch(options: IGuidelineSearchQuery): Promise<IGuidelineSearchResponse> {
    const {
      query,
      carrier_id,
      category,
      limit = 10,
      min_similarity = this.DEFAULT_MIN_SIMILARITY
    } = options;

    if (!query) {
      throw new Error('Query is required for text search');
    }

    const cacheKey = await this.getCacheKey({ 
      ...options,
      type: 'text' 
    });
    
    const cached = await this.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    try {
      // Build SQL query for text search using pg_trgm similarity
      let sql = `
        SELECT 
          g.id, 
          g.title, 
          g.content, 
          g.carrier_id, 
          g.category,
          g.created_at,
          similarity(g.content, $1) as text_similarity
        FROM "guidelines" g
        WHERE similarity(g.content, $1) > $2
      `;

      const params: any[] = [query, min_similarity];
      let paramIndex = 3;  // Next parameter index

      // Add carrier filter if provided
      if (carrier_id !== undefined) {
        sql += ` AND g.carrier_id = $${paramIndex}`;
        params.push(Number(carrier_id));
        paramIndex++;
      }

      // Add category filter if provided
      if (category) {
        sql += ` AND g.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Add order by and limit
      sql += `
        ORDER BY text_similarity DESC
        LIMIT $${paramIndex}
      `;
      params.push(Number(limit));

      // Execute raw query
      const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>(
        Prisma.sql([sql, ...params])
      );

      // Format the response
      const result: IGuidelineSearchResponse = {
        guidelines: guidelines.map(g => ({
          ...this.formatGuideline(g),
          text_similarity: g.text_similarity
        })),
        total: guidelines.length,
        page: 1,
        limit: Number(limit),
        total_pages: 1
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error in text search:', error);
      throw new Error(`Text search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hybrid search combining vector and text search
   * @param options Search parameters including query and filters
   * @returns Relevant guidelines with combined ranking
   */
  static async hybridSearch(options: IGuidelineSearchQuery): Promise<IGuidelineSearchResponse> {
    const {
      query,
      carrier_id,
      category,
      limit = 10,
      min_similarity = this.DEFAULT_MIN_SIMILARITY,
      text_weight = this.DEFAULT_TEXT_WEIGHT,
      vector_weight = this.DEFAULT_VECTOR_WEIGHT
    } = options;

    if (!query) {
      throw new Error('Query is required for hybrid search');
    }

    const cacheKey = await this.getCacheKey({ 
      ...options,
      type: 'hybrid' 
    });
    
    const cached = await this.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    try {
      // Get query embedding from OpenAI
      const embedding = await OpenAIService.createEmbedding(query);

      // Build SQL query for hybrid search
      let sql = `
        SELECT 
          g.id, 
          g.title, 
          g.content, 
          g.carrier_id, 
          g.category,
          g.created_at,
          similarity(g.content, $1) as text_similarity,
          g.embedding <=> $2 as vector_similarity,
          ($3 * similarity(g.content, $1)) + ($4 * (1 - (g.embedding <=> $2))) as combined_similarity
        FROM "guidelines" g
        WHERE 
          (($3 * similarity(g.content, $1)) + ($4 * (1 - (g.embedding <=> $2)))) > $5
      `;

      const params: any[] = [
        query, 
        embedding, 
        text_weight, 
        vector_weight,
        min_similarity
      ];
      let paramIndex = 6;  // Next parameter index

      // Add carrier filter if provided
      if (carrier_id !== undefined) {
        sql += ` AND g.carrier_id = $${paramIndex}`;
        params.push(Number(carrier_id));
        paramIndex++;
      }

      // Add category filter if provided
      if (category) {
        sql += ` AND g.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Add order by and limit
      sql += `
        ORDER BY combined_similarity DESC
        LIMIT $${paramIndex}
      `;
      params.push(Number(limit));

      // Execute raw query
      const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>(
        Prisma.sql([sql, ...params])
      );

      // Format the response
      const result: IGuidelineSearchResponse = {
        guidelines: guidelines.map(g => ({
          ...this.formatGuideline(g),
          text_similarity: g.text_similarity,
          vector_similarity: g.vector_similarity,
          combined_similarity: g.combined_similarity
        })),
        total: guidelines.length,
        page: 1,
        limit: Number(limit),
        total_pages: 1
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error in hybrid search:', error);
      throw new Error(`Hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reciprocal Rank Fusion (RRF) based hybrid search
   * @param options Search parameters including query and filters
   * @returns Relevant guidelines with RRF ranking
   */
  static async rrf_hybridSearch(options: IGuidelineSearchQuery): Promise<IGuidelineSearchResponse> {
    const {
      query,
      carrier_id,
      category,
      limit = 10,
      min_similarity = this.DEFAULT_MIN_SIMILARITY,
      rrf_k = this.DEFAULT_RRF_K
    } = options;

    if (!query) {
      throw new Error('Query is required for RRF hybrid search');
    }

    const cacheKey = await this.getCacheKey({ 
      ...options,
      type: 'rrf_hybrid' 
    });
    
    const cached = await this.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    try {
      // Get query embedding from OpenAI
      const embedding = await OpenAIService.createEmbedding(query);

      // Build SQL query for RRF hybrid search
      // The actual RRF formula is implemented in the SQL using two CTEs:
      // 1. One for text search ranking
      // 2. One for vector search ranking
      // Then we combine them using the RRF formula: RRF(d) = sum(1 / (k + r_i))
      let sql = `
        WITH text_ranks AS (
          SELECT 
            g.id, 
            ROW_NUMBER() OVER (ORDER BY similarity(g.content, $1) DESC) as text_rank
          FROM "guidelines" g
          WHERE similarity(g.content, $1) > $3
        ),
        vector_ranks AS (
          SELECT 
            g.id, 
            ROW_NUMBER() OVER (ORDER BY g.embedding <=> $2) as vector_rank
          FROM "guidelines" g
          WHERE g.embedding <=> $2 < $3
        )
        SELECT 
          g.id, 
          g.title, 
          g.content, 
          g.carrier_id, 
          g.category,
          g.created_at,
          similarity(g.content, $1) as text_similarity,
          g.embedding <=> $2 as vector_similarity,
          COALESCE(1.0 / ($4 + tr.text_rank), 0) + COALESCE(1.0 / ($4 + vr.vector_rank), 0) as rrf_score,
          CASE 
            WHEN tr.text_rank IS NOT NULL AND vr.vector_rank IS NOT NULL THEN 'Found by both text and vector search'
            WHEN tr.text_rank IS NOT NULL THEN 'Found by text search only'
            WHEN vr.vector_rank IS NOT NULL THEN 'Found by vector search only'
            ELSE 'Unknown match reason'
          END as explanation
        FROM "guidelines" g
        LEFT JOIN text_ranks tr ON g.id = tr.id
        LEFT JOIN vector_ranks vr ON g.id = vr.id
        WHERE tr.id IS NOT NULL OR vr.id IS NOT NULL
      `;

      const params: any[] = [query, embedding, min_similarity, rrf_k];
      let paramIndex = 5;  // Next parameter index

      // Add carrier filter if provided
      if (carrier_id !== undefined) {
        sql += ` AND g.carrier_id = $${paramIndex}`;
        params.push(Number(carrier_id));
        paramIndex++;
      }

      // Add category filter if provided
      if (category) {
        sql += ` AND g.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Add order by and limit
      sql += `
        ORDER BY rrf_score DESC
        LIMIT $${paramIndex}
      `;
      params.push(Number(limit));

      // Execute raw query
      const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>(
        Prisma.sql([sql, ...params])
      );

      // Format the response
      const result: IGuidelineSearchResponse = {
        guidelines: guidelines.map(g => ({
          ...this.formatGuideline(g),
          text_similarity: g.text_similarity,
          vector_similarity: g.vector_similarity,
          rrf_score: g.rrf_score,
          explanation: g.explanation
        })),
        total: guidelines.length,
        page: 1,
        limit: Number(limit),
        total_pages: 1
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error in RRF hybrid search:', error);
      throw new Error(`RRF hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unified search interface that dispatches to the appropriate search method
   * @param options Search parameters including search_type
   * @returns Search results from the selected search method
   */
  static async search(options: IGuidelineSearchQuery): Promise<IGuidelineSearchResponse> {
    const { search_type = 'semantic' } = options;

    switch (search_type) {
      case 'rrf_hybrid':
        return this.rrf_hybridSearch(options);
      case 'hybrid':
        return this.hybridSearch(options);
      case 'semantic':
        return this.semanticSearch(options);
      case 'text':
        return this.textSearch(options);
      default:
        throw new Error(`Invalid search type: ${search_type}`);
    }
  }
}

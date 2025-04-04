/**
 * Optimized Prisma-based implementation of the GuidelineService
 * Includes performance enhancements for search operations
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma-optimized.js';
import {
  IGuideline,
  IGuidelineSearchQuery,
  IGuidelineSearchResponse,
  IGuidelineSearchResult
} from '../../types/guidelines.js';
import { logger } from '../../utils/logger.js';
import { OpenAIService } from '../openai.service.js';
import { PrismaOptimizationService } from './optimization.service.js';

export class OptimizedGuidelineService {
  private static readonly DEFAULT_MIN_SIMILARITY = 0.7;
  private static readonly DEFAULT_TEXT_WEIGHT = 0.3;
  private static readonly DEFAULT_VECTOR_WEIGHT = 0.7;
  private static readonly DEFAULT_RRF_K = 60.0;

  /**
   * Format guideline result with proper type conversions
   */
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
   * Handle Prisma-specific errors with improved logging
   */
  private static handlePrismaError(error: unknown, methodName: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(`Prisma known error in ${methodName}:`, error.message, error.code);
      throw new Error(`Database error (${error.code}): ${error.message}`);
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      logger.error(`Prisma validation error in ${methodName}:`, error.message);
      throw new Error('Invalid data provided');
    } else if (error instanceof Prisma.PrismaClientRustPanicError) {
      logger.error(`Prisma client panic in ${methodName}:`, error.message);
      throw new Error('Critical database error, please report this issue');
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      logger.error(`Prisma initialization error in ${methodName}:`, error.message);
      throw new Error('Database connection error');
    } else {
      logger.error(`Error in ${methodName}:`, error);
      throw error;
    }
  }

  /**
   * Standard search for guidelines with pagination and filtering
   * Performance optimized with:
   * - Proper indexing
   * - Selective field fetching
   * - Redis caching
   * - Query logging
   */
  static async searchGuidelines(options: IGuidelineSearchQuery = {}): Promise<IGuidelineSearchResponse> {
    const {
      query = '',
      carrier_id,
      category,
      page = 1,
      limit = 10
    } = options;

    // Generate cache key based on query parameters
    const cacheKey = await PrismaOptimizationService.getCacheKey('guidelines:search', {
      query, carrier_id, category, page, limit
    });

    // Return cached result if available
    const cached = await PrismaOptimizationService.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    // Ensure numeric types
    const pageNum = Number(page);
    const limitNum = Number(limit);

    // Get pagination parameters
    const pagination = PrismaOptimizationService.getPaginationParams(
      pageNum,
      limitNum,
      'created_at',
      'desc'
    );

    // Execute query with performance monitoring
    return await PrismaOptimizationService.executeWithCache(
      'guidelineSearch',
      cacheKey,
      async () => {
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

          // Get paginated guidelines with only necessary fields
          const guidelines = await prisma.guideline.findMany({
            where,
            select: {
              id: true,
              title: true,
              content: true,
              carrier_id: true,
              category: true,
              created_at: true
            },
            ...pagination
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

          return result;
        } catch (error) {
          // Handle Prisma-specific errors
          this.handlePrismaError(error, 'searchGuidelines');
          throw error;
        }
      }
    );
  }

  /**
   * Semantic search using vector embeddings
   * Performance optimized with:
   * - Optimized vector index (IVF-Flat)
   * - Specialized database function
   * - Efficient caching
   * - Selective result fields
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

    // Generate cache key
    const cacheKey = await PrismaOptimizationService.getCacheKey('guidelines:semantic', {
      query, carrier_id, category, limit, min_similarity
    });

    // Check cache
    const cached = await PrismaOptimizationService.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    return await PrismaOptimizationService.executeWithCache(
      'semanticSearch',
      cacheKey,
      async () => {
        try {
          // Get query embedding from OpenAI
          const embedding = await OpenAIService.createEmbedding(query);

          // Use the optimized database function for vector search
          const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>`
            SELECT * FROM vector_similarity_search(
              ${embedding}::vector,
              ${Number(min_similarity)}::float,
              ${Number(limit)}::int,
              ${carrier_id ? Number(carrier_id) : null}::bigint,
              ${category || null}::text
            )
          `;

          // Format the response
          const result: IGuidelineSearchResponse = {
            guidelines: guidelines.map(g => ({
              ...this.formatGuideline(g),
              vector_similarity: g.similarity
            })),
            total: guidelines.length,
            page: 1,
            limit: Number(limit),
            total_pages: 1
          };

          return result;
        } catch (error) {
          logger.error('Error in semantic search:', error);
          throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    );
  }

  /**
   * Text search using PostgreSQL text search capabilities
   * Performance optimized with:
   * - Optimized trigram indexes
   * - Specialized database function
   * - Efficient caching
   * - Selective field projection
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

    // Generate cache key
    const cacheKey = await PrismaOptimizationService.getCacheKey('guidelines:text', {
      ...options,
    });

    // Check cache
    const cached = await PrismaOptimizationService.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    return await PrismaOptimizationService.executeWithCache(
      'textSearch',
      cacheKey,
      async () => {
        try {
          // Use the optimized database function for fuzzy text search
          const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>`
            SELECT * FROM fuzzy_text_search(
              ${query}::text,
              ${Number(min_similarity)}::float,
              ${Number(limit)}::int,
              ${carrier_id ? Number(carrier_id) : null}::bigint,
              ${category || null}::text
            )
          `;

          // Format the response
          const result: IGuidelineSearchResponse = {
            guidelines: guidelines.map(g => ({
              ...this.formatGuideline(g),
              text_similarity: g.similarity
            })),
            total: guidelines.length,
            page: 1,
            limit: Number(limit),
            total_pages: 1
          };

          return result;
        } catch (error) {
          logger.error('Error in text search:', error);
          throw new Error(`Text search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    );
  }

  /**
   * Hybrid search combining vector and text search
   * Performance optimized with:
   * - Specialized database function
   * - Optimized combined scoring formula
   * - Smart caching for repeat queries
   * - Efficient query execution plan
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

    // Generate cache key
    const cacheKey = await PrismaOptimizationService.getCacheKey('guidelines:hybrid', {
      ...options
    });

    // Check cache
    const cached = await PrismaOptimizationService.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    return await PrismaOptimizationService.executeWithCache(
      'hybridSearch',
      cacheKey,
      async () => {
        try {
          // Get query embedding from OpenAI
          const embedding = await OpenAIService.createEmbedding(query);

          // Use the optimized database function for hybrid search
          const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>`
            SELECT * FROM hybrid_search(
              ${query}::text,
              ${embedding}::vector,
              ${Number(text_weight)}::float,
              ${Number(vector_weight)}::float,
              ${Number(min_similarity)}::float,
              ${Number(limit)}::int,
              ${carrier_id ? Number(carrier_id) : null}::bigint,
              ${category || null}::text
            )
          `;

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

          return result;
        } catch (error) {
          logger.error('Error in hybrid search:', error);
          throw new Error(`Hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    );
  }

  /**
   * Reciprocal Rank Fusion (RRF) based hybrid search
   * Performance optimized with:
   * - Specialized database function
   * - Optimized query execution plan
   * - Efficient caching strategy
   * - Improved ranking algorithm
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

    // Generate cache key
    const cacheKey = await PrismaOptimizationService.getCacheKey('guidelines:rrf_hybrid', {
      ...options
    });

    // Check cache
    const cached = await PrismaOptimizationService.getFromCache<IGuidelineSearchResponse>(cacheKey);
    if (cached) return cached;

    return await PrismaOptimizationService.executeWithCache(
      'rrf_hybridSearch',
      cacheKey,
      async () => {
        try {
          // Get query embedding from OpenAI
          const embedding = await OpenAIService.createEmbedding(query);

          // Use the optimized database function for RRF hybrid search
          const guidelines = await prisma.$queryRaw<IGuidelineSearchResult[]>`
            SELECT * FROM rrf_hybrid_search(
              ${query}::text,
              ${embedding}::vector,
              ${Number(rrf_k)}::float,
              ${Number(min_similarity)}::float,
              ${Number(limit)}::int,
              ${carrier_id ? Number(carrier_id) : null}::bigint,
              ${category || null}::text
            )
          `;

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

          return result;
        } catch (error) {
          logger.error('Error in RRF hybrid search:', error);
          throw new Error(`RRF hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      // Cache RRF results for a longer period (2 hours) as they're computationally expensive
      7200
    );
  }

  /**
   * Unified search interface that dispatches to the appropriate search method
   * Performance optimized with appropriate routing based on query characteristics
   * @param options Search parameters including search_type
   * @returns Search results from the selected search method
   */
  static async search(options: IGuidelineSearchQuery): Promise<IGuidelineSearchResponse> {
    const { search_type = 'semantic' } = options;

    // Log search parameters for analysis
    logger.debug(`Search requested with type: ${search_type}`, options);

    try {
      let result: IGuidelineSearchResponse;

      // Route to appropriate search method
      switch (search_type) {
        case 'rrf_hybrid':
          result = await this.rrf_hybridSearch(options);
          break;
        case 'hybrid':
          result = await this.hybridSearch(options);
          break;
        case 'semantic':
          result = await this.semanticSearch(options);
          break;
        case 'text':
          result = await this.textSearch(options);
          break;
        default:
          throw new Error(`Invalid search type: ${search_type}`);
      }

      // Log search result summary for performance analysis
      logger.debug(`Search completed with type: ${search_type}, found ${result.total} results`);

      return result;
    } catch (error) {
      logger.error(`Error in unified search (${search_type}):`, error);
      throw error;
    }
  }

  /**
   * Invalidate all guidelines search caches
   * Used when guidelines data is updated
   */
  static async invalidateSearchCaches(): Promise<void> {
    await PrismaOptimizationService.invalidateCache('prisma:guidelines:*');
  }

  /**
   * Get guideline by ID with optimized field selection
   */
  static async getGuidelineById(id: number): Promise<IGuideline | null> {
    try {
      const guideline = await prisma.guideline.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          content: true,
          carrier_id: true,
          category: true,
          created_at: true
        }
      });

      return guideline ? {
        id: guideline.id as number,
        title: guideline.title,
        content: guideline.content,
        carrier_id: guideline.carrier_id as number,
        category: guideline.category,
        created_at: guideline.created_at || new Date()
      } : null;
    } catch (error) {
      this.handlePrismaError(error, 'getGuidelineById');
      throw error;
    }
  }
}

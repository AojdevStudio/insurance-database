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
   * - Optimized vector index
   * - Raw SQL queries
   * - Query batching
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

          // Build WHERE clause for carrier and category filtering
          let whereClause: Prisma.Sql | undefined;
          const conditions: Prisma.Sql[] = [];
          
          if (carrier_id !== undefined) {
            conditions.push(Prisma.sql`g.carrier_id = ${Number(carrier_id)}`);
          }
          
          if (category) {
            conditions.push(Prisma.sql`g.category = ${category}`);
          }
          
          if (conditions.length > 0) {
            whereClause = PrismaOptimizationService.combineConditions(conditions);
          }

          // Perform optimized vector search
          const guidelines = await PrismaOptimizationService.vectorSimilaritySearch<IGuidelineSearchResult>(
            'guidelines g',
            embedding,
            {
              limit: Number(limit),
              minSimilarity: Number(min_similarity),
              selectFields: ['id', 'title', 'content', 'carrier_id', 'category', 'created_at'],
              whereClause
            }
          );

          // Format the response
          const result: IGuidelineSearchResponse = {
            guidelines: guidelines.map(g => this.formatGuideline(g)),
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
   * - Caching
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
          // Build SQL query for text search using pg_trgm similarity with index usage
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
   * - Batch processing for vector embeddings
   * - Smart caching for repeat queries
   * - Optimized combined scoring formula
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

          // Build SQL query for hybrid search with optimized formula
          let sql = `
            WITH text_matches AS (
              SELECT 
                id, 
                similarity(content, $1) as text_score
              FROM guidelines
              WHERE similarity(content, $1) > $5
            ),
            vector_matches AS (
              SELECT 
                id, 
                1 - (embedding <=> $2) as vector_score
              FROM guidelines
              WHERE embedding <=> $2 < $5
            )
            SELECT 
              g.id, 
              g.title, 
              g.content, 
              g.carrier_id, 
              g.category,
              g.created_at,
              COALESCE(tm.text_score, 0) as text_similarity,
              COALESCE(vm.vector_score, 0) as vector_similarity,
              ($3 * COALESCE(tm.text_score, 0)) + ($4 * COALESCE(vm.vector_score, 0)) as combined_similarity
            FROM guidelines g
            LEFT JOIN text_matches tm ON g.id = tm.id
            LEFT JOIN vector_matches vm ON g.id = vm.id
            WHERE 
              tm.id IS NOT NULL OR vm.id IS NOT NULL
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

          // Execute raw query with optimized parameters
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
   * - Common Table Expressions (CTEs) for better query execution plans
   * - Specialized indexing for RRF operations
   * - Optimized query structure for PostgreSQL query planner
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

          // Build optimized SQL query for RRF hybrid search
          let sql = `
            WITH candidate_ids AS (
              -- Pre-filter potential candidates to reduce ranking workload
              SELECT id FROM guidelines g
              WHERE 
                similarity(g.content, $1) > $3 OR
                g.embedding <=> $2 < $3
              LIMIT 500
            ),
            text_ranks AS (
              -- Rank by text similarity
              SELECT 
                g.id, 
                ROW_NUMBER() OVER (ORDER BY similarity(g.content, $1) DESC) as text_rank,
                similarity(g.content, $1) as text_score
              FROM guidelines g
              JOIN candidate_ids c ON g.id = c.id
              WHERE similarity(g.content, $1) > $3
            ),
            vector_ranks AS (
              -- Rank by vector similarity
              SELECT 
                g.id, 
                ROW_NUMBER() OVER (ORDER BY g.embedding <=> $2) as vector_rank,
                1 - (g.embedding <=> $2) as vector_score
              FROM guidelines g
              JOIN candidate_ids c ON g.id = c.id
              WHERE g.embedding <=> $2 < $3
            ),
            combined_ranks AS (
              -- Calculate RRF score
              SELECT 
                g.id,
                COALESCE(1.0 / ($4 + tr.text_rank), 0) + COALESCE(1.0 / ($4 + vr.vector_rank), 0) as rrf_score,
                tr.text_score,
                vr.vector_score,
                CASE 
                  WHEN tr.text_rank IS NOT NULL AND vr.vector_rank IS NOT NULL THEN 'Found by both text and vector search'
                  WHEN tr.text_rank IS NOT NULL THEN 'Found by text search only'
                  WHEN vr.vector_rank IS NOT NULL THEN 'Found by vector search only'
                  ELSE 'Unknown match reason'
                END as explanation
              FROM guidelines g
              JOIN candidate_ids c ON g.id = c.id
              LEFT JOIN text_ranks tr ON g.id = tr.id
              LEFT JOIN vector_ranks vr ON g.id = vr.id
              WHERE tr.id IS NOT NULL OR vr.id IS NOT NULL
              ORDER BY rrf_score DESC
              LIMIT $5
            )
            -- Final result with all needed fields
            SELECT 
              g.id, 
              g.title, 
              g.content, 
              g.carrier_id, 
              g.category,
              g.created_at,
              cr.text_score as text_similarity,
              cr.vector_score as vector_similarity,
              cr.rrf_score,
              cr.explanation
            FROM combined_ranks cr
            JOIN guidelines g ON cr.id = g.id
          `;

          const params: any[] = [
            query, 
            embedding, 
            min_similarity, 
            rrf_k,
            Number(limit)
          ];
          
          // Add WHERE clause for carrier and category filters
          const conditions: string[] = [];
          let paramIndex = 6;
          
          if (carrier_id !== undefined) {
            conditions.push(`g.carrier_id = $${paramIndex}`);
            params.push(Number(carrier_id));
            paramIndex++;
          }
          
          if (category) {
            conditions.push(`g.category = $${paramIndex}`);
            params.push(category);
            paramIndex++;
          }
          
          if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
          }
          
          sql += ` ORDER BY cr.rrf_score DESC`;

          // Execute optimized raw query
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

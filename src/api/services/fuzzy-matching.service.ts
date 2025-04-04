/**
 * Fuzzy Matching Service
 *
 * Provides advanced fuzzy matching capabilities for various entities in the system.
 * Implements phonetic matching, trigram similarity, and other fuzzy matching techniques.
 */

import { prisma } from '../../lib/prisma-optimized';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

// Types for fuzzy matching results
export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
}

export interface FuzzyMatchOptions {
  threshold?: number;
  limit?: number;
  includeScore?: boolean;
  fields?: string[];
}

export interface FullTextSearchOptions {
  limit?: number;
  offset?: number;
  filterCarrierId?: number;
  filterCategory?: string;
  includeHighlights?: boolean;
  minRank?: number;
}

export interface FullTextSearchResult<T> {
  item: T;
  rank: number;
  highlights?: string[];
}

export interface ProcedureSearchOptions {
  limit?: number;
  offset?: number;
  searchType?: 'exact' | 'prefix' | 'suffix' | 'contains' | 'fuzzy';
  category?: string;
  includeRequirements?: boolean;
  minScore?: number;
}

export interface ProcedureSearchResult {
  item: {
    id: number;
    procedureCode: string;
    description: string;
    category: string;
    requirements?: any[];
  };
  score?: number;
  matchType?: string;
}

export interface CombinedSearchOptions {
  limit?: number;
  includeCarriers?: boolean;
  includeProcedures?: boolean;
  includeGuidelines?: boolean;
  includeNetworks?: boolean;
  minScore?: number;
  filterCategory?: string;
}

export interface CombinedSearchResult {
  carriers: FuzzyMatchResult<any>[];
  procedures: ProcedureSearchResult[];
  guidelines: FullTextSearchResult<any>[];
  networks: FuzzyMatchResult<any>[];
  totalResults: number;
}

export class FuzzyMatchingService {
  // Default similarity threshold
  private static readonly DEFAULT_THRESHOLD = 0.3;

  // Default limit for results
  private static readonly DEFAULT_LIMIT = 10;

  /**
   * Find carriers by fuzzy name matching
   * Uses trigram similarity and phonetic matching for better results
   */
  static async findCarriersByFuzzyName(
    query: string,
    options: FuzzyMatchOptions = {}
  ): Promise<FuzzyMatchResult<any>[]> {
    const {
      threshold = this.DEFAULT_THRESHOLD,
      limit = this.DEFAULT_LIMIT
    } = options;

    try {
      // Use the database function for fuzzy carrier search
      const results = await prisma.$queryRaw<any[]>`
        SELECT
          c.id,
          c.carrier_name,
          similarity(c.carrier_name, ${query}) AS score
        FROM
          insurance_carriers c
        WHERE
          similarity(c.carrier_name, ${query}) > ${threshold}
        ORDER BY
          score DESC
        LIMIT ${limit}
      `;

      return results.map(result => ({
        item: {
          id: result.id,
          carrierName: result.carrier_name
        },
        score: result.score
      }));
    } catch (error) {
      logger.error('Error in fuzzy carrier search:', error);
      throw new Error(`Failed to perform fuzzy carrier search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find procedures by fuzzy code or description matching
   * This is the original method that uses similarity for fuzzy matching
   */
  static async findProceduresByFuzzyMatch(
    query: string,
    options: FuzzyMatchOptions = {}
  ): Promise<FuzzyMatchResult<any>[]> {
    const {
      threshold = this.DEFAULT_THRESHOLD,
      limit = this.DEFAULT_LIMIT
    } = options;

    try {
      // Search by procedure code or description
      const results = await prisma.$queryRaw<any[]>`
        SELECT
          p.id,
          p.procedure_code,
          p.description,
          p.category,
          GREATEST(
            similarity(p.procedure_code, ${query}),
            similarity(p.description, ${query})
          ) AS score
        FROM
          procedure p
        WHERE
          similarity(p.procedure_code, ${query}) > ${threshold}
          OR similarity(p.description, ${query}) > ${threshold}
        ORDER BY
          score DESC
        LIMIT ${limit}
      `;

      return results.map(result => ({
        item: {
          id: result.id,
          procedureCode: result.procedure_code,
          description: result.description,
          category: result.category
        },
        score: result.score
      }));
    } catch (error) {
      logger.error('Error in fuzzy procedure search:', error);
      throw new Error(`Failed to perform fuzzy procedure search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enhanced procedure code search with multiple search strategies
   * Supports exact, prefix, suffix, contains, and fuzzy matching
   */
  static async findProceduresByCode(
    codePattern: string,
    options: ProcedureSearchOptions = {}
  ): Promise<ProcedureSearchResult[]> {
    const {
      limit = this.DEFAULT_LIMIT,
      offset = 0,
      searchType = 'contains',
      category,
      includeRequirements = false,
      minScore = 0.3
    } = options;

    try {
      // Build the query based on the search type
      let whereClause;
      let orderByClause;
      let selectScoreExpr;
      let matchType;

      switch (searchType) {
        case 'exact':
          whereClause = Prisma.sql`p.procedure_code = ${codePattern}`;
          orderByClause = Prisma.sql`p.procedure_code ASC`;
          selectScoreExpr = Prisma.sql`1.0 AS score`;
          matchType = 'exact';
          break;

        case 'prefix':
          whereClause = Prisma.sql`p.procedure_code LIKE ${codePattern + '%'}`;
          orderByClause = Prisma.sql`p.procedure_code ASC`;
          selectScoreExpr = Prisma.sql`0.9 AS score`;
          matchType = 'prefix';
          break;

        case 'suffix':
          whereClause = Prisma.sql`p.procedure_code LIKE ${'%' + codePattern}`;
          orderByClause = Prisma.sql`p.procedure_code ASC`;
          selectScoreExpr = Prisma.sql`0.8 AS score`;
          matchType = 'suffix';
          break;

        case 'contains':
          whereClause = Prisma.sql`p.procedure_code LIKE ${'%' + codePattern + '%'}`;
          orderByClause = Prisma.sql`p.procedure_code ASC`;
          selectScoreExpr = Prisma.sql`0.7 AS score`;
          matchType = 'contains';
          break;

        case 'fuzzy':
        default:
          whereClause = Prisma.sql`similarity(p.procedure_code, ${codePattern}) > ${minScore}`;
          orderByClause = Prisma.sql`score DESC`;
          selectScoreExpr = Prisma.sql`similarity(p.procedure_code, ${codePattern}) AS score`;
          matchType = 'fuzzy';
          break;
      }

      // Add category filter if provided
      if (category) {
        whereClause = Prisma.sql`${whereClause} AND p.category = ${category}`;
      }

      // Build the base query
      let query = Prisma.sql`
        SELECT
          p.id,
          p.procedure_code,
          p.description,
          p.category,
          ${selectScoreExpr}
        FROM
          procedure p
        WHERE
          ${whereClause}
        ORDER BY
          ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Execute the query
      const procedures = await prisma.$queryRaw<any[]>(query);

      // If requirements are requested, fetch them for each procedure
      let proceduresWithRequirements = procedures;

      if (includeRequirements && procedures.length > 0) {
        // Get all procedure IDs
        const procedureIds = procedures.map(p => p.id);

        // Fetch requirements for all procedures in a single query
        const requirements = await prisma.procedureRequirement.findMany({
          where: {
            procedureId: {
              in: procedureIds.map(id => BigInt(id))
            }
          },
          include: {
            carrier: {
              select: {
                id: true,
                carrierName: true
              }
            }
          }
        });

        // Create a map of procedure ID to requirements
        const requirementsByProcedure = new Map();
        requirements.forEach(req => {
          const procId = Number(req.procedureId);
          if (!requirementsByProcedure.has(procId)) {
            requirementsByProcedure.set(procId, []);
          }
          requirementsByProcedure.get(procId).push({
            id: Number(req.id),
            requirementType: req.requirementType,
            description: req.description,
            carrierId: Number(req.carrierId),
            carrierName: req.carrier?.carrierName
          });
        });

        // Add requirements to each procedure
        proceduresWithRequirements = procedures.map(proc => ({
          ...proc,
          requirements: requirementsByProcedure.get(Number(proc.id)) || []
        }));
      }

      // Transform the results
      return proceduresWithRequirements.map(result => {
        const searchResult: ProcedureSearchResult = {
          item: {
            id: Number(result.id),
            procedureCode: result.procedure_code,
            description: result.description,
            category: result.category
          },
          matchType
        };

        // Add score if available
        if (result.score !== undefined) {
          searchResult.score = result.score;
        }

        // Add requirements if included
        if (includeRequirements && result.requirements) {
          searchResult.item.requirements = result.requirements;
        }

        return searchResult;
      });
    } catch (error) {
      logger.error('Error in procedure code search:', error);
      throw new Error(`Failed to perform procedure code search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find networks by fuzzy name matching
   */
  static async findNetworksByFuzzyName(
    query: string,
    options: FuzzyMatchOptions = {}
  ): Promise<FuzzyMatchResult<any>[]> {
    const {
      threshold = this.DEFAULT_THRESHOLD,
      limit = this.DEFAULT_LIMIT
    } = options;

    try {
      // Search by network name
      const results = await prisma.$queryRaw<any[]>`
        SELECT
          n.id,
          n.network_name,
          similarity(n.network_name, ${query}) AS score
        FROM
          insurance_networks n
        WHERE
          similarity(n.network_name, ${query}) > ${threshold}
        ORDER BY
          score DESC
        LIMIT ${limit}
      `;

      return results.map(result => ({
        item: {
          id: result.id,
          networkName: result.network_name
        },
        score: result.score
      }));
    } catch (error) {
      logger.error('Error in fuzzy network search:', error);
      throw new Error(`Failed to perform fuzzy network search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generic fuzzy search across multiple fields of a table
   */
  static async genericFuzzySearch<T>(
    tableName: string,
    query: string,
    fields: string[],
    options: FuzzyMatchOptions = {}
  ): Promise<FuzzyMatchResult<T>[]> {
    const {
      threshold = this.DEFAULT_THRESHOLD,
      limit = this.DEFAULT_LIMIT
    } = options;

    if (!fields.length) {
      throw new Error('At least one field must be specified for fuzzy search');
    }

    try {
      // Build dynamic SQL for multi-field fuzzy search
      const fieldSimilarities = fields.map(field =>
        `similarity("${field}", ${Prisma.sql`${query}`})`
      ).join(', ');

      const whereConditions = fields.map(field =>
        `similarity("${field}", ${Prisma.sql`${query}`}) > ${threshold}`
      ).join(' OR ');

      const sql = Prisma.sql`
        SELECT *, GREATEST(${Prisma.raw(fieldSimilarities)}) AS score
        FROM "${Prisma.raw(tableName)}"
        WHERE ${Prisma.raw(whereConditions)}
        ORDER BY score DESC
        LIMIT ${limit}
      `;

      const results = await prisma.$queryRaw<(T & { score: number })[]>(sql);

      return results.map(result => {
        const { score, ...item } = result;
        return { item: item as T, score };
      });
    } catch (error) {
      logger.error(`Error in generic fuzzy search for table ${tableName}:`, error);
      throw new Error(`Failed to perform generic fuzzy search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Full-text search for guidelines using PostgreSQL's full-text search capabilities
   * Uses ts_rank for ranking results and ts_headline for generating highlights
   */
  static async fullTextSearch(
    query: string,
    options: FullTextSearchOptions = {}
  ): Promise<FullTextSearchResult<any>[]> {
    const {
      limit = this.DEFAULT_LIMIT,
      offset = 0,
      filterCarrierId,
      filterCategory,
      includeHighlights = true,
      minRank = 0.01
    } = options;

    try {
      // Prepare the search query for PostgreSQL full-text search
      // Convert the query to a tsquery format
      const tsQuery = query
        .replace(/\s+/g, ' & ')
        .trim()
        .replace(/[\\\/'":;,\.\[\]\{\}\(\)\|\-\+\*\&\^\%\$\#\@\!\~\`]/g, ' ')
        .replace(/\s+/g, ' & ');

      // Build the SQL query with proper parameterization
      let sql = Prisma.sql`
        SELECT
          g.id,
          g.title,
          g.content,
          g.category,
          g.carrier_id,
          c.carrier_name,
          ts_rank(to_tsvector('english', g.title || ' ' || g.content), to_tsquery('english', ${tsQuery})) AS rank
      `;

      // Add highlights if requested
      if (includeHighlights) {
        sql = Prisma.sql`
          ${sql},
          ts_headline('english', g.content, to_tsquery('english', ${tsQuery}), 'MaxFragments=3, MinWords=5, MaxWords=20, FragmentDelimiter="..."') AS content_highlights,
          ts_headline('english', g.title, to_tsquery('english', ${tsQuery}), 'MaxFragments=1, MinWords=1, MaxWords=10') AS title_highlights
        `;
      }

      // Add FROM clause
      sql = Prisma.sql`
        ${sql}
        FROM guidelines g
        JOIN insurance_carriers c ON g.carrier_id = c.id
        WHERE to_tsvector('english', g.title || ' ' || g.content) @@ to_tsquery('english', ${tsQuery})
      `;

      // Add filters if provided
      if (filterCarrierId) {
        sql = Prisma.sql`
          ${sql} AND g.carrier_id = ${BigInt(filterCarrierId)}
        `;
      }

      if (filterCategory) {
        sql = Prisma.sql`
          ${sql} AND g.category = ${filterCategory}
        `;
      }

      // Add minimum rank filter
      sql = Prisma.sql`
        ${sql} AND ts_rank(to_tsvector('english', g.title || ' ' || g.content), to_tsquery('english', ${tsQuery})) > ${minRank}
      `;

      // Add ORDER BY and LIMIT clauses
      sql = Prisma.sql`
        ${sql}
        ORDER BY rank DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Execute the query
      const results = await prisma.$queryRaw<any[]>(sql);

      // Transform the results
      return results.map(result => {
        const item = {
          id: Number(result.id),
          title: result.title,
          content: result.content,
          category: result.category,
          carrierId: Number(result.carrier_id),
          carrierName: result.carrier_name
        };

        const searchResult: FullTextSearchResult<any> = {
          item,
          rank: result.rank
        };

        // Add highlights if included
        if (includeHighlights) {
          searchResult.highlights = [
            result.title_highlights,
            result.content_highlights
          ].filter(Boolean);
        }

        return searchResult;
      });
    } catch (error) {
      logger.error('Error in full-text search:', error);
      throw new Error(`Failed to perform full-text search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Combined search across multiple entities (carriers, procedures, guidelines, networks)
   * Performs parallel searches and combines the results
   */
  static async combinedSearch(
    query: string,
    options: CombinedSearchOptions = {}
  ): Promise<CombinedSearchResult> {
    const {
      limit = 5,
      includeCarriers = true,
      includeProcedures = true,
      includeGuidelines = true,
      includeNetworks = true,
      minScore = 0.3,
      filterCategory
    } = options;

    try {
      // Initialize result containers
      let carriers: FuzzyMatchResult<any>[] = [];
      let procedures: ProcedureSearchResult[] = [];
      let guidelines: FullTextSearchResult<any>[] = [];
      let networks: FuzzyMatchResult<any>[] = [];

      // Create an array of promises for parallel execution
      const searchPromises: Promise<void>[] = [];

      // Carrier search
      if (includeCarriers) {
        const carrierPromise = this.findCarriersByFuzzyName(query, {
          limit,
          threshold: minScore
        })
          .then(results => {
            carriers = results;
          });
        searchPromises.push(carrierPromise);
      }

      // Procedure search
      if (includeProcedures) {
        // First try exact/contains search for procedure codes
        const procedureOptions: ProcedureSearchOptions = {
          limit,
          searchType: query.match(/^[A-Za-z0-9]+$/) ? 'contains' : 'fuzzy',
          minScore,
          category: filterCategory
        };

        const procedurePromise = this.findProceduresByCode(query, procedureOptions)
          .then(results => {
            procedures = results;
          });
        searchPromises.push(procedurePromise);
      }

      // Guidelines search
      if (includeGuidelines) {
        const guidelineOptions: FullTextSearchOptions = {
          limit,
          filterCategory,
          minRank: minScore,
          includeHighlights: true
        };

        const guidelinePromise = this.fullTextSearch(query, guidelineOptions)
          .then(results => {
            guidelines = results;
          });
        searchPromises.push(guidelinePromise);
      }

      // Network search
      if (includeNetworks) {
        const networkPromise = this.findNetworksByFuzzyName(query, {
          limit,
          threshold: minScore
        })
          .then(results => {
            networks = results;
          });
        searchPromises.push(networkPromise);
      }

      // Wait for all searches to complete
      await Promise.all(searchPromises);

      // Calculate total results
      const totalResults = carriers.length + procedures.length + guidelines.length + networks.length;

      // Return combined results
      return {
        carriers,
        procedures,
        guidelines,
        networks,
        totalResults
      };
    } catch (error) {
      logger.error('Error in combined search:', error);
      throw new Error(`Failed to perform combined search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

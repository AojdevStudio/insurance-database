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
}

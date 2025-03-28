/**
 * Prisma-based implementation of GuidelinesController
 * Uses the PrismaGuidelineService for database operations
 */

import type { Response } from 'express';
import { PrismaGuidelineService } from '../../services/prisma/guidelines.service.js';
import type { IGuidelineSearchRequest } from '../../types/guidelines.js';

export class PrismaGuidelinesController {
  /**
   * Helper to format dates consistently
   */
  private static formatDate(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString();
    }
    return date;
  }

  /**
   * Search guidelines with pagination and filtering
   */
  static async searchGuidelines(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      const result = await PrismaGuidelineService.searchGuidelines(req.query);
      
      res.json({
        ...result,
        guidelines: result.guidelines.map(guideline => ({
          ...guideline,
          created_at: PrismaGuidelinesController.formatDate(guideline.created_at)
        }))
      });
    } catch (error) {
      console.error('Error searching guidelines:', error);
      res.status(500).json({ error: 'Failed to search guidelines' });
    }
  }

  /**
   * Semantic search using vector embeddings
   */
  static async semanticSearch(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      if (!req.query.query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const result = await PrismaGuidelineService.semanticSearch(req.query);
      
      res.json({
        ...result,
        guidelines: result.guidelines.map(guideline => ({
          ...guideline,
          created_at: PrismaGuidelinesController.formatDate(guideline.created_at)
        }))
      });
    } catch (error) {
      console.error('Error performing semantic search:', error);
      res.status(500).json({ error: 'Failed to perform semantic search' });
    }
  }

  /**
   * Text-based search using PostgreSQL text similarity
   */
  static async textSearch(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      if (!req.query.query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const result = await PrismaGuidelineService.textSearch(req.query);
      
      res.json({
        ...result,
        guidelines: result.guidelines.map(guideline => ({
          ...guideline,
          created_at: PrismaGuidelinesController.formatDate(guideline.created_at)
        }))
      });
    } catch (error) {
      console.error('Error performing text search:', error);
      res.status(500).json({ error: 'Failed to perform text search' });
    }
  }

  /**
   * Hybrid search combining vector and text similarity
   */
  static async hybridSearch(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      if (!req.query.query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const result = await PrismaGuidelineService.hybridSearch(req.query);
      
      res.json({
        ...result,
        guidelines: result.guidelines.map(guideline => ({
          ...guideline,
          created_at: PrismaGuidelinesController.formatDate(guideline.created_at)
        }))
      });
    } catch (error) {
      console.error('Error performing hybrid search:', error);
      res.status(500).json({ error: 'Failed to perform hybrid search' });
    }
  }

  /**
   * RRF-based hybrid search
   */
  static async rrfHybridSearch(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      if (!req.query.query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const result = await PrismaGuidelineService.rrf_hybridSearch(req.query);
      
      res.json({
        ...result,
        guidelines: result.guidelines.map(guideline => ({
          ...guideline,
          created_at: PrismaGuidelinesController.formatDate(guideline.created_at)
        }))
      });
    } catch (error) {
      console.error('Error performing RRF hybrid search:', error);
      res.status(500).json({ error: 'Failed to perform RRF hybrid search' });
    }
  }

  /**
   * Unified search interface
   */
  static async search(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      if (!req.query.query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const result = await PrismaGuidelineService.search(req.query);
      
      res.json({
        ...result,
        guidelines: result.guidelines.map(guideline => ({
          ...guideline,
          created_at: PrismaGuidelinesController.formatDate(guideline.created_at)
        }))
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid search type:')) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('Error performing search:', error);
      res.status(500).json({ error: 'Failed to perform search' });
    }
  }
}

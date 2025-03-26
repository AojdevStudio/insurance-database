import type { Response } from 'express';
import { GuidelineService } from '../services/guidelines.service.js';
import type { IGuidelineSearchRequest } from '../types/guidelines.js';
import { logger } from '../utils/logger.js';

export class GuidelineController {
  static async searchGuidelines(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      const result = await GuidelineService.searchGuidelines(req.query);
      res.json(result);
    } catch (error) {
      logger.error('Error searching guidelines:', error instanceof Error ? error : new Error('Unknown error'));
      res.status(500).json({ error: 'Failed to search guidelines' });
    }
  }

  static async semanticSearch(req: IGuidelineSearchRequest, res: Response): Promise<void> {
    try {
      const result = await GuidelineService.semanticSearch(req.query);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Query is required for semantic search') {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error('Error performing semantic search:', error instanceof Error ? error : new Error('Unknown error'));
      res.status(500).json({ error: 'Failed to perform semantic search' });
    }
  }
} 
/**
 * Fuzzy Search Controller
 *
 * Provides API endpoints for fuzzy matching and hierarchical data queries
 */

import { Request, Response } from 'express';
import { FuzzyMatchingService } from '../services/fuzzy-matching.service';
import { HierarchyService } from '../services/hierarchy.service';
import { logger } from '../utils/logger';

export class FuzzySearchController {
  /**
   * Find carriers by fuzzy name matching
   */
  static async findCarriersByFuzzyName(req: Request, res: Response): Promise<void> {
    try {
      const { query, threshold, limit } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const options = {
        threshold: threshold ? Number(threshold) : undefined,
        limit: limit ? Number(limit) : undefined
      };

      const results = await FuzzyMatchingService.findCarriersByFuzzyName(query, options);

      res.json({
        success: true,
        results,
        count: results.length
      });
    } catch (error) {
      logger.error('Error in findCarriersByFuzzyName:', error);
      res.status(500).json({
        error: 'Failed to perform fuzzy carrier search',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Find procedures by fuzzy code or description matching
   */
  static async findProceduresByFuzzyMatch(req: Request, res: Response): Promise<void> {
    try {
      const { query, threshold, limit } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const options = {
        threshold: threshold ? Number(threshold) : undefined,
        limit: limit ? Number(limit) : undefined
      };

      const results = await FuzzyMatchingService.findProceduresByFuzzyMatch(query, options);

      res.json({
        success: true,
        results,
        count: results.length
      });
    } catch (error) {
      logger.error('Error in findProceduresByFuzzyMatch:', error);
      res.status(500).json({
        error: 'Failed to perform fuzzy procedure search',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Find networks by fuzzy name matching
   */
  static async findNetworksByFuzzyName(req: Request, res: Response): Promise<void> {
    try {
      const { query, threshold, limit } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const options = {
        threshold: threshold ? Number(threshold) : undefined,
        limit: limit ? Number(limit) : undefined
      };

      const results = await FuzzyMatchingService.findNetworksByFuzzyName(query, options);

      res.json({
        success: true,
        results,
        count: results.length
      });
    } catch (error) {
      logger.error('Error in findNetworksByFuzzyName:', error);
      res.status(500).json({
        error: 'Failed to perform fuzzy network search',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get the complete network-carrier-plan hierarchy
   */
  static async getCompleteHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const {
        includeCarriers,
        includePlans,
        filterNetworkIds,
        filterCarrierIds,
        limit
      } = req.query;

      const options = {
        includeCarriers: includeCarriers === 'true',
        includePlans: includePlans === 'true',
        filterNetworkIds: filterNetworkIds ? String(filterNetworkIds).split(',').map(Number) : undefined,
        filterCarrierIds: filterCarrierIds ? String(filterCarrierIds).split(',').map(Number) : undefined,
        limit: limit ? Number(limit) : undefined
      };

      const hierarchy = await HierarchyService.getCompleteHierarchy(options);

      res.json({
        success: true,
        hierarchy,
        count: hierarchy.length
      });
    } catch (error) {
      logger.error('Error in getCompleteHierarchy:', error);
      res.status(500).json({
        error: 'Failed to fetch hierarchy',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Find carriers by fuzzy name match and include their network relationships
   */
  static async findCarriersByFuzzyNameWithNetworks(req: Request, res: Response): Promise<void> {
    try {
      const { query, threshold, limit } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const results = await HierarchyService.findCarriersByFuzzyNameWithNetworks(
        query,
        threshold ? Number(threshold) : undefined,
        limit ? Number(limit) : undefined
      );

      res.json({
        success: true,
        results,
        count: results.length
      });
    } catch (error) {
      logger.error('Error in findCarriersByFuzzyNameWithNetworks:', error);
      res.status(500).json({
        error: 'Failed to perform fuzzy carrier search with networks',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if a carrier belongs to a specific network
   */
  static async isCarrierInNetwork(req: Request, res: Response): Promise<void> {
    try {
      const { carrierId, networkId } = req.params;

      if (!carrierId || !networkId) {
        res.status(400).json({ error: 'Both carrierId and networkId parameters are required' });
        return;
      }

      const result = await HierarchyService.isCarrierInNetwork(
        Number(carrierId),
        Number(networkId)
      );

      res.json({
        success: true,
        isInNetwork: result
      });
    } catch (error) {
      logger.error('Error in isCarrierInNetwork:', error);
      res.status(500).json({
        error: 'Failed to check carrier network membership',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Perform full-text search on guidelines
   */
  static async fullTextSearch(req: Request, res: Response): Promise<void> {
    try {
      const {
        query,
        limit,
        offset,
        carrierId,
        category,
        includeHighlights,
        minRank
      } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const options = {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        filterCarrierId: carrierId ? Number(carrierId) : undefined,
        filterCategory: category ? String(category) : undefined,
        includeHighlights: includeHighlights === 'true',
        minRank: minRank ? Number(minRank) : undefined
      };

      const results = await FuzzyMatchingService.fullTextSearch(query, options);

      res.json({
        success: true,
        results,
        count: results.length
      });
    } catch (error) {
      logger.error('Error in fullTextSearch:', error);
      res.status(500).json({
        error: 'Failed to perform full-text search',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

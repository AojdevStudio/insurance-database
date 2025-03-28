/**
 * Prisma-based implementation of CarrierController
 * Uses the PrismaCarrierService for database operations
 */

import type { Response } from 'express';
import { PrismaCarrierService } from '../../services/prisma/carrier.service.js';
import type { ICarrierSearchRequest, ICarrierDetailRequest } from '../../types/carrier.js';

export class PrismaCarrierController {
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
   * Get paginated list of carriers
   */
  static async listCarriers(req: ICarrierSearchRequest, res: Response): Promise<void> {
    try {
      const result = await PrismaCarrierService.listCarriers(req.query);
      
      res.json({
        ...result,
        carriers: result.carriers.map(carrier => ({
          ...carrier,
          created_at: PrismaCarrierController.formatDate(carrier.created_at)
        }))
      });
    } catch (error) {
      console.error('Error listing carriers:', error);
      res.status(500).json({ error: 'Failed to list carriers' });
    }
  }

  /**
   * Search carriers by name
   */
  static async searchCarriers(req: ICarrierSearchRequest, res: Response): Promise<void> {
    try {
      const result = await PrismaCarrierService.searchCarriers(req.query);
      
      res.json({
        ...result,
        carriers: result.carriers.map(carrier => ({
          ...carrier,
          created_at: PrismaCarrierController.formatDate(carrier.created_at)
        }))
      });
    } catch (error) {
      console.error('Error searching carriers:', error);
      res.status(500).json({ error: 'Failed to search carriers' });
    }
  }

  /**
   * Get a single carrier by ID
   */
  static async getCarrierById(req: ICarrierDetailRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid carrier ID' });
        return;
      }

      const carrier = await PrismaCarrierService.getCarrierById(id);
      
      res.json({
        ...carrier,
        created_at: PrismaCarrierController.formatDate(carrier.created_at)
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Carrier not found') {
        res.status(404).json({ error: 'Carrier not found' });
        return;
      }
      console.error('Error getting carrier:', error);
      res.status(500).json({ error: 'Failed to get carrier' });
    }
  }
}

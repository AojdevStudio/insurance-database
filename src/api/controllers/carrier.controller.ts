import type { Response } from 'express';
import { CarrierService } from '../services/carrier.service.js';
import type { ICarrierSearchRequest, ICarrierDetailRequest } from '../types/carrier.js';

export class CarrierController {
  private static formatDate(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString();
    }
    return date;
  }

  static async listCarriers(req: ICarrierSearchRequest, res: Response): Promise<void> {
    try {
      const result = await CarrierService.listCarriers(req.query);
      
      res.json({
        ...result,
        carriers: result.carriers.map(carrier => ({
          ...carrier,
          created_at: CarrierController.formatDate(carrier.created_at)
        }))
      });
    } catch (error) {
      console.error('Error listing carriers:', error);
      res.status(500).json({ error: 'Failed to list carriers' });
    }
  }

  static async searchCarriers(req: ICarrierSearchRequest, res: Response): Promise<void> {
    try {
      const result = await CarrierService.searchCarriers(req.query);
      
      res.json({
        ...result,
        carriers: result.carriers.map(carrier => ({
          ...carrier,
          created_at: CarrierController.formatDate(carrier.created_at)
        }))
      });
    } catch (error) {
      console.error('Error searching carriers:', error);
      res.status(500).json({ error: 'Failed to search carriers' });
    }
  }

  static async getCarrierById(req: ICarrierDetailRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid carrier ID' });
        return;
      }

      const carrier = await CarrierService.getCarrierById(id);
      
      res.json({
        ...carrier,
        created_at: CarrierController.formatDate(carrier.created_at)
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
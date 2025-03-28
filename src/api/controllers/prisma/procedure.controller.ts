/**
 * Prisma-based implementation of ProcedureController
 * Uses the PrismaProcedureService for database operations
 */

import type { Response } from 'express';
import { PrismaProcedureService } from '../../services/prisma/procedure.service.js';
import type { IProcedureSearchRequest, IProcedureDetailRequest, IProcedureRequirementsRequest } from '../../types/procedure.js';

export class PrismaProcedureController {
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
   * Get paginated list of procedures
   */
  static async listProcedures(req: IProcedureSearchRequest, res: Response): Promise<void> {
    try {
      const result = await PrismaProcedureService.listProcedures(req.query);
      
      res.json({
        ...result,
        procedures: result.procedures.map(procedure => ({
          ...procedure,
          created_at: PrismaProcedureController.formatDate(procedure.created_at)
        }))
      });
    } catch (error) {
      console.error('Error listing procedures:', error);
      res.status(500).json({ error: 'Failed to list procedures' });
    }
  }

  /**
   * Search procedures by code or description
   */
  static async searchProcedures(req: IProcedureSearchRequest, res: Response): Promise<void> {
    try {
      const result = await PrismaProcedureService.searchProcedures(req.query);
      
      res.json({
        ...result,
        procedures: result.procedures.map(procedure => ({
          ...procedure,
          created_at: PrismaProcedureController.formatDate(procedure.created_at)
        }))
      });
    } catch (error) {
      console.error('Error searching procedures:', error);
      res.status(500).json({ error: 'Failed to search procedures' });
    }
  }

  /**
   * Get a single procedure by code
   */
  static async getProcedureByCode(req: IProcedureDetailRequest, res: Response): Promise<void> {
    try {
      const code = req.params.code;
      if (!code) {
        res.status(400).json({ error: 'Procedure code is required' });
        return;
      }

      const procedure = await PrismaProcedureService.getProcedureByCode(code);
      
      res.json({
        ...procedure,
        created_at: PrismaProcedureController.formatDate(procedure.created_at),
        carrier_requirements: procedure.carrier_requirements.map(req => ({
          ...req,
          created_at: PrismaProcedureController.formatDate(req.created_at)
        })),
        documentation_requirements: procedure.documentation_requirements.map(req => ({
          ...req,
          created_at: PrismaProcedureController.formatDate(req.created_at)
        }))
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Procedure not found') {
        res.status(404).json({ error: 'Procedure not found' });
        return;
      }
      console.error('Error getting procedure:', error);
      res.status(500).json({ error: 'Failed to get procedure' });
    }
  }

  /**
   * Get procedure requirements
   */
  static async getProcedureRequirements(req: IProcedureRequirementsRequest, res: Response): Promise<void> {
    try {
      const code = req.params.code;
      const carrierId = req.query.carrier_id ? parseInt(req.query.carrier_id as string, 10) : undefined;
      
      if (!code) {
        res.status(400).json({ error: 'Procedure code is required' });
        return;
      }

      if (req.query.carrier_id && isNaN(carrierId as number)) {
        res.status(400).json({ error: 'Invalid carrier ID' });
        return;
      }

      const requirements = await PrismaProcedureService.getProcedureRequirements(code, carrierId);
      
      res.json(requirements);
    } catch (error) {
      if (error instanceof Error && error.message === 'No requirements found for procedure') {
        res.status(404).json({ error: 'No requirements found for procedure' });
        return;
      }
      console.error('Error getting procedure requirements:', error);
      res.status(500).json({ error: 'Failed to get procedure requirements' });
    }
  }
}

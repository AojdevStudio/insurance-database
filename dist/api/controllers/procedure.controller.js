import { ProcedureService } from '../services/procedure.service.js';
import { ProcedureSearchQuerySchema, ProcedureCodeSchema } from '../types/procedure.js';
import { Logger } from '../../utils/logging.js';
const logger = new Logger('procedure-controller');
export class ProcedureController {
    static async listProcedures(req, res) {
        try {
            const validatedQuery = ProcedureSearchQuerySchema.parse(req.query);
            const result = await ProcedureService.listProcedures(validatedQuery);
            res.json({
                ...result,
                procedures: result.procedures.map(proc => ({
                    ...proc,
                    created_at: proc.created_at.toISOString()
                }))
            });
        }
        catch (error) {
            logger.error('Error listing procedures:', error instanceof Error ? error : new Error('Unknown error'));
            res.status(500).json({ error: 'Failed to list procedures' });
        }
    }
    static async searchProcedures(req, res) {
        try {
            const validatedQuery = ProcedureSearchQuerySchema.parse(req.query);
            const result = await ProcedureService.searchProcedures(validatedQuery);
            res.json({
                ...result,
                procedures: result.procedures.map(proc => ({
                    ...proc,
                    created_at: proc.created_at.toISOString()
                }))
            });
        }
        catch (error) {
            logger.error('Error searching procedures:', error instanceof Error ? error : new Error('Unknown error'));
            res.status(500).json({ error: 'Failed to search procedures' });
        }
    }
    static async getProcedureByCode(req, res) {
        try {
            const { code } = ProcedureCodeSchema.parse(req.params);
            const procedure = await ProcedureService.getProcedureByCode(code);
            res.json({
                ...procedure,
                created_at: procedure.created_at.toISOString(),
                carrier_requirements: procedure.carrier_requirements?.map(req => ({
                    ...req,
                    created_at: req.created_at.toISOString()
                })),
                documentation_requirements: procedure.documentation_requirements?.map(req => ({
                    ...req,
                    created_at: req.created_at.toISOString()
                }))
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Procedure not found') {
                res.status(404).json({ error: 'Procedure not found' });
                return;
            }
            logger.error('Error getting procedure:', error instanceof Error ? error : new Error('Unknown error'));
            res.status(500).json({ error: 'Failed to get procedure' });
        }
    }
    static async getProcedureRequirements(req, res) {
        try {
            const { code } = ProcedureCodeSchema.parse(req.params);
            const carrierId = req.query.carrier_id ? parseInt(req.query.carrier_id, 10) : undefined;
            const requirements = await ProcedureService.getProcedureRequirements(code, carrierId);
            res.json(requirements);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'No requirements found for procedure') {
                res.status(404).json({ error: 'No requirements found for procedure' });
                return;
            }
            logger.error('Error getting procedure requirements:', error instanceof Error ? error : new Error('Unknown error'));
            res.status(500).json({ error: 'Failed to get procedure requirements' });
        }
    }
}
//# sourceMappingURL=procedure.controller.js.map
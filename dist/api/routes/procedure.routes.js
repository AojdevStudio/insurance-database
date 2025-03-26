import { Router } from 'express';
import { ProcedureController } from '../controllers/procedure.controller.js';
import { validateRequest } from '../middleware/validation.js';
import { ProcedureSearchQuerySchema, ProcedureCodeSchema } from '../types/procedure.js';
const router = Router();
router.get('/', validateRequest({ query: ProcedureSearchQuerySchema }), ProcedureController.listProcedures);
router.get('/search', validateRequest({ query: ProcedureSearchQuerySchema }), ProcedureController.searchProcedures);
router.get('/:code', validateRequest({ params: ProcedureCodeSchema }), ProcedureController.getProcedureByCode);
router.get('/:code/requirements', validateRequest({ params: ProcedureCodeSchema }), ProcedureController.getProcedureRequirements);
export default router;
//# sourceMappingURL=procedure.routes.js.map
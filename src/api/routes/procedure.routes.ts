import { Router } from 'express';
import { ProcedureController } from '../controllers/procedure.controller.js';
import { validateRequest } from '../middleware/validation.js';
import { ProcedureSearchQuerySchema, ProcedureCodeSchema } from '../types/procedure.js';

const router = Router();

// GET /api/procedures - List procedures with optional filtering
router.get('/',
  validateRequest({ query: ProcedureSearchQuerySchema }),
  ProcedureController.listProcedures
);

// GET /api/procedures/search - Search procedures
router.get('/search',
  validateRequest({ query: ProcedureSearchQuerySchema }),
  ProcedureController.searchProcedures
);

// GET /api/procedures/:code - Get procedure details by code
router.get('/:code',
  validateRequest({ params: ProcedureCodeSchema }),
  ProcedureController.getProcedureByCode
);

// GET /api/procedures/:code/requirements - Get procedure requirements
router.get('/:code/requirements',
  validateRequest({ params: ProcedureCodeSchema }),
  ProcedureController.getProcedureRequirements
);

export default router; 
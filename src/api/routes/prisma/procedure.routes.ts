/**
 * Prisma-based routes for procedures
 * Test routes for the Prisma implementation of the procedure API
 */

import { Router } from 'express';
import { PrismaProcedureController } from '../../controllers/prisma/procedure.controller.js';
import { validateProcedureSearch, validateProcedureCode } from '../../middleware/procedure.validation.js';

const router = Router();

// GET /api/prisma/procedures - List all procedures
router.get('/', validateProcedureSearch, PrismaProcedureController.listProcedures);

// GET /api/prisma/procedures/search - Search procedures
router.get('/search', validateProcedureSearch, PrismaProcedureController.searchProcedures);

// GET /api/prisma/procedures/:code - Get procedure by code
router.get('/:code', validateProcedureCode, PrismaProcedureController.getProcedureByCode);

// GET /api/prisma/procedures/:code/requirements - Get procedure requirements
router.get('/:code/requirements', validateProcedureCode, PrismaProcedureController.getProcedureRequirements);

export default router;

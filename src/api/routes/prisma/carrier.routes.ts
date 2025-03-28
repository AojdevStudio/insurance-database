/**
 * Prisma-based routes for carriers
 * Test routes for the Prisma implementation of the carrier API
 */

import { Router } from 'express';
import { PrismaCarrierController } from '../../controllers/prisma/carrier.controller.js';
import { validateCarrierSearch, validateCarrierId } from '../../middleware/carrier.validation.js';

const router = Router();

// GET /api/prisma/carriers - List all carriers
router.get('/', validateCarrierSearch, PrismaCarrierController.listCarriers);

// GET /api/prisma/carriers/search - Search carriers
router.get('/search', validateCarrierSearch, PrismaCarrierController.searchCarriers);

// GET /api/prisma/carriers/:id - Get carrier by ID
router.get('/:id', validateCarrierId, PrismaCarrierController.getCarrierById);

export default router;

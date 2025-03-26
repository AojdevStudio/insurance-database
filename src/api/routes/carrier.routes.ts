import { Router } from 'express';
import { CarrierController } from '../controllers/carrier.controller.js';
import { validateCarrierSearch, validateCarrierId } from '../middleware/carrier.validation.js';

const router = Router();

// GET /api/carriers - List all carriers
router.get('/', validateCarrierSearch, CarrierController.listCarriers);

// GET /api/carriers/search - Search carriers
router.get('/search', validateCarrierSearch, CarrierController.searchCarriers);

// GET /api/carriers/:id - Get carrier by ID
router.get('/:id', validateCarrierId, CarrierController.getCarrierById);

export default router; 
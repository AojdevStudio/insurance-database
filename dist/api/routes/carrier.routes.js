import { Router } from 'express';
import { CarrierController } from '../controllers/carrier.controller.js';
import { validateCarrierSearch, validateCarrierId } from '../middleware/carrier.validation.js';
const router = Router();
router.get('/', validateCarrierSearch, CarrierController.listCarriers);
router.get('/search', validateCarrierSearch, CarrierController.searchCarriers);
router.get('/:id', validateCarrierId, CarrierController.getCarrierById);
export default router;
//# sourceMappingURL=carrier.routes.js.map
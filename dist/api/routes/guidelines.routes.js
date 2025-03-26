import { Router } from 'express';
import { GuidelineController } from '../controllers/guidelines.controller.js';
import { validateRequest } from '../middleware/validation.js';
import { GuidelineSearchQuerySchema, GuidelineSemanticSearchSchema } from '../types/guidelines.js';
import rateLimit from 'express-rate-limit';
const router = Router();
const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many search requests, please try again later' }
});
const semanticSearchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many semantic search requests, please try again later' }
});
router.get('/search', searchLimiter, validateRequest({ query: GuidelineSearchQuerySchema }), GuidelineController.searchGuidelines);
router.get('/semantic-search', semanticSearchLimiter, validateRequest({ query: GuidelineSemanticSearchSchema }), GuidelineController.semanticSearch);
export default router;
//# sourceMappingURL=guidelines.routes.js.map
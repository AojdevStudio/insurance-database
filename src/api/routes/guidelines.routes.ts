import { Router } from 'express';
import { GuidelineController } from '../controllers/guidelines.controller.js';
import { validateRequest } from '../middleware/validation.js';
import { GuidelineSearchQuerySchema, GuidelineSemanticSearchSchema } from '../types/guidelines.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Configure rate limiters
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many search requests, please try again later' }
});

const semanticSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: { error: 'Too many semantic search requests, please try again later' }
});

// GET /api/guidelines/search - Search guidelines
router.get('/search',
  searchLimiter,
  validateRequest({ query: GuidelineSearchQuerySchema }),
  GuidelineController.searchGuidelines
);

// GET /api/guidelines/semantic-search - Semantic search guidelines
router.get('/semantic-search',
  semanticSearchLimiter,
  validateRequest({ query: GuidelineSemanticSearchSchema }),
  GuidelineController.semanticSearch
);

export default router; 
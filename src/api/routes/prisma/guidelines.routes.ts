/**
 * Prisma-based routes for guidelines
 * Test routes for the Prisma implementation of the guidelines API
 */

import { Router } from 'express';
import { PrismaGuidelinesController } from '../../controllers/prisma/guidelines.controller.js';
import { validateGuidelineSearch } from '../../middleware/guidelines.validation.js';

const router = Router();

// GET /api/prisma/guidelines - List/search all guidelines
router.get('/', validateGuidelineSearch, PrismaGuidelinesController.searchGuidelines);

// GET /api/prisma/guidelines/search - Unified search endpoint
router.get('/search', validateGuidelineSearch, PrismaGuidelinesController.search);

// GET /api/prisma/guidelines/semantic - Semantic search
router.get('/semantic', validateGuidelineSearch, PrismaGuidelinesController.semanticSearch);

// GET /api/prisma/guidelines/text - Text-based search
router.get('/text', validateGuidelineSearch, PrismaGuidelinesController.textSearch);

// GET /api/prisma/guidelines/hybrid - Hybrid search
router.get('/hybrid', validateGuidelineSearch, PrismaGuidelinesController.hybridSearch);

// GET /api/prisma/guidelines/rrf - Reciprocal Rank Fusion hybrid search
router.get('/rrf', validateGuidelineSearch, PrismaGuidelinesController.rrfHybridSearch);

export default router;

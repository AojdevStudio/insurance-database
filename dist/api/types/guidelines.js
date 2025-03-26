import { z } from 'zod';
export const GuidelineSearchQuerySchema = z.object({
    query: z.string().optional(),
    carrier_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    category: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    min_similarity: z.string().regex(/^\d*\.?\d+$/).transform(Number).optional(),
});
export const GuidelineSemanticSearchSchema = z.object({
    query: z.string().min(1, 'Search query is required'),
    carrier_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    category: z.string().optional(),
    min_similarity: z.string().regex(/^\d*\.?\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});
//# sourceMappingURL=guidelines.js.map
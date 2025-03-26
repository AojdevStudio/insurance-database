import { z } from 'zod';
export const ProcedureSearchQuerySchema = z.object({
    query: z.string().optional(),
    category: z.string().optional(),
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(10),
    sort_by: z.enum(['code', 'description', 'category', 'created_at']).optional().default('code'),
    sort_order: z.enum(['asc', 'desc']).optional().default('asc')
});
export const ProcedureCodeSchema = z.object({
    code: z.string().regex(/^[A-Z0-9]{5}$/, 'Invalid procedure code format')
});
//# sourceMappingURL=procedure.js.map
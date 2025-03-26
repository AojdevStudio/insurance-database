import { z } from 'zod';
export const CarrierJSONSchema = z.object({
    carrier_name: z.string().min(1).max(100),
    carrier_type: z.enum(['National', 'Medicare Advantage', 'TPA', 'Other']),
    payer_id: z.string().nullable(),
    claims_address: z.string().nullable(),
    phone_number: z.string().nullable(),
    networks: z.array(z.object({
        network_name: z.string().min(1).max(100),
        plan_type: z.enum(['PPO', 'HMO', 'EPO']),
        effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    })),
    procedures: z.array(z.object({
        code: z.string(),
        description: z.string(),
        requirements: z.array(z.string())
    })).optional(),
    guidelines: z.array(z.object({
        title: z.string(),
        content: z.string(),
        effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    })).optional(),
    appeal_procedures: z.object({
        first_level: z.string(),
        second_level: z.string().optional(),
        external_review: z.string().optional()
    }).optional()
});
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
//# sourceMappingURL=carrier.js.map
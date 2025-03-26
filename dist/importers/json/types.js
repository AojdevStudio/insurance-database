import { z } from 'zod';
export const InsuranceRecordSchema = z.object({
    id: z.string().uuid().optional(),
    carrier: z.string(),
    policy_type: z.string(),
    coverage_limits: z.number().positive(),
    premium: z.number().positive(),
    effective_date: z.string().datetime(),
    expiration_date: z.string().datetime(),
    status: z.enum(['active', 'expired', 'cancelled', 'pending']),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export const DEFAULT_CONFIG = {
    batchSize: 100,
    maxMemoryMB: 100,
    progressInterval: 100,
};
export var ImportErrorType;
(function (ImportErrorType) {
    ImportErrorType["VALIDATION"] = "validation";
    ImportErrorType["PARSING"] = "parsing";
    ImportErrorType["MEMORY"] = "memory";
    ImportErrorType["IO"] = "io";
})(ImportErrorType || (ImportErrorType = {}));
//# sourceMappingURL=types.js.map
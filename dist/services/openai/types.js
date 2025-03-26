import { z } from 'zod';
export const OpenAIConfigSchema = z.object({
    apiKey: z.string().min(1),
    orgId: z.string().optional(),
    maxRetries: z.number().int().min(0).max(5).default(3),
    rateLimitRPM: z.number().int().min(1).max(3500).default(200),
    timeoutMs: z.number().int().min(1000).max(300000).default(30000),
});
export class OpenAIError extends Error {
    code;
    status;
    retryable;
    constructor(message, code, status, retryable = false) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryable = retryable;
        this.name = 'OpenAIError';
    }
}
export class RateLimitError extends OpenAIError {
    constructor(message, retryAfterMs) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
        this.name = 'RateLimitError';
        this.retryAfterMs = retryAfterMs;
    }
    retryAfterMs;
}
//# sourceMappingURL=types.js.map
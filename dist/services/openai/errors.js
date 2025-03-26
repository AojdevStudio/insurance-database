import { OpenAIError, RateLimitError } from './types.js';
import { APIError } from 'openai';
export function transformOpenAIError(error) {
    if (error instanceof APIError) {
        const status = error.status;
        const message = error.message;
        const code = error.code || 'OPENAI_API_ERROR';
        if (status === 429) {
            const retryAfter = error.headers?.['retry-after'];
            const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
            return new RateLimitError(message, retryAfterMs);
        }
        return new OpenAIError(message, code, status, isRetryableError(error));
    }
    if (error instanceof Error && 'code' in error) {
        const networkError = error;
        return new OpenAIError(networkError.message, networkError.code, undefined, isRetryableError(error));
    }
    return new OpenAIError(error instanceof Error ? error.message : 'Unknown error', 'UNKNOWN_ERROR', undefined, false);
}
export function isRetryableError(error) {
    if (error instanceof APIError) {
        return error.status === 429 || error.status >= 500;
    }
    if (error instanceof Error && 'code' in error) {
        const networkError = error;
        const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
        return retryableCodes.includes(networkError.code);
    }
    return false;
}
export function extractRateLimitInfo(error) {
    if (error instanceof APIError && error.status === 429) {
        const retryAfter = error.headers?.['retry-after'];
        return {
            retryAfter: retryAfter ? Number(retryAfter) * 1000 : undefined
        };
    }
    return {};
}
//# sourceMappingURL=errors.js.map
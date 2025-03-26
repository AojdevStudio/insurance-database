import { RateLimitError } from '../../errors/rateLimit.error.js';
import { logger } from '../../utils/logger.js';
export function rateLimit(rateLimitService) {
    return async (req, res, next) => {
        try {
            const authenticatedReq = req;
            if (!authenticatedReq.apiKey) {
                throw new Error('API key not found in request');
            }
            const result = await rateLimitService.checkRateLimit(authenticatedReq.apiKey.id, authenticatedReq.apiKey.permissions.rateLimits);
            res.setHeader('X-RateLimit-Limit', result.limit.toString());
            res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
            res.setHeader('X-RateLimit-Reset', result.resetAt.getTime().toString());
            if (!result.isAllowed) {
                throw new RateLimitError(`Rate limit exceeded. Try again after ${result.resetAt.toISOString()}`);
            }
            next();
        }
        catch (error) {
            logger.error('Rate limit check failed', { error });
            next(error);
        }
    };
}
//# sourceMappingURL=rateLimit.js.map
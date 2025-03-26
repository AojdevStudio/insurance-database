import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';
import crypto from 'crypto';
const logger = new Logger('cache-middleware');
const defaultConfig = {
    ttl: 3600,
    prefix: 'api:cache:',
    exclude: (req) => {
        if (req.method !== 'GET') {
            return true;
        }
        const skipPaths = ['/health', '/metrics', '/favicon.ico'];
        if (skipPaths.includes(req.path)) {
            return true;
        }
        if (req.headers.authorization) {
            return true;
        }
        return false;
    },
    keyGenerator: (req) => {
        const url = req.originalUrl || req.url || '';
        const hash = crypto.createHash('sha256').update(url).digest('hex');
        return hash;
    },
    cacheControl: 'public, max-age=3600',
    staleWhileRevalidate: 300,
    staleIfError: 14400
};
export function cacheMiddleware(redisService, config = {}) {
    const options = { ...defaultConfig, ...config };
    return async function cache(req, res, next) {
        if (options.exclude(req)) {
            return next();
        }
        const cacheKey = `${options.prefix}${options.keyGenerator(req)}`;
        try {
            const cachedResponse = await redisService.get(cacheKey);
            if (cachedResponse) {
                const parsed = JSON.parse(cachedResponse.toString());
                res.setHeader('Cache-Control', options.cacheControl);
                res.setHeader('X-Cache', 'HIT');
                Object.entries(parsed.headers).forEach(([key, value]) => {
                    if (value !== undefined) {
                        res.setHeader(key, value);
                    }
                });
                trackRequestMetrics(async () => {
                    logger.debug('Cache hit', { key: cacheKey });
                }, 'cache-hit');
                return res.status(parsed.status).send(parsed.body);
            }
            const originalSend = res.send;
            res.send = function (body) {
                const responseData = {
                    body,
                    status: res.statusCode,
                    headers: res.getHeaders()
                };
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redisService.set(cacheKey, JSON.stringify(responseData), options.ttl)
                        .catch(err => {
                        if (err instanceof Error) {
                            logger.error('Failed to cache response:', err);
                        }
                        else {
                            logger.error('Failed to cache response:', new Error(String(err)));
                        }
                    });
                    trackRequestMetrics(async () => {
                        logger.debug('Cache miss', { key: cacheKey });
                    }, 'cache-miss');
                }
                res.setHeader('Cache-Control', options.cacheControl);
                res.setHeader('X-Cache', 'MISS');
                return originalSend.call(this, body);
            };
            next();
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error('Cache error:', error);
            }
            else {
                logger.error('Cache error:', new Error(String(error)));
            }
            next();
        }
    };
}
//# sourceMappingURL=cache.js.map
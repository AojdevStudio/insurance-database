import { Buffer } from 'buffer';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';
const DEFAULT_CONFIG = {
    excludePaths: [],
    sampleRate: 1.0,
    enableSizeTracking: true,
    enableCacheTracking: true,
    enableBatchTracking: true
};
const logger = new Logger('monitoring-middleware');
export function monitoringMiddleware(config = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    return async (req, res, next) => {
        if (finalConfig.excludePaths.includes(req.path)) {
            return next();
        }
        if (Math.random() > finalConfig.sampleRate) {
            return next();
        }
        const startTime = process.hrtime();
        const startMemory = process.memoryUsage();
        if (finalConfig.enableSizeTracking) {
            trackRequestSize(req);
        }
        wrapResponseMethods(res, finalConfig);
        next();
        res.on('finish', () => {
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            const memoryDiff = getMemoryDiff(startMemory);
            trackRequestMetrics(async () => {
                logger.debug('Request metrics', {
                    path: req.path,
                    method: req.method,
                    statusCode: res.statusCode,
                    duration,
                    memory: memoryDiff,
                    timestamp: Date.now()
                });
            }, 'request-metrics');
        });
    };
}
function trackRequestSize(req) {
    const size = req.headers['content-length']
        ? parseInt(req.headers['content-length'], 10)
        : Buffer.from(JSON.stringify(req.body)).length;
    trackRequestMetrics(async () => {
        logger.debug('Request size', {
            path: req.path,
            method: req.method,
            size,
            timestamp: Date.now()
        });
    }, 'request-size');
}
function wrapResponseMethods(res, config) {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    res.json = function (body) {
        if (config.enableSizeTracking) {
            const size = Buffer.from(JSON.stringify(body)).length;
            trackRequestMetrics(async () => {
                logger.debug('Response size', {
                    size,
                    type: 'json',
                    timestamp: Date.now()
                });
            }, 'response-size');
        }
        return originalJson(body);
    };
    res.send = function (body) {
        if (config.enableSizeTracking) {
            const size = typeof body === 'string'
                ? Buffer.from(body).length
                : Buffer.from(JSON.stringify(body)).length;
            trackRequestMetrics(async () => {
                logger.debug('Response size', {
                    size,
                    type: typeof body,
                    timestamp: Date.now()
                });
            }, 'response-size');
        }
        return originalSend(body);
    };
    if (config.enableCacheTracking) {
        const originalSetHeader = res.setHeader.bind(res);
        res.setHeader = function (name, value) {
            if (name.toLowerCase() === 'x-cache') {
                trackRequestMetrics(async () => {
                    logger.debug('Cache metrics', {
                        hit: value === 'HIT',
                        timestamp: Date.now()
                    });
                }, 'cache-metrics');
            }
            return originalSetHeader(name, value);
        };
    }
}
function getMemoryDiff(startMemory) {
    const endMemory = process.memoryUsage();
    return {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        rss: endMemory.rss - startMemory.rss
    };
}
//# sourceMappingURL=monitoring.js.map
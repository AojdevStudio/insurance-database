import { Logger } from '../utils/logging.js';
const DEFAULT_CONFIG = {
    maxBatchSize: 10,
    maxWaitTime: 50
};
const logger = new Logger('batch-middleware');
export function batchMiddleware(batchService, config) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    return async (req, res, next) => {
        try {
            if (!finalConfig.batchableEndpoints.includes(req.path)) {
                return next();
            }
            const key = finalConfig.batchKeyGenerator
                ? finalConfig.batchKeyGenerator(req)
                : req.originalUrl;
            const item = {
                request: req,
                response: res,
                next,
                timestamp: Date.now(),
                key
            };
            await batchService.addToBatch(key, item);
            const batchSize = batchService.getBatchSize(key);
            if (batchSize >= finalConfig.maxBatchSize) {
                await processBatch(key, next);
                return;
            }
            if (batchSize === 1) {
                setTimeout(async () => {
                    await processBatch(key, next);
                }, finalConfig.maxWaitTime);
            }
        }
        catch (error) {
            handleError(error, next);
        }
    };
    async function processBatch(key, next) {
        try {
            const items = batchService.getBatchItems(key);
            if (!items.length)
                return;
            const results = await batchService.processBatch(items);
            items.forEach((item, index) => {
                const result = results[index];
                item.response.json(result.data);
            });
            await batchService.clearBatch(key);
            trackBatchMetrics(key, items.length);
        }
        catch (error) {
            handleError(error, next);
        }
    }
    function handleError(error, next) {
        if (finalConfig.errorHandler) {
            finalConfig.errorHandler(error);
        }
        logger.error('Batch processing error', error);
        next(error);
    }
    function trackBatchMetrics(key, size) {
        logger.debug('Batch metrics', {
            key,
            size,
            timestamp: Date.now()
        });
    }
}
//# sourceMappingURL=batch.js.map
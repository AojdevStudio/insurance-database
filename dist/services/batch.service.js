import { Logger } from '../utils/logging.js';
export class BatchService {
    batches;
    logger;
    constructor() {
        this.batches = new Map();
        this.logger = new Logger('batch-service');
    }
    async addToBatch(key, item) {
        try {
            if (!this.batches.has(key)) {
                this.batches.set(key, []);
            }
            this.batches.get(key).push(item);
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error('Error adding item to batch', err);
            throw err;
        }
    }
    getBatchSize(key) {
        return this.batches.get(key)?.length || 0;
    }
    getBatchItems(key) {
        return this.batches.get(key) || [];
    }
    async processBatch(items) {
        try {
            return items.map(() => ({}));
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error('Error processing batch', err);
            throw err;
        }
    }
    async clearBatch(key) {
        try {
            this.batches.delete(key);
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error('Error clearing batch', err);
            throw err;
        }
    }
}
//# sourceMappingURL=batch.service.js.map
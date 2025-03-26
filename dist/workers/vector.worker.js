import { isMainThread } from 'worker_threads';
import { BaseWorker } from './base.worker.js';
import { Logger } from '../utils/logging.js';
const logger = new Logger('vector-worker');
export class VectorWorker extends BaseWorker {
    async processTask(task) {
        switch (task.data.operation) {
            case 'similarity':
                return this.calculateSimilarity(task.data);
            case 'search':
                return this.vectorSearch(task.data);
            case 'batch_encode':
                return this.batchEncode(task.data);
            default:
                throw new Error(`Unknown operation: ${task.data.operation}`);
        }
    }
    calculateSimilarity(data) {
        if (!data.vectors || data.vectors.length === 0) {
            throw new Error('No vectors provided');
        }
        if (!data.query) {
            throw new Error('No query vector provided');
        }
        const threshold = data.threshold ?? 0.5;
        const matches = [];
        for (let i = 0; i < data.vectors.length; i++) {
            const score = this.cosineSimilarity(data.query, data.vectors[i]);
            if (score >= threshold) {
                matches.push({ index: i, score });
            }
        }
        matches.sort((a, b) => b.score - a.score);
        return { matches };
    }
    vectorSearch(data) {
        if (!data.vectors || data.vectors.length === 0) {
            throw new Error('No vectors provided');
        }
        if (!data.query) {
            throw new Error('No query vector provided');
        }
        const matches = data.vectors
            .map((vec, index) => ({
            index,
            score: this.cosineSimilarity(data.query, vec)
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        return { matches };
    }
    batchEncode(data) {
        if (!data.vectors || data.vectors.length === 0) {
            throw new Error('No vectors provided');
        }
        return { embeddings: data.vectors };
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) {
            return 0;
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
if (!isMainThread) {
    const worker = new VectorWorker();
    worker.initialize().catch(error => {
        logger.error('Worker initialization failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=vector.worker.js.map
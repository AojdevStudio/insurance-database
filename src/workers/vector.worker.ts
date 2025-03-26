import { isMainThread } from 'worker_threads';
import { BaseWorker } from './base.worker.js';
import { Logger } from '../utils/logging.js';

const logger = new Logger('vector-worker');

interface VectorData {
  operation: 'similarity' | 'search' | 'batch_encode';
  vectors: number[][];
  query?: number[];
  threshold?: number;
}

interface VectorResult {
  matches?: Array<{
    index: number;
    score: number;
  }>;
  embeddings?: number[][];
  error?: string;
}

export class VectorWorker extends BaseWorker<VectorData, VectorResult> {
  protected async processTask(task: { id: string; data: VectorData; type: string }): Promise<VectorResult> {
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

  private calculateSimilarity(data: VectorData): VectorResult {
    if (!data.vectors || data.vectors.length === 0) {
      throw new Error('No vectors provided');
    }

    if (!data.query) {
      throw new Error('No query vector provided');
    }

    const threshold = data.threshold ?? 0.5;
    const matches: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < data.vectors.length; i++) {
      const score = this.cosineSimilarity(data.query, data.vectors[i]);
      if (score >= threshold) {
        matches.push({ index: i, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);

    return { matches };
  }

  private vectorSearch(data: VectorData): VectorResult {
    if (!data.vectors || data.vectors.length === 0) {
      throw new Error('No vectors provided');
    }

    if (!data.query) {
      throw new Error('No query vector provided');
    }

    const matches = data.vectors
      .map((vec, index) => ({
        index,
        score: this.cosineSimilarity(data.query!, vec)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Return top 10 matches

    return { matches };
  }

  private batchEncode(data: VectorData): VectorResult {
    if (!data.vectors || data.vectors.length === 0) {
      throw new Error('No vectors provided');
    }

    // In a real implementation, this would use a proper encoding model
    // This is just a placeholder that returns the input vectors
    return { embeddings: data.vectors };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
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

// Start the worker if this file is being run as a worker thread
if (!isMainThread) {
  const worker = new VectorWorker();
  worker.initialize().catch(error => {
    logger.error('Worker initialization failed:', error);
    process.exit(1);
  });
} 
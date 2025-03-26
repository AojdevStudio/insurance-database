import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';
import { RedisService } from './redis.service.js';
import { WorkerService } from './worker.service.js';
import { BatchService } from './batch.service.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { cpus } from 'os';
import path from 'path';

const logger = new Logger('vector-index-service');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface VectorIndexConfig {
  dimensions?: number;
  maxVectors?: number;
  similarityThreshold?: number;
  reindexInterval?: number;
  batchSize?: number;
  cacheConfig?: {
    ttl: number;
    maxSize: number;
  };
}

export interface VectorData {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorTaskData {
  operation: 'similarity' | 'search' | 'batch_encode';
  vectors: number[][];
  query?: number[];
  threshold?: number;
}

export interface VectorTaskResult {
  matches?: Array<{
    index: number;
    score: number;
  }>;
  embeddings?: number[][];
  error?: string;
}

export interface BatchProcessResult {
  success: boolean;
  error?: Error;
}

export class VectorIndexService {
  private readonly config: Required<VectorIndexConfig>;
  private readonly redis: RedisService;
  private readonly workerService: WorkerService<VectorTaskData, VectorTaskResult>;
  private readonly batchService: BatchService<VectorData, BatchProcessResult>;
  private reindexTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config: VectorIndexConfig,
    redisConfig: { url: string }
  ) {
    this.config = {
      dimensions: 1536, // Default for OpenAI embeddings
      maxVectors: 100000,
      similarityThreshold: 0.5,
      reindexInterval: 24 * 60 * 60 * 1000, // 24 hours
      batchSize: 1000,
      cacheConfig: {
        ttl: 3600,
        maxSize: 1000
      },
      ...config
    };

    this.redis = new RedisService(redisConfig);
    
    this.workerService = new WorkerService<VectorTaskData, VectorTaskResult>(
      path.join(__dirname, '../workers/vector.worker.js'),
      {
        numWorkers: Math.max(1, cpus().length - 1),
        taskTimeout: 30000
      }
    );

    this.batchService = new BatchService<VectorData, BatchProcessResult>();

    // Override the default processBatch implementation
    this.batchService.processBatch = async (items: VectorData[]): Promise<BatchProcessResult[]> => {
      try {
        await this.processBatch(items);
        return items.map(item => ({
          success: true
        }));
      } catch (error) {
        return items.map(() => ({
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        }));
      }
    };

    this.startReindexTimer();
  }

  private startReindexTimer(): void {
    if (this.reindexTimer) {
      clearInterval(this.reindexTimer);
    }
    this.reindexTimer = setInterval(
      () => this.reindexVectors(),
      this.config.reindexInterval
    );
  }

  async initialize(): Promise<void> {
    await this.redis.connect();
    await this.loadExistingVectors();
  }

  async shutdown(): Promise<void> {
    if (this.reindexTimer) {
      clearInterval(this.reindexTimer);
    }
    await this.workerService.shutdown();
    await this.redis.disconnect();
  }

  private async loadExistingVectors(): Promise<void> {
    return trackRequestMetrics(async () => {
      try {
        const vectors = await this.redis.hGetAll<VectorData>('vectors');
        if (!vectors) return;

        logger.info('Loaded existing vectors', {
          count: Object.keys(vectors).length
        });
      } catch (error: unknown) {
        logger.error('Error loading existing vectors:', error instanceof Error ? error : new Error(String(error)));
      }
    }, 'vector-index-load');
  }

  async addVector(data: VectorData): Promise<void> {
    return trackRequestMetrics(async () => {
      if (data.vector.length !== this.config.dimensions) {
        throw new Error(`Vector must have ${this.config.dimensions} dimensions`);
      }

      await this.redis.hSet('vectors', data.id, data);
      await this.batchService.addToBatch(data.id, data);

      logger.debug('Vector added', { id: data.id });
    }, 'vector-index-add');
  }

  async searchSimilar(query: number[], limit = 10): Promise<SearchResult[]> {
    return trackRequestMetrics(async () => {
      if (query.length !== this.config.dimensions) {
        throw new Error(`Query vector must have ${this.config.dimensions} dimensions`);
      }

      const cacheKey = `search:${query.join(',')}:${limit}`;
      const cached = await this.redis.get<SearchResult[]>(cacheKey);
      if (cached) {
        logger.debug('Cache hit for search query');
        return cached;
      }

      const vectors = await this.redis.hGetAll<VectorData>('vectors');
      if (!vectors) return [];

      const task = {
        id: `search-${Date.now()}`,
        data: {
          operation: 'search' as const,
          vectors: Object.values(vectors).map(v => v.vector),
          query,
          threshold: this.config.similarityThreshold
        },
        type: 'vector-search'
      };

      const result = await this.workerService.executeTask(task);
      
      if (!result.matches) return [];

      const searchResults = result.matches.map(match => ({
        id: Object.keys(vectors)[match.index],
        score: match.score,
        metadata: Object.values(vectors)[match.index].metadata
      }));

      await this.redis.set(
        cacheKey,
        searchResults,
        this.config.cacheConfig.ttl
      );

      return searchResults;
    }, 'vector-index-search');
  }

  private async processBatch(items: VectorData[]): Promise<void> {
    return trackRequestMetrics(async () => {
      try {
        const task = {
          id: `batch-${Date.now()}`,
          data: {
            operation: 'batch_encode' as const,
            vectors: items.map(item => item.vector)
          },
          type: 'vector-batch'
        };

        const result = await this.workerService.executeTask(task);
        
        if (result.error) {
          throw new Error(result.error);
        }

        logger.debug('Batch processed', {
          count: items.length
        });
      } catch (error: unknown) {
        logger.error('Batch processing error:', error instanceof Error ? error : new Error(String(error)));
        throw error instanceof Error ? error : new Error(String(error));
      }
    }, 'vector-index-batch');
  }

  private async reindexVectors(): Promise<void> {
    return trackRequestMetrics(async () => {
      try {
        logger.info('Starting vector reindexing');

        const vectors = await this.redis.hGetAll<VectorData>('vectors');
        if (!vectors) return;

        const vectorArray = Object.values(vectors);
        for (let i = 0; i < vectorArray.length; i += this.config.batchSize) {
          const batch = vectorArray.slice(i, i + this.config.batchSize);
          await this.processBatch(batch);
        }

        logger.info('Vector reindexing completed', {
          count: vectorArray.length
        });
      } catch (error: unknown) {
        logger.error('Vector reindexing error:', error instanceof Error ? error : new Error(String(error)));
      }
    }, 'vector-index-reindex');
  }
} 
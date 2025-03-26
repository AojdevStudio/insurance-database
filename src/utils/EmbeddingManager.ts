import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { Logger } from './logging.js';
import { embeddingsCache } from './cache.js';

/**
 * Embedding refresh configuration
 */
export interface EmbeddingRefreshConfig {
  maxAge: number; // Maximum age in milliseconds
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Embedding metadata
 */
export interface EmbeddingMetadata {
  id: string;
  createdAt: Date;
  lastUpdated: Date;
  model: string;
  dimensions: number;
  contentHash: string;
}

/**
 * Embedding refresh result
 */
export interface RefreshResult {
  refreshed: number;
  failed: number;
  skipped: number;
  errors: Error[];
}

/**
 * Manages embedding refresh operations
 */
export class EmbeddingManager {
  private static readonly DEFAULT_CONFIG: EmbeddingRefreshConfig = {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    batchSize: 100,
    concurrency: 5,
    retryAttempts: 3,
    retryDelay: 1000
  };

  private readonly supabase;
  private readonly openai;
  private readonly logger;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiKey: string,
    private readonly config: Partial<EmbeddingRefreshConfig> = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.logger = new Logger('EmbeddingManager');
    this.config = { ...EmbeddingManager.DEFAULT_CONFIG, ...config };
  }

  /**
   * Refreshes stale embeddings
   */
  async refreshStaleEmbeddings(): Promise<RefreshResult> {
    const result: RefreshResult = {
      refreshed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Get stale embeddings
      const staleEmbeddings = await this.getStaleEmbeddings();
      
      if (staleEmbeddings.length === 0) {
        this.logger.info('No stale embeddings found');
        return result;
      }

      // Process in batches
      const batchSize = this.config.batchSize ?? EmbeddingManager.DEFAULT_CONFIG.batchSize;
      for (let i = 0; i < staleEmbeddings.length; i += batchSize) {
        const batch = staleEmbeddings.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch);
        
        // Update results
        result.refreshed += batchResult.refreshed;
        result.failed += batchResult.failed;
        result.skipped += batchResult.skipped;
        result.errors.push(...batchResult.errors);
      }

      this.logger.info(`Refresh complete: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Error during refresh:', error);
        throw error;
      }
      const wrappedError = new Error(String(error));
      this.logger.error('Error during refresh:', wrappedError);
      throw wrappedError;
    }
  }

  /**
   * Gets stale embeddings that need refresh
   */
  private async getStaleEmbeddings(): Promise<EmbeddingMetadata[]> {
    const cutoffDate = new Date(Date.now() - (this.config.maxAge ?? EmbeddingManager.DEFAULT_CONFIG.maxAge));
    
    const { data, error } = await this.supabase
      .from('embeddings')
      .select('*')
      .lt('last_updated', cutoffDate.toISOString())
      .order('last_updated', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch stale embeddings: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(this.mapToMetadata);
  }

  /**
   * Processes a batch of embeddings
   */
  private async processBatch(batch: EmbeddingMetadata[]): Promise<RefreshResult> {
    const result: RefreshResult = {
      refreshed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    const promises = batch.map(async (metadata) => {
      try {
        // Check if content has changed
        const currentHash = await this.getContentHash(metadata.id);
        if (currentHash === metadata.contentHash) {
          result.skipped++;
          return;
        }

        // Refresh embedding
        await this.refreshEmbedding(metadata, currentHash);
        result.refreshed++;
      } catch (error) {
        result.failed++;
        if (error instanceof Error) {
          result.errors.push(error);
        } else {
          result.errors.push(new Error(String(error)));
        }
      }
    });

    await Promise.all(promises);
    return result;
  }

  /**
   * Refreshes a single embedding
   */
  private async refreshEmbedding(
    metadata: EmbeddingMetadata,
    newHash: string
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = this.config.retryAttempts ?? EmbeddingManager.DEFAULT_CONFIG.retryAttempts;
    const retryDelay = this.config.retryDelay ?? EmbeddingManager.DEFAULT_CONFIG.retryDelay;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      try {
        // Get content
        const content = await this.getContent(metadata.id);
        
        // Generate new embedding
        const embedding = await this.generateEmbedding(content);
        
        // Update database
        await this.updateEmbedding(metadata.id, embedding, newHash);
        
        // Update cache
        embeddingsCache.set(metadata.id, embedding);
        
        return;
      } catch (error) {
        lastError = error as Error;
        attempts++;
        if (attempts < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    throw new Error(
      `Failed to refresh embedding ${metadata.id} after ${attempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generates embedding for content
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: content
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Failed to generate embedding: No embedding data returned');
    }

    return response.data[0].embedding;
  }

  /**
   * Updates embedding in database
   */
  private async updateEmbedding(
    id: string,
    embedding: number[],
    contentHash: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('embeddings')
      .update({
        embedding,
        content_hash: contentHash,
        last_updated: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update embedding: ${error.message}`);
    }
  }

  /**
   * Gets content for embedding
   */
  private async getContent(id: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('content')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch content: ${error.message}`);
    }

    if (!data?.content) {
      throw new Error(`No content found for document ${id}`);
    }

    return data.content;
  }

  /**
   * Gets content hash
   */
  private async getContentHash(id: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('content_hash')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch content hash: ${error.message}`);
    }

    if (!data?.content_hash) {
      throw new Error(`No content hash found for document ${id}`);
    }

    return data.content_hash;
  }

  /**
   * Maps database row to metadata
   */
  private mapToMetadata(row: any): EmbeddingMetadata {
    if (!row?.id || !row?.created_at || !row?.last_updated || !row?.model || !row?.dimensions || !row?.content_hash) {
      throw new Error('Invalid database row: Missing required fields');
    }

    return {
      id: row.id,
      createdAt: new Date(row.created_at),
      lastUpdated: new Date(row.last_updated),
      model: row.model,
      dimensions: row.dimensions,
      contentHash: row.content_hash
    };
  }

  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import pLimit from 'p-limit';
import { trackRequestMetrics, trackAPIUsage } from './monitoring.js';
import { Logger } from './logging.js';
import { embeddingsCache, searchResultsCache } from './cache.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_CONCURRENT_REQUESTS = 10;
const DEFAULT_MATCH_THRESHOLD = 0.8;
const DEFAULT_MATCH_COUNT = 10;
const CHUNK_SIZE = 20; // Process guidelines in chunks of 20
const MAX_MEMORY_PER_ITEM = 1024 * 1024; // 1MB per item limit

/**
 * Represents memory usage metrics
 */
interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

/**
 * Represents context for memory tracking
 */
interface MemoryContext {
  itemCount: number;
  operation: string;
  metadata?: Record<string, string | number>;
}

/**
 * Represents OpenAI API error details
 */
interface OpenAIErrorDetails {
  status: number;
  code?: string;
  param?: string;
  type?: string;
}

/**
 * Represents OpenAI API error
 */
interface OpenAIError extends Error, Partial<OpenAIErrorDetails> {
  response?: {
    status: number;
    data?: {
      error?: OpenAIErrorDetails;
    };
  };
}

/**
 * Represents OpenAI embedding response
 */
interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Initialize logger
const logger = new Logger('embeddings-service');

// Initialize clients
let openai: OpenAI | null = null;
let supabase: ReturnType<typeof createClient> | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

function getSupabaseClient(): ReturnType<typeof createClient> {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// For testing purposes
export function setOpenAIClient(client: OpenAI) {
  openai = client;
}

export function setSupabaseClient(client: ReturnType<typeof createClient>) {
  supabase = client;
}

// Custom error class for embedding operations
class EmbeddingError extends Error {
  public retryable: boolean;
  public details?: OpenAIErrorDetails;

  constructor(
    message: string,
    cause: Error | null = null,
    retryable = true,
    details?: OpenAIErrorDetails
  ) {
    super(message);
    this.name = 'EmbeddingError';
    this.cause = cause;
    this.retryable = retryable;
    this.details = details;
  }
}

/**
 * Type guard to check if an error is an OpenAI error
 */
function isOpenAIError(error: unknown): error is OpenAIError {
  return error instanceof Error &&
    (
      'status' in error ||
      (
        'response' in error &&
        typeof (error as any).response === 'object' &&
        'status' in (error as any).response
      )
    );
}

// Helper function to delay execution
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tracks memory usage for a given operation
 * @param operation The operation to track
 * @param context Additional context for logging
 */
async function trackMemoryUsage<T>(
  operation: () => Promise<T>,
  context: MemoryContext
): Promise<T> {
  const startMemory = process.memoryUsage() as MemoryMetrics;
  const result = await operation();
  const endMemory = process.memoryUsage() as MemoryMetrics;
  const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

  if (memoryUsed > context.itemCount * MAX_MEMORY_PER_ITEM) {
    logger.warn('High memory usage detected', {
      operation: context.operation,
      itemCount: context.itemCount,
      memoryUsed: Math.round(memoryUsed / 1024 / 1024) + 'MB',
      memoryPerItem: Math.round(memoryUsed / context.itemCount / 1024) + 'KB',
      heapTotal: endMemory.heapTotal,
      external: endMemory.external,
      arrayBuffers: endMemory.arrayBuffers,
      ...context.metadata
    });
  }

  return result;
}

/**
 * Chunks an array into smaller arrays of specified size
 * @param array Array to chunk
 * @param size Size of each chunk
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, (i + 1) * size)
  );
}

/**
 * Generates an embedding for the given text using OpenAI's API with caching
 * @param text The text to generate an embedding for
 * @returns An array of numbers representing the embedding
 */
async function generateEmbedding(text: string): Promise<number[]> {
  return trackRequestMetrics(async () => {
    // Check cache first
    const cachedEmbedding = await embeddingsCache.get(text);
    if (cachedEmbedding) {
      logger.debug('Cache hit for embedding', {
        textLength: text.length
      });
      return cachedEmbedding;
    }

    let attempt = 0;
    
    while (attempt < MAX_RETRIES) {
      try {
        await trackAPIUsage('openai-embedding');
        
        const client = getOpenAIClient();
        const response = await client.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
          encoding_format: "float",
        }) as OpenAIEmbeddingResponse;

        const embedding = response.data[0].embedding;

        // Cache the result
        await embeddingsCache.set(text, embedding);

        logger.info('Generated embedding successfully', {
          textLength: text.length,
          attempt: attempt + 1,
          cached: true,
          tokens: response.usage.total_tokens
        });

        return embedding;
      } catch (error) {
        attempt++;
        
        if (isOpenAIError(error)) {
          const status = error.response?.status ?? error.status ?? 0;
          const errorDetails = error.response?.data?.error ?? {
            status,
            code: error.code,
            type: error.type
          };
          
          if (status === 429 || (status >= 500 && status < 600)) {
            logger.warn(`Retry attempt ${attempt} of ${MAX_RETRIES} failed`, {
              error: error.message,
              status,
              details: errorDetails
            });
            
            if (attempt < MAX_RETRIES) {
              await delay(RETRY_DELAY * attempt);
              continue;
            }
          }
          
          throw new EmbeddingError(
            `OpenAI API error: ${error.message}`,
            error,
            attempt < MAX_RETRIES,
            errorDetails
          );
        }
        
        logger.error('Failed to generate embedding', error as Error, {
          attempt,
          textLength: text.length
        });
        
        throw new EmbeddingError(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : null,
          attempt < MAX_RETRIES
        );
      }
    }
    
    throw new EmbeddingError('Max retries exceeded', null, false);
  }, 'generateEmbedding');
}

/**
 * Updates the embedding for a specific guideline
 * @param guidelineId The ID of the guideline to update
 * @param content The new content to generate an embedding for
 */
async function updateGuidelineEmbedding(
  guidelineId: number,
  content: string
): Promise<void> {
  return trackRequestMetrics(async () => {
    try {
      const embedding = await generateEmbedding(content);
      const client = getSupabaseClient();
      
      const { error } = await client
        .from('guidelines')
        .update({ embedding })
        .eq('id', guidelineId);
        
      if (error) {
        logger.error(`Failed to update guideline ${guidelineId}`, undefined, {
          error: error.message
        });
        throw new EmbeddingError(`Failed to update guideline ${guidelineId}: ${error.message}`, error);
      }

      logger.info(`Updated guideline ${guidelineId} successfully`, {
        contentLength: content.length
      });
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(`Failed to update guideline ${guidelineId}`, error as Error);
    }
  }, 'updateGuidelineEmbedding');
}

/**
 * Represents a guideline in the system
 */
interface Guideline {
  id: number;
  content: string;
  embedding?: number[];
}

/**
 * Represents the result of a batch update operation
 */
interface BatchUpdateResult {
  id: number;
  success: boolean;
  error?: string;
  details?: {
    retryCount?: number;
    errorType?: string;
    memoryUsage?: number;
  };
}

/**
 * Represents a search result with similarity score
 */
interface SearchResult {
  id: number;
  content: string;
  similarity: number;
  metadata?: {
    tokens?: number;
    category?: string;
    lastUpdated?: string;
  };
}

/**
 * Represents search options for guideline queries
 */
interface SearchOptions {
  threshold?: number;
  limit?: number;
  includeMetadata?: boolean;
  categories?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
}

/**
 * Represents a raw guideline match from the database
 */
interface GuidelineMatch {
  id: number;
  content: string;
  similarity: number;
  category?: string;
  updated_at?: string;
  token_count?: number;
}

/**
 * Updates embeddings for multiple guidelines with memory optimization
 * @param guidelines Array of guidelines to update
 * @param concurrentLimit Optional limit for concurrent operations
 */
async function batchUpdateGuidelines(
  guidelines: Guideline[],
  concurrentLimit: number = MAX_CONCURRENT_REQUESTS
): Promise<BatchUpdateResult[]> {
  return trackRequestMetrics(async () => {
    logger.info('Starting batch update', {
      guidelineCount: guidelines.length,
      concurrentLimit
    });

    const results: BatchUpdateResult[] = [];
    const limit = pLimit(concurrentLimit);
    const chunks = chunkArray(guidelines, CHUNK_SIZE);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(guideline => limit(async () => {
        const result: BatchUpdateResult = {
          id: guideline.id,
          success: false
        };

        try {
          await trackMemoryUsage(
            async () => {
              await updateGuidelineEmbedding(guideline.id, guideline.content);
            },
            {
              itemCount: 1,
              operation: 'updateGuideline',
              metadata: {
                guidelineId: guideline.id,
                contentLength: guideline.content.length
              }
            }
          );

          result.success = true;
          result.details = {
            retryCount: 0,
            memoryUsage: process.memoryUsage().heapUsed
          };
        } catch (error) {
          result.success = false;
          result.error = error instanceof Error ? error.message : String(error);
          result.details = {
            errorType: error instanceof EmbeddingError ? 'EmbeddingError' : 'UnknownError',
            retryCount: error instanceof EmbeddingError && error.retryable ? MAX_RETRIES : 0
          };

          logger.error(`Failed to update guideline ${guideline.id}`, error instanceof Error ? error : undefined, {
            guidelineId: guideline.id,
            contentLength: guideline.content.length,
            error: result.error
          });
        }

        return result;
      }));

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      const successCount = chunkResults.filter(r => r.success).length;
      logger.info(`Processed chunk of ${chunk.length} guidelines`, {
        successCount,
        failureCount: chunk.length - successCount
      });
    }

    const finalSuccessCount = results.filter(r => r.success).length;
    logger.info('Completed batch update', {
      totalGuidelines: guidelines.length,
      successCount: finalSuccessCount,
      failureCount: guidelines.length - finalSuccessCount
    });

    return results;
  }, 'batchUpdateGuidelines');
}

/**
 * Searches for guidelines based on query text and options
 * @param queryText The text to search for
 * @param options Search options including threshold and limit
 */
async function searchGuidelines(
  queryText: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    threshold = DEFAULT_MATCH_THRESHOLD,
    limit = DEFAULT_MATCH_COUNT,
    includeMetadata = false,
    categories = [],
    dateRange
  } = options;

  return trackRequestMetrics(async () => {
    // Check cache first
    const cacheKey = `${queryText}:${threshold}:${limit}:${categories.join(',')}`;
    const cachedResults = await searchResultsCache.get(cacheKey);
    if (cachedResults) {
      logger.debug('Cache hit for search', {
        queryLength: queryText.length,
        resultCount: cachedResults.length
      });
      return cachedResults;
    }

    try {
      const queryEmbedding = await generateEmbedding(queryText);
      const client = getSupabaseClient();

      let query = client
        .rpc('match_guidelines', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        });

      if (categories.length > 0) {
        query = query.in('category', categories);
      }

      if (dateRange?.start) {
        query = query.gte('updated_at', dateRange.start);
      }

      if (dateRange?.end) {
        query = query.lte('updated_at', dateRange.end);
      }

      const { data: matches, error } = await query;

      if (error) {
        throw new Error(`Failed to search guidelines: ${error.message}`);
      }

      if (!Array.isArray(matches)) {
        throw new Error('Invalid response format from match_guidelines');
      }

      const results: SearchResult[] = (matches as GuidelineMatch[]).map(match => ({
        id: match.id,
        content: match.content,
        similarity: match.similarity,
        ...(includeMetadata && {
          metadata: {
            category: match.category,
            lastUpdated: match.updated_at,
            tokens: match.token_count
          }
        })
      }));

      // Cache the results
      await searchResultsCache.set(cacheKey, results);

      logger.info('Search completed successfully', {
        queryLength: queryText.length,
        resultCount: results.length,
        threshold,
        limit
      });

      return results;
    } catch (error) {
      logger.error('Failed to search guidelines', error instanceof Error ? error : undefined, {
        queryLength: queryText.length,
        threshold,
        limit
      });

      throw error instanceof Error
        ? error
        : new Error(`Failed to search guidelines: ${String(error)}`);
    }
  }, 'searchGuidelines');
}

export {
  generateEmbedding,
  updateGuidelineEmbedding,
  batchUpdateGuidelines,
  searchGuidelines,
  type Guideline,
  type BatchUpdateResult,
  type SearchResult,
  type SearchOptions,
  type OpenAIError,
  type OpenAIErrorDetails,
  EmbeddingError
};
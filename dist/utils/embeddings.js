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
const CHUNK_SIZE = 20;
const MAX_MEMORY_PER_ITEM = 1024 * 1024;
const logger = new Logger('embeddings-service');
let openai = null;
let supabase = null;
function getOpenAIClient() {
    if (!openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        openai = new OpenAI({ apiKey });
    }
    return openai;
}
function getSupabaseClient() {
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
export function setOpenAIClient(client) {
    openai = client;
}
export function setSupabaseClient(client) {
    supabase = client;
}
class EmbeddingError extends Error {
    retryable;
    details;
    constructor(message, cause = null, retryable = true, details) {
        super(message);
        this.name = 'EmbeddingError';
        this.cause = cause;
        this.retryable = retryable;
        this.details = details;
    }
}
function isOpenAIError(error) {
    return error instanceof Error &&
        ('status' in error ||
            ('response' in error &&
                typeof error.response === 'object' &&
                'status' in error.response));
}
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function trackMemoryUsage(operation, context) {
    const startMemory = process.memoryUsage();
    const result = await operation();
    const endMemory = process.memoryUsage();
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
function chunkArray(array, size) {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, (i + 1) * size));
}
async function generateEmbedding(text) {
    return trackRequestMetrics(async () => {
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
                });
                const embedding = response.data[0].embedding;
                await embeddingsCache.set(text, embedding);
                logger.info('Generated embedding successfully', {
                    textLength: text.length,
                    attempt: attempt + 1,
                    cached: true,
                    tokens: response.usage.total_tokens
                });
                return embedding;
            }
            catch (error) {
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
                    throw new EmbeddingError(`OpenAI API error: ${error.message}`, error, attempt < MAX_RETRIES, errorDetails);
                }
                logger.error('Failed to generate embedding', error, {
                    attempt,
                    textLength: text.length
                });
                throw new EmbeddingError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : null, attempt < MAX_RETRIES);
            }
        }
        throw new EmbeddingError('Max retries exceeded', null, false);
    }, 'generateEmbedding');
}
async function updateGuidelineEmbedding(guidelineId, content) {
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
        }
        catch (error) {
            if (error instanceof EmbeddingError) {
                throw error;
            }
            throw new EmbeddingError(`Failed to update guideline ${guidelineId}`, error);
        }
    }, 'updateGuidelineEmbedding');
}
async function batchUpdateGuidelines(guidelines, concurrentLimit = MAX_CONCURRENT_REQUESTS) {
    return trackRequestMetrics(async () => {
        logger.info('Starting batch update', {
            guidelineCount: guidelines.length,
            concurrentLimit
        });
        const results = [];
        const limit = pLimit(concurrentLimit);
        const chunks = chunkArray(guidelines, CHUNK_SIZE);
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(guideline => limit(async () => {
                const result = {
                    id: guideline.id,
                    success: false
                };
                try {
                    await trackMemoryUsage(async () => {
                        await updateGuidelineEmbedding(guideline.id, guideline.content);
                    }, {
                        itemCount: 1,
                        operation: 'updateGuideline',
                        metadata: {
                            guidelineId: guideline.id,
                            contentLength: guideline.content.length
                        }
                    });
                    result.success = true;
                    result.details = {
                        retryCount: 0,
                        memoryUsage: process.memoryUsage().heapUsed
                    };
                }
                catch (error) {
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
async function searchGuidelines(queryText, options = {}) {
    const { threshold = DEFAULT_MATCH_THRESHOLD, limit = DEFAULT_MATCH_COUNT, includeMetadata = false, categories = [], dateRange } = options;
    return trackRequestMetrics(async () => {
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
            const results = matches.map(match => ({
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
            await searchResultsCache.set(cacheKey, results);
            logger.info('Search completed successfully', {
                queryLength: queryText.length,
                resultCount: results.length,
                threshold,
                limit
            });
            return results;
        }
        catch (error) {
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
export { generateEmbedding, updateGuidelineEmbedding, batchUpdateGuidelines, searchGuidelines, EmbeddingError };
//# sourceMappingURL=embeddings.js.map
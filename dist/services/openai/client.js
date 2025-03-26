import { z } from 'zod';
import { OpenAI } from 'openai';
import { OpenAIError, RateLimitError } from './types.js';
import { getConfig } from './config.js';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { transformOpenAIError } from './errors.js';
export class OpenAIClient {
    static instance = null;
    client;
    retryOptions;
    rateLimiter;
    constructor() {
        const config = getConfig();
        this.client = new OpenAI({
            apiKey: config.apiKey,
            organization: config.orgId,
            timeout: config.timeoutMs,
        });
        this.retryOptions = {
            maxRetries: config.maxRetries,
            minTimeout: 1000,
            maxTimeout: 10000,
            randomize: true,
        };
        this.rateLimiter = pLimit(config.rateLimitRPM);
    }
    static getInstance() {
        if (!OpenAIClient.instance) {
            OpenAIClient.instance = new OpenAIClient();
        }
        return OpenAIClient.instance;
    }
    async createEmbedding(input, model = 'text-embedding-3-small') {
        const request = { input, model };
        try {
            const response = await this.rateLimiter(async () => {
                const result = await this.retryableRequest(async () => {
                    const apiResponse = await this.client.embeddings.create(request);
                    return this.embeddingResponseSchema.parse(apiResponse);
                });
                return result;
            });
            return response.data.map(item => item.embedding);
        }
        catch (error) {
            throw transformOpenAIError(error);
        }
    }
    validateResponse(response, schema) {
        try {
            return schema.parse(response);
        }
        catch (error) {
            throw new Error(`Invalid response format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    embeddingResponseSchema = z.object({
        object: z.literal('list'),
        data: z.array(z.object({
            object: z.literal('embedding'),
            embedding: z.array(z.number()),
            index: z.number()
        })),
        model: z.string(),
        usage: z.object({
            prompt_tokens: z.number(),
            total_tokens: z.number()
        })
    });
    static resetInstance() {
        OpenAIClient.instance = null;
    }
    async retryableRequest(operation) {
        const config = getConfig();
        return pRetry(async () => {
            try {
                return await operation();
            }
            catch (error) {
                if (error instanceof OpenAI.APIError) {
                    if (error.status === 429) {
                        const retryAfter = parseInt(error.headers?.['retry-after'] || '30', 10) * 1000;
                        throw new RateLimitError(error.message, retryAfter);
                    }
                    throw new OpenAIError(error.message, 'API_ERROR', error.status);
                }
                if (error instanceof Error && 'code' in error) {
                    const networkError = error;
                    if (['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(networkError.code)) {
                        throw new OpenAIError(error.message, networkError.code, undefined, true);
                    }
                }
                throw new OpenAIError(error instanceof Error ? error.message : 'Unknown error', 'UNKNOWN_ERROR');
            }
        }, {
            retries: config.maxRetries,
            onFailedAttempt: async (error) => {
                if (error.name === 'RateLimitError' && error instanceof RateLimitError) {
                    await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs || 30000));
                }
            },
        });
    }
}
//# sourceMappingURL=client.js.map
import { z } from 'zod';
import { OpenAI } from 'openai';
import { OpenAIError, RateLimitError, EmbeddingResponse } from './types.js';
import { getConfig } from './config.js';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { transformOpenAIError } from './errors.js';
import type { EmbeddingRequest, RetryOptions } from './types.js';

/**
 * OpenAI client wrapper with enhanced error handling and retries
 */
export class OpenAIClient {
  private static instance: OpenAIClient | null = null;
  private client: OpenAI;
  private retryOptions: RetryOptions;
  private rateLimiter: ReturnType<typeof pLimit>;

  private constructor() {
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

  /**
   * Gets the singleton instance of the OpenAI client
   */
  public static getInstance(): OpenAIClient {
    if (!OpenAIClient.instance) {
      OpenAIClient.instance = new OpenAIClient();
    }
    return OpenAIClient.instance;
  }

  /**
   * Creates embeddings for the given input
   * @param input Text to create embeddings for
   * @param model OpenAI model to use (defaults to text-embedding-3-small)
   */
  public async createEmbedding(
    input: string | string[],
    model: string = 'text-embedding-3-small'
  ): Promise<number[][]> {
    const request: EmbeddingRequest = { input, model };

    try {
      // Acquire rate limit token
      const response = await this.rateLimiter(async () => {
        const result = await this.retryableRequest(async () => {
          const apiResponse = await this.client.embeddings.create(request);
          return this.embeddingResponseSchema.parse(apiResponse);
        });
        return result;
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      throw transformOpenAIError(error);
    }
  }

  /**
   * Validates a response against a schema
   */
  private validateResponse<T>(response: unknown, schema: z.Schema<T>): T {
    try {
      return schema.parse(response);
    } catch (error) {
      throw new Error(`Invalid response format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schema for validating embedding responses
   */
  private embeddingResponseSchema = z.object({
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
  }) satisfies z.Schema<EmbeddingResponse>;

  /**
   * Resets the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    OpenAIClient.instance = null;
  }

  private async retryableRequest<T>(operation: () => Promise<T>): Promise<T> {
    const config = getConfig();
    return pRetry(
      async () => {
        try {
          return await operation();
        } catch (error) {
          if (error instanceof OpenAI.APIError) {
            if (error.status === 429) {
              const retryAfter = parseInt(error.headers?.['retry-after'] || '30', 10) * 1000;
              throw new RateLimitError(error.message, retryAfter);
            }
            throw new OpenAIError(error.message, 'API_ERROR', error.status);
          }
          // Handle network errors
          if (error instanceof Error && 'code' in error) {
            const networkError = error as Error & { code: string };
            if (['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(networkError.code)) {
              throw new OpenAIError(error.message, networkError.code, undefined, true);
            }
          }
          throw new OpenAIError(
            error instanceof Error ? error.message : 'Unknown error',
            'UNKNOWN_ERROR'
          );
        }
      },
      {
        retries: config.maxRetries,
        onFailedAttempt: async (error) => {
          if (error.name === 'RateLimitError' && error instanceof RateLimitError) {
            await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs || 30000));
          }
        },
      }
    );
  }
} 
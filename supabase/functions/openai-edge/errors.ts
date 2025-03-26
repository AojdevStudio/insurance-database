import { OpenAIError, RateLimitError } from './types.ts';
import { OpenAI } from 'https://deno.land/x/openai@v4.24.0/mod.ts';

export function transformOpenAIError(error: unknown): OpenAIError {
  if (error instanceof OpenAIError) {
    return error;
  }

  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      const retryAfter = parseInt(error.headers?.['retry-after'] || '30', 10) * 1000;
      return new RateLimitError(error.message, retryAfter);
    }
    return new OpenAIError(error.message, 'API_ERROR', error.status);
  }

  if (error instanceof Error && 'code' in error) {
    const networkError = error as Error & { code: string };
    if (['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(networkError.code)) {
      return new OpenAIError(error.message, networkError.code, undefined, true);
    }
  }

  return new OpenAIError(
    error instanceof Error ? error.message : 'Unknown error',
    'UNKNOWN_ERROR'
  );
} 
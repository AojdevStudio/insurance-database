import { OpenAIError, RateLimitError } from './types.js';
import { APIError } from 'openai';

/**
 * Transforms any error into an OpenAIError
 */
export function transformOpenAIError(error: unknown): OpenAIError {
  // Handle OpenAI API errors
  if (error instanceof APIError) {
    const status = error.status;
    const message = error.message;
    const code = error.code || 'OPENAI_API_ERROR';
    
    // Handle rate limit errors
    if (status === 429) {
      const retryAfter = error.headers?.['retry-after'];
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
      return new RateLimitError(message, retryAfterMs);
    }

    // Handle other API errors
    return new OpenAIError(
      message,
      code,
      status,
      isRetryableError(error)
    );
  }

  // Handle network errors
  if (error instanceof Error && 'code' in error) {
    const networkError = error as Error & { code: string };
    return new OpenAIError(
      networkError.message,
      networkError.code,
      undefined,
      isRetryableError(error)
    );
  }

  // Handle unknown errors
  return new OpenAIError(
    error instanceof Error ? error.message : 'Unknown error',
    'UNKNOWN_ERROR',
    undefined,
    false
  );
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof APIError) {
    // Retry on rate limits and server errors
    return error.status === 429 || error.status >= 500;
  }

  if (error instanceof Error && 'code' in error) {
    const networkError = error as Error & { code: string };
    // Retry on common network errors
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
    return retryableCodes.includes(networkError.code);
  }

  return false;
}

/**
 * Extracts rate limit information from an error
 */
export function extractRateLimitInfo(error: unknown): { retryAfter?: number } {
  if (error instanceof APIError && error.status === 429) {
    const retryAfter = error.headers?.['retry-after'];
    return {
      retryAfter: retryAfter ? Number(retryAfter) * 1000 : undefined
    };
  }
  return {};
} 
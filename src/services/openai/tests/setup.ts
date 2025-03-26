import { APIError } from 'openai';
import type { Embedding } from 'openai/resources/embeddings.js';
import { OpenAIClient } from '../client.js';
import { resetConfig } from '../config.js';

// Mock environment variables
export function setupTestEnv() {
  process.env.OPENAI_API_KEY = 'test-api-key';
  process.env.OPENAI_MAX_RETRIES = '3';
  process.env.OPENAI_RATE_LIMIT_RPM = '200';
  process.env.OPENAI_TIMEOUT_MS = '30000';
}

// Reset all singletons between tests
export function resetAll() {
  resetConfig();
  OpenAIClient.resetInstance();
}

// Mock successful embedding response
export const mockEmbeddingResponse = {
  object: 'list' as const,
  data: [
    {
      object: 'embedding' as const,
      embedding: [0.1, 0.2, 0.3],
      index: 0,
    },
  ],
  model: 'text-embedding-3-small',
  usage: {
    prompt_tokens: 10,
    total_tokens: 10,
  },
  _request_id: 'test-request-id',
} as const satisfies { 
  object: 'list';
  data: Array<Embedding>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  _request_id: string;
};

// Create mock API error
export function createMockAPIError(
  status: number,
  message: string,
  code?: string,
  headers: Record<string, string> = {}
): APIError {
  return new APIError(status, message, code, headers);
}

// Mock rate limit error
export const mockRateLimitError = createMockAPIError(
  429,
  'Rate limit exceeded',
  'rate_limit_exceeded',
  { 'retry-after': '30' }
);

// Mock network error
export class MockNetworkError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'MockNetworkError';
  }
} 
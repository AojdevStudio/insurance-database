import { z } from 'zod';

// Configuration schema and type
export const OpenAIConfigSchema = z.object({
  apiKey: z.string().min(1),
  orgId: z.string().optional(),
  maxRetries: z.number().int().min(0).max(5).default(3),
  rateLimitRPM: z.number().int().min(1).max(3500).default(200),
  timeoutMs: z.number().int().min(1000).max(300000).default(30000),
});

export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

// Error types
export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class RateLimitError extends OpenAIError {
  constructor(message: string, retryAfterMs?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }

  public readonly retryAfterMs?: number;
}

// Rate limiting types
export interface RateLimiter {
  acquireToken(): Promise<void>;
  releaseToken(): void;
}

// Retry types
export interface RetryOptions {
  maxRetries: number;
  minTimeout: number;
  maxTimeout: number;
  randomize: boolean;
}

// Embedding types
export interface EmbeddingRequest {
  input: string | string[];
  model: string;
}

export interface EmbeddingResponse {
  object: 'list';
  data: {
    object: 'embedding';
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
} 
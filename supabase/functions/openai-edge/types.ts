export interface OpenAIConfig {
  apiKey: string;
  orgId?: string;
  maxRetries: number;
  rateLimitRPM: number;
  timeoutMs: number;
}

export interface EmbeddingRequest {
  input: string | string[];
  model: string;
}

export interface EmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'UNKNOWN_ERROR',
    public readonly status?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class RateLimitError extends OpenAIError {
  constructor(message: string, public readonly retryAfterMs?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, true);
    this.name = 'RateLimitError';
  }
}

export interface RetryOptions {
  maxRetries: number;
  minTimeout: number;
  maxTimeout: number;
  randomize: boolean;
} 
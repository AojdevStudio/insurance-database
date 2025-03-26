import { RateLimiter } from './types.js';

/**
 * Token bucket implementation for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly refillRate: number;
  private readonly capacity: number;

  constructor(ratePerMinute: number) {
    this.capacity = ratePerMinute;
    this.tokens = ratePerMinute;
    this.lastRefill = Date.now();
    // Convert rate per minute to rate per millisecond
    this.refillRate = ratePerMinute / (60 * 1000);
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const newTokens = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    
    // Calculate wait time until next token
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return this.acquire();
  }

  release(): void {
    this.tokens = Math.min(this.capacity, this.tokens + 1);
  }
}

/**
 * OpenAI rate limiter implementation
 */
export class OpenAIRateLimiter implements RateLimiter {
  private bucket: TokenBucket;
  private readonly timeoutMs: number;

  constructor(ratePerMinute: number, timeoutMs: number = 30000) {
    this.bucket = new TokenBucket(ratePerMinute);
    this.timeoutMs = timeoutMs;
  }

  async acquireToken(): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Rate limit timeout')), this.timeoutMs);
    });

    try {
      await Promise.race([
        this.bucket.acquire(),
        timeoutPromise
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Rate limit timeout') {
        throw error;
      }
      this.releaseToken();
      throw error;
    }
  }

  releaseToken(): void {
    this.bucket.release();
  }
} 
import { jest, describe, beforeAll, beforeEach, it, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import { generateEmbedding, EmbeddingError } from '../../src/utils/embeddings.js';
import type { OpenAI } from 'openai';
import type { CreateEmbeddingResponse } from 'openai/resources/embeddings';
import { mockCreate, mockOpenAIResponse } from '../setup.js';

// Test data
const testData = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  content: `Test guideline ${i + 1} with some content about insurance policies and coverage details.`
}));

// Performance thresholds
const MAX_LATENCY = 2000; // 2 seconds
const MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100 MB

// Custom error class for testing
class TestOpenAIError extends Error {
  status: number;
  headers: Headers;
  error: { message: string };

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenAIError';
    this.status = status;
    this.headers = new Headers();
    this.error = { message };
  }
}

// Mock embedding response
const mockEmbeddingResponse: CreateEmbeddingResponse = {
  data: [{
    embedding: [0.1, 0.2, 0.3],
    index: 0,
    object: 'embedding'
  }],
  model: 'text-embedding-ada-002',
  object: 'list',
  usage: {
    prompt_tokens: 8,
    total_tokens: 8
  }
};

describe('Embedding Generation Performance Tests', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockCreate.mockResolvedValue(mockOpenAIResponse);
  });

  it('should generate embeddings within latency threshold', async () => {
    const latencies: number[] = [];

    // Test initial successful embedding generation
    const startTime = performance.now();
    await generateEmbedding(testData[0].content);
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(MAX_LATENCY);

    // Test error handling and retries
    // Mock rate limit error
    mockCreate
      .mockRejectedValueOnce(new TestOpenAIError('Rate limit exceeded', 429))
      .mockResolvedValueOnce(mockEmbeddingResponse);

    const rateLimitStart = performance.now();
    await generateEmbedding('Test rate limit handling');
    const rateLimitDuration = performance.now() - rateLimitStart;
    latencies.push(rateLimitDuration);

    // Mock server error
    mockCreate
      .mockRejectedValueOnce(new TestOpenAIError('Internal server error', 500))
      .mockResolvedValueOnce(mockEmbeddingResponse);

    const serverErrorStart = performance.now();
    await generateEmbedding('Test server error handling');
    const serverErrorDuration = performance.now() - serverErrorStart;
    latencies.push(serverErrorDuration);

    // Test non-retryable error
    mockCreate
      .mockRejectedValueOnce(new TestOpenAIError('Bad request', 400));

    try {
      await generateEmbedding('Test non-retryable error');
    } catch (error) {
      expect(error).toBeInstanceOf(EmbeddingError);
      expect((error as EmbeddingError).retryable).toBe(false);
    }

    // Calculate average latency
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    expect(avgLatency).toBeLessThan(MAX_LATENCY);
  });

  it('should maintain reasonable memory usage during embedding generation', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Mock successful embedding generation
    mockCreate.mockResolvedValue(mockEmbeddingResponse);

    // Generate embeddings for all test data
    await Promise.all(testData.map(item => generateEmbedding(item.content)));

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    console.log(`Memory usage increased by ${memoryIncrease / 1024 / 1024} MB`);
    expect(memoryIncrease).toBeLessThan(MAX_MEMORY_USAGE);
  });
}); 
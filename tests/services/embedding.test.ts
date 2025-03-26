import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OpenAI } from 'openai';
import { generateEmbedding, updateGuidelineEmbedding, batchUpdateGuidelines, EmbeddingError, searchGuidelines } from '../../src/utils/embeddings.js';
import { mockCreate, mockOpenAIResponse, mockOpenAIClient } from '../setup.js';
import { CreateEmbeddingResponse, Embedding } from 'openai/resources/embeddings';

// Types for mocks
type OpenAIResponse = {
  data: { embedding: number[] }[];
  object: string;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
};

type SupabaseResponse<T = any> = {
  data: T | null;
  error: Error | null;
};

describe('Embedding Service', () => {
  const mockEmbedding = Array(1536).fill(0.1);
  const mockSearchResults = [{ id: 1, content: 'test', similarity: 0.9 }];

  let mockFrom: jest.MockedFunction<() => any>;
  let mockEq: jest.MockedFunction<() => Promise<SupabaseResponse>>;
  let mockRpc: jest.MockedFunction<() => Promise<SupabaseResponse>>;
  let mockCreate: jest.MockedFunction<typeof mockOpenAIClient.embeddings.create>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockCreate = jest.fn().mockResolvedValue({
      data: [{
        embedding: mockEmbedding,
        index: 0,
        object: 'embedding'
      }],
      model: 'text-embedding-ada-002',
      object: 'list',
      usage: { prompt_tokens: 0, total_tokens: 0 }
    } as CreateEmbeddingResponse);

    mockOpenAIClient.embeddings.create = mockCreate;

    mockFrom = jest.fn().mockReturnThis();
    mockEq = jest.fn();
    mockRpc = jest.fn();

    const mockSupabaseClient = {
      from: mockFrom,
      eq: mockEq,
      rpc: mockRpc
    } as unknown as SupabaseClient;

    jest.mock('@supabase/supabase-js', () => ({
      createClient: jest.fn().mockReturnValue(mockSupabaseClient)
    }));

    mockEq.mockReset()
      .mockResolvedValueOnce({ data: null, error: new Error('Database error') } as SupabaseResponse);

    mockRpc.mockResolvedValue({
      data: [{ id: 1, content: 'test', similarity: 0.9 }],
      error: null
    } as SupabaseResponse);

    mockCreate.mockClear();
    mockCreate.mockResolvedValue(mockOpenAIResponse);
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings successfully', async () => {
      const text = 'test text';
      const result = await generateEmbedding(text);
      
      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: text
      });
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API error');
      mockCreate.mockRejectedValueOnce(mockError);

      await expect(generateEmbedding('test')).rejects.toThrow(EmbeddingError);
    });

    it('should handle rate limiting', async () => {
      const mockError = new Error('Rate limit exceeded');
      mockError.name = 'RateLimitError';
      mockCreate.mockRejectedValueOnce(mockError);

      await expect(generateEmbedding('test')).rejects.toThrow(EmbeddingError);
    });

    it('should handle invalid responses', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [],
        model: 'text-embedding-ada-002',
        object: 'list',
        usage: { prompt_tokens: 0, total_tokens: 0 }
      } as CreateEmbeddingResponse);

      await expect(generateEmbedding('test')).rejects.toThrow(EmbeddingError);
    });
  });

  describe('updateGuidelineEmbedding', () => {
    it('should update guideline embedding successfully', async () => {
      mockCreate
        .mockReset()
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
          object: 'list',
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 0, total_tokens: 0 }
        });

      await updateGuidelineEmbedding(1, 'test content');
      
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('guidelines');
      expect(mockEq).toHaveBeenCalledWith('id', 1);
    });

    it('should throw error on database update failure', async () => {
      mockEq.mockReset()
        .mockResolvedValueOnce({ data: null, error: new Error('Database error') } as SupabaseResponse);

      await expect(updateGuidelineEmbedding(1, 'test content'))
        .rejects
        .toThrow(EmbeddingError);
    });

    it('should propagate embedding generation error', async () => {
      const error = new Error('Embedding error');
      mockCreate.mockReset().mockRejectedValueOnce(error);

      await expect(updateGuidelineEmbedding(1, 'test content'))
        .rejects
        .toThrow(EmbeddingError);
    });
  });

  describe('batchUpdateGuidelines', () => {
    const guidelines = [
      { id: 1, content: 'test 1' },
      { id: 2, content: 'test 2' }
    ];

    it('should process multiple guidelines successfully', async () => {
      mockCreate
        .mockReset()
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
          object: 'list',
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 0, total_tokens: 0 }
        })
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
          object: 'list',
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 0, total_tokens: 0 }
        });

      const results = await batchUpdateGuidelines(guidelines);
      
      expect(mockFrom).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(results).toEqual([
        { id: 1, success: true },
        { id: 2, success: true }
      ]);
    });

    it('should handle partial failures', async () => {
      mockEq.mockReset()
        .mockResolvedValueOnce({ data: null, error: null } as SupabaseResponse)
        .mockResolvedValueOnce({ data: null, error: new Error('Database error') } as SupabaseResponse);

      const results = await batchUpdateGuidelines(guidelines);
      
      expect(results).toEqual([
        { id: 1, success: true },
        { id: 2, success: false, error: 'Failed to update guideline 2: Database error' }
      ]);
    });

    it('should handle embedding generation failures', async () => {
      const error = new Error('Embedding error');
      mockCreate
        .mockReset()
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
          object: 'list',
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 0, total_tokens: 0 }
        })
        .mockRejectedValueOnce(error);

      const results = await batchUpdateGuidelines(guidelines);
      
      expect(results).toEqual([
        { id: 1, success: true },
        { id: 2, success: false, error: 'OpenAI API error: Embedding error' }
      ]);
    });
  });

  describe('searchGuidelines', () => {
    it('should search guidelines successfully with default parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
        object: 'list',
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 0, total_tokens: 0 }
      });

      mockRpc.mockResolvedValueOnce({
        data: mockSearchResults,
        error: null
      });

      const results = await searchGuidelines('test query');
      
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('match_guidelines', {
        query_embedding: mockEmbedding,
        match_threshold: 0.8,
        match_count: 10
      });
      expect(results).toEqual(mockSearchResults);
    });

    it('should search guidelines with custom parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
        object: 'list',
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 0, total_tokens: 0 }
      });

      mockRpc.mockResolvedValueOnce({
        data: mockSearchResults,
        error: null
      });

      const results = await searchGuidelines('test query', 0.9, 5);
      
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('match_guidelines', {
        query_embedding: mockEmbedding,
        match_threshold: 0.9,
        match_count: 5
      });
      expect(results).toEqual(mockSearchResults);
    });

    it('should handle search errors', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
        object: 'list',
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 0, total_tokens: 0 }
      });

      mockRpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Search error')
      });

      await expect(searchGuidelines('test query'))
        .rejects
        .toThrow(EmbeddingError);
    });

    it('should handle embedding generation errors', async () => {
      const error = new Error('Embedding error');
      mockCreate.mockRejectedValueOnce(error);

      await expect(searchGuidelines('test query'))
        .rejects
        .toThrow(EmbeddingError);
    });
  });
}); 
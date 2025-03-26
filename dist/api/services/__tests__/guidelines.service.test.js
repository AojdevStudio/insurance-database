import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { GuidelineService } from '../guidelines.service.js';
import { OpenAIService } from '../openai.service.js';
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn()
}));
jest.mock('../openai.service.js', () => ({
    OpenAIService: {
        createEmbedding: jest.fn()
    }
}));
describe('GuidelineService', () => {
    let mockSupabase;
    const mockGuidelines = [{
            id: 1,
            carrier_id: 1,
            title: 'Test Guideline',
            content: 'Test content',
            category: 'test',
            metadata: { tags: ['test'] },
            created_at: new Date(),
            text_similarity: 0.8,
            vector_similarity: 0.9
        }];
    const mockSearchQuery = {
        query: 'test',
        category: 'test',
        carrier_id: 1,
        page: 1,
        limit: 10
    };
    const mockSearchResponse = {
        guidelines: mockGuidelines,
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1
    };
    const mockSuccessResponse = {
        data: mockGuidelines,
        error: null,
        count: 1,
        status: 200,
        statusText: 'OK'
    };
    const mockErrorResponse = {
        data: null,
        error: new Error('Database error'),
        count: null,
        status: 500,
        statusText: 'Internal Server Error'
    };
    const mockEmbedding = Array(1536).fill(0.1);
    beforeEach(() => {
        const mockFrom = jest.fn().mockReturnThis();
        const mockSelect = jest.fn().mockReturnThis();
        const mockTextSearch = jest.fn().mockReturnThis();
        const mockEq = jest.fn().mockReturnThis();
        const mockRange = jest.fn().mockReturnThis();
        const mockOrder = jest.fn().mockReturnThis();
        const mockRpc = jest.fn();
        mockSupabase = {
            from: mockFrom,
            select: mockSelect,
            textSearch: mockTextSearch,
            eq: mockEq,
            range: mockRange,
            order: mockOrder,
            rpc: mockRpc
        };
        createClient.mockReturnValue(mockSupabase);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('searchGuidelines', () => {
        it('should return guidelines with pagination', async () => {
            const mockSelect = jest.fn().mockResolvedValue(mockSuccessResponse);
            mockSupabase.from.mockReturnValue({
                select: mockSelect,
                textSearch: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                range: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis()
            });
            const result = await GuidelineService.searchGuidelines(mockSearchQuery);
            expect(result.guidelines).toEqual([expect.objectContaining({ id: 1 })]);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
        });
        it('should handle database errors', async () => {
            const mockSelect = jest.fn().mockResolvedValue(mockErrorResponse);
            mockSupabase.from.mockReturnValue({
                select: mockSelect,
                textSearch: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                range: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis()
            });
            await expect(GuidelineService.searchGuidelines(mockSearchQuery))
                .rejects
                .toThrow('Database error');
        });
    });
    describe('semanticSearch', () => {
        it('should perform semantic search with embeddings', async () => {
            OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
            mockSupabase.rpc.mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue(mockSuccessResponse)
            }));
            const result = await GuidelineService.semanticSearch(mockSearchQuery);
            expect(result.guidelines).toEqual([expect.objectContaining({ id: 1 })]);
            expect(OpenAIService.createEmbedding).toHaveBeenCalledWith(mockSearchQuery.query);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('match_guidelines', {
                query_embedding: mockEmbedding,
                similarity_threshold: 0.7,
                match_count: 10
            });
        });
        it('should handle embedding generation errors', async () => {
            OpenAIService.createEmbedding.mockReturnValue(Promise.reject(new Error('Embedding generation failed')));
            await expect(GuidelineService.semanticSearch(mockSearchQuery))
                .rejects
                .toThrow('Embedding generation failed');
        });
    });
    describe('hybridSearch', () => {
        it('should combine text and semantic search results', async () => {
            OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
            mockSupabase.rpc.mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue(mockSuccessResponse)
            }));
            const result = await GuidelineService.hybridSearch(mockSearchQuery);
            expect(result.guidelines).toEqual([expect.objectContaining({ id: 1 })]);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('hybrid_search_guidelines', {
                query_text: mockSearchQuery.query,
                query_embedding: mockEmbedding,
                text_weight: 0.3,
                vector_weight: 0.7,
                similarity_threshold: 0.7,
                match_count: 10
            });
        });
        it('should handle search errors', async () => {
            mockSupabase.rpc.mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue(mockErrorResponse)
            }));
            await expect(GuidelineService.hybridSearch(mockSearchQuery))
                .rejects
                .toThrow('Database error');
        });
    });
    describe('rrf_hybridSearch', () => {
        it('should perform reciprocal rank fusion search', async () => {
            OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
            mockSupabase.rpc.mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue(mockSuccessResponse)
            }));
            const result = await GuidelineService.rrf_hybridSearch(mockSearchQuery);
            expect(result.guidelines).toEqual([expect.objectContaining({ id: 1 })]);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('rrf_hybrid_search_guidelines', {
                query_text: mockSearchQuery.query,
                query_embedding: mockEmbedding,
                k: 60.0,
                similarity_threshold: 0.7,
                match_count: 10
            });
        });
        it('should handle search errors', async () => {
            mockSupabase.rpc.mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue(mockErrorResponse)
            }));
            await expect(GuidelineService.rrf_hybridSearch(mockSearchQuery))
                .rejects
                .toThrow('Database error');
        });
    });
    describe('search', () => {
        it('should route to correct search method based on type', async () => {
            const mockSearchOptions = {
                ...mockSearchQuery,
                search_type: 'semantic'
            };
            const semanticSearchSpy = jest.spyOn(GuidelineService, 'semanticSearch')
                .mockResolvedValue(mockSearchResponse);
            const result = await GuidelineService.search(mockSearchOptions);
            expect(result).toEqual(mockSearchResponse);
            expect(semanticSearchSpy).toHaveBeenCalledWith(mockSearchOptions);
            semanticSearchSpy.mockRestore();
        });
        it('should default to semantic search when no type specified', async () => {
            const semanticSearchSpy = jest.spyOn(GuidelineService, 'semanticSearch')
                .mockResolvedValue(mockSearchResponse);
            const result = await GuidelineService.search(mockSearchQuery);
            expect(result).toEqual(mockSearchResponse);
            expect(semanticSearchSpy).toHaveBeenCalledWith(mockSearchQuery);
            semanticSearchSpy.mockRestore();
        });
        it('should throw error for invalid search type', async () => {
            await expect(GuidelineService.search({
                ...mockSearchQuery,
                search_type: 'invalid'
            }))
                .rejects
                .toThrow('Invalid search type: invalid');
        });
    });
});
//# sourceMappingURL=guidelines.service.test.js.map
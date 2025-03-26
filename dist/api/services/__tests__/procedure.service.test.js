import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { GuidelineService } from '../guidelines.service.js';
import { OpenAIService } from '../../services/openai.service.js';
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn()
}));
jest.mock('../../services/openai.service.js', () => ({
    OpenAIService: {
        createEmbedding: jest.fn()
    }
}));
describe('GuidelineService', () => {
    let mockSupabase;
    beforeEach(() => {
        const mockFrom = jest.fn().mockReturnThis();
        const mockSelect = jest.fn().mockReturnThis();
        const mockTextSearch = jest.fn().mockReturnThis();
        const mockEq = jest.fn().mockReturnThis();
        const mockRange = jest.fn().mockReturnThis();
        const mockOrder = jest.fn().mockReturnThis();
        const mockRpc = jest.fn().mockReturnThis();
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
        const mockGuidelines = [
            {
                id: 1,
                carrier_id: 1,
                title: 'Test Guideline 1',
                content: 'Test guideline content 1',
                category: 'Test',
                metadata: null,
                created_at: new Date('2024-01-01')
            },
            {
                id: 2,
                carrier_id: 1,
                title: 'Test Guideline 2',
                content: 'Test guideline content 2',
                category: 'Test',
                metadata: null,
                created_at: new Date('2024-01-02')
            }
        ];
        it('should return guidelines with pagination', async () => {
            const mockSelect = jest.fn()
                .mockResolvedValueOnce({ data: mockGuidelines, error: null });
            mockSupabase.from.mockReturnValue({
                select: mockSelect,
                textSearch: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                range: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis()
            });
            const result = await GuidelineService.searchGuidelines({
                page: 1,
                limit: 10
            });
            expect(result).toEqual({
                guidelines: expect.arrayContaining([
                    expect.objectContaining({ id: 1 }),
                    expect.objectContaining({ id: 2 })
                ]),
                total: 2,
                page: 1,
                limit: 10,
                total_pages: 1
            });
        });
        it('should apply search filters correctly', async () => {
            const mockSelect = jest.fn()
                .mockResolvedValueOnce({ data: [mockGuidelines[0]], error: null });
            const mockTextSearch = jest.fn().mockReturnThis();
            const mockEq = jest.fn().mockReturnThis();
            mockSupabase.from.mockReturnValue({
                select: mockSelect,
                textSearch: mockTextSearch,
                eq: mockEq,
                range: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis()
            });
            await GuidelineService.searchGuidelines({
                query: 'test',
                carrier_id: 1,
                category: 'Test'
            });
            expect(mockTextSearch).toHaveBeenCalledWith('content', 'test');
            expect(mockEq).toHaveBeenCalledWith('carrier_id', 1);
            expect(mockEq).toHaveBeenCalledWith('category', 'Test');
        });
        it('should handle database errors', async () => {
            const dbError = new Error('Database error');
            const mockSelect = jest.fn().mockResolvedValue({
                data: null,
                error: dbError
            });
            mockSupabase.from.mockReturnValue({
                select: mockSelect,
                textSearch: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                range: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis()
            });
            await expect(GuidelineService.searchGuidelines())
                .rejects
                .toThrow('Database error');
        });
    });
    describe('semanticSearch', () => {
        const mockEmbedding = [0.1, 0.2, 0.3];
        const mockGuidelines = [
            {
                id: 1,
                carrier_id: 1,
                title: 'Test Guideline 1',
                content: 'Test guideline content 1',
                category: 'Test',
                metadata: null,
                created_at: new Date('2024-01-01'),
                vector_similarity: 0.8
            }
        ];
        beforeEach(() => {
            OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
        });
        it('should perform semantic search using embeddings', async () => {
            const mockRpc = jest.fn().mockResolvedValue({
                data: mockGuidelines,
                error: null
            });
            mockSupabase.rpc.mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                data: mockGuidelines,
                error: null
            });
            const result = await GuidelineService.semanticSearch({
                query: 'test query',
                min_similarity: 0.7
            });
            expect(OpenAIService.createEmbedding).toHaveBeenCalledWith('test query');
            expect(mockSupabase.rpc).toHaveBeenCalledWith('match_guidelines', {
                query_embedding: mockEmbedding,
                similarity_threshold: 0.7,
                match_count: 10
            });
            expect(result.guidelines).toEqual(mockGuidelines);
        });
        it('should require a query string', async () => {
            await expect(GuidelineService.semanticSearch({}))
                .rejects
                .toThrow('Query is required for semantic search');
        });
        it('should handle embedding generation errors', async () => {
            OpenAIService.createEmbedding.mockRejectedValue(new Error('Embedding generation failed'));
            await expect(GuidelineService.semanticSearch({ query: 'test' }))
                .rejects
                .toThrow('Embedding generation failed');
        });
    });
    describe('hybridSearch', () => {
        const mockEmbedding = [0.1, 0.2, 0.3];
        const mockGuidelines = [
            {
                id: 1,
                carrier_id: 1,
                title: 'Test Guideline 1',
                content: 'Test guideline content 1',
                category: 'Test',
                metadata: null,
                created_at: new Date('2024-01-01'),
                text_similarity: 0.7,
                vector_similarity: 0.8,
                combined_similarity: 0.75
            }
        ];
        beforeEach(() => {
            OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
        });
        it('should perform hybrid search with text and vector similarity', async () => {
            mockSupabase.rpc.mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                data: mockGuidelines,
                error: null
            });
            const result = await GuidelineService.hybridSearch({
                query: 'test query',
                text_weight: 0.3,
                vector_weight: 0.7
            });
            expect(mockSupabase.rpc).toHaveBeenCalledWith('hybrid_search_guidelines', {
                query_text: 'test query',
                query_embedding: mockEmbedding,
                text_weight: 0.3,
                vector_weight: 0.7,
                similarity_threshold: GuidelineService.DEFAULT_MIN_SIMILARITY,
                match_count: 10
            });
            expect(result.guidelines[0]).toHaveProperty('text_similarity');
            expect(result.guidelines[0]).toHaveProperty('vector_similarity');
            expect(result.guidelines[0]).toHaveProperty('combined_similarity');
        });
        it('should apply carrier and category filters', async () => {
            const mockEq = jest.fn().mockReturnValue({
                data: mockGuidelines,
                error: null
            });
            mockSupabase.rpc.mockReturnValue({
                eq: mockEq
            });
            await GuidelineService.hybridSearch({
                query: 'test',
                carrier_id: 1,
                category: 'Test'
            });
            expect(mockEq).toHaveBeenCalledWith('carrier_id', 1);
            expect(mockEq).toHaveBeenCalledWith('category', 'Test');
        });
    });
    describe('rrf_hybridSearch', () => {
        const mockEmbedding = [0.1, 0.2, 0.3];
        const mockGuidelines = [
            {
                id: 1,
                carrier_id: 1,
                title: 'Test Guideline 1',
                content: 'Test guideline content 1',
                category: 'Test',
                metadata: null,
                created_at: new Date('2024-01-01'),
                text_similarity: 0.7,
                vector_similarity: 0.8,
                rrf_score: 0.75,
                explanation: {
                    text_rank: 1,
                    vector_rank: 2,
                    final_rank: 1
                }
            }
        ];
        beforeEach(() => {
            OpenAIService.createEmbedding.mockResolvedValue(mockEmbedding);
        });
        it('should perform RRF hybrid search', async () => {
            mockSupabase.rpc.mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                data: mockGuidelines,
                error: null
            });
            const result = await GuidelineService.rrf_hybridSearch({
                query: 'test query',
                rrf_k: 60.0
            });
            expect(mockSupabase.rpc).toHaveBeenCalledWith('rrf_hybrid_search_guidelines', {
                query_text: 'test query',
                query_embedding: mockEmbedding,
                k: 60.0,
                similarity_threshold: GuidelineService.DEFAULT_MIN_SIMILARITY,
                match_count: 10
            });
            expect(result.guidelines[0]).toHaveProperty('rrf_score');
            expect(result.guidelines[0]).toHaveProperty('explanation');
        });
        it('should use default RRF k value when not provided', async () => {
            mockSupabase.rpc.mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                data: mockGuidelines,
                error: null
            });
            await GuidelineService.rrf_hybridSearch({
                query: 'test query'
            });
            expect(mockSupabase.rpc).toHaveBeenCalledWith('rrf_hybrid_search_guidelines', expect.objectContaining({
                k: GuidelineService.DEFAULT_RRF_K
            }));
        });
    });
    describe('search', () => {
        it('should route to correct search method based on type', async () => {
            const semanticSearchSpy = jest.spyOn(GuidelineService, 'semanticSearch')
                .mockResolvedValue({ guidelines: [], total: 0, page: 1, limit: 10, total_pages: 0 });
            const textSearchSpy = jest.spyOn(GuidelineService, 'textSearch')
                .mockResolvedValue({ guidelines: [], total: 0, page: 1, limit: 10, total_pages: 0 });
            const hybridSearchSpy = jest.spyOn(GuidelineService, 'hybridSearch')
                .mockResolvedValue({ guidelines: [], total: 0, page: 1, limit: 10, total_pages: 0 });
            const rrfHybridSearchSpy = jest.spyOn(GuidelineService, 'rrf_hybridSearch')
                .mockResolvedValue({ guidelines: [], total: 0, page: 1, limit: 10, total_pages: 0 });
            await GuidelineService.search({ query: 'test', search_type: 'semantic' });
            expect(semanticSearchSpy).toHaveBeenCalled();
            await GuidelineService.search({ query: 'test', search_type: 'text' });
            expect(textSearchSpy).toHaveBeenCalled();
            await GuidelineService.search({ query: 'test', search_type: 'hybrid' });
            expect(hybridSearchSpy).toHaveBeenCalled();
            await GuidelineService.search({ query: 'test', search_type: 'rrf_hybrid' });
            expect(rrfHybridSearchSpy).toHaveBeenCalled();
            semanticSearchSpy.mockRestore();
            textSearchSpy.mockRestore();
            hybridSearchSpy.mockRestore();
            rrfHybridSearchSpy.mockRestore();
        });
        it('should default to semantic search when no type specified', async () => {
            const semanticSearchSpy = jest.spyOn(GuidelineService, 'semanticSearch')
                .mockResolvedValue({ guidelines: [], total: 0, page: 1, limit: 10, total_pages: 0 });
            await GuidelineService.search({ query: 'test' });
            expect(semanticSearchSpy).toHaveBeenCalled();
            semanticSearchSpy.mockRestore();
        });
        it('should throw error for invalid search type', async () => {
            await expect(GuidelineService.search({
                query: 'test',
                search_type: 'invalid'
            }))
                .rejects
                .toThrow('Invalid search type: invalid');
        });
    });
});
//# sourceMappingURL=procedure.service.test.js.map
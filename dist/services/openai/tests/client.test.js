import { OpenAIClient } from '../client.js';
import { setupTestEnv, resetAll, mockEmbeddingResponse, mockRateLimitError, MockNetworkError } from './setup.js';
import { OpenAIError } from '../types.js';
jest.mock('openai', () => {
    return {
        OpenAI: jest.fn().mockImplementation(() => ({
            embeddings: {
                create: jest.fn(),
            },
        })),
    };
});
describe('OpenAIClient', () => {
    beforeEach(() => {
        setupTestEnv();
        resetAll();
        jest.clearAllMocks();
    });
    describe('getInstance', () => {
        it('should return the same instance on multiple calls', () => {
            const instance1 = OpenAIClient.getInstance();
            const instance2 = OpenAIClient.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe('createEmbedding', () => {
        it('should create embeddings successfully', async () => {
            const client = OpenAIClient.getInstance();
            const mockCreate = jest.spyOn(client['client'].embeddings, 'create');
            mockCreate.mockResolvedValueOnce(mockEmbeddingResponse);
            const result = await client.createEmbedding('test input');
            expect(result).toEqual([mockEmbeddingResponse.data[0].embedding]);
            expect(mockCreate).toHaveBeenCalledWith({
                input: 'test input',
                model: 'text-embedding-3-small',
            });
        });
        it('should handle rate limit errors with retry', async () => {
            const client = OpenAIClient.getInstance();
            const mockCreate = jest.spyOn(client['client'].embeddings, 'create');
            mockCreate
                .mockRejectedValueOnce(mockRateLimitError)
                .mockResolvedValueOnce(mockEmbeddingResponse);
            const result = await client.createEmbedding('test input');
            expect(result).toEqual([mockEmbeddingResponse.data[0].embedding]);
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });
        it('should handle network errors with retry', async () => {
            const client = OpenAIClient.getInstance();
            const mockCreate = jest.spyOn(client['client'].embeddings, 'create');
            const networkError = new MockNetworkError('ECONNRESET', 'Connection reset');
            mockCreate
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(mockEmbeddingResponse);
            const result = await client.createEmbedding('test input');
            expect(result).toEqual([mockEmbeddingResponse.data[0].embedding]);
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });
        it('should throw OpenAIError for non-retryable errors', async () => {
            const client = OpenAIClient.getInstance();
            const mockCreate = jest.spyOn(client['client'].embeddings, 'create');
            const apiError = new Error('Invalid API key');
            mockCreate.mockRejectedValueOnce(apiError);
            await expect(client.createEmbedding('test input')).rejects.toBeInstanceOf(OpenAIError);
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });
        it('should respect rate limits', async () => {
            const client = OpenAIClient.getInstance();
            const mockCreate = jest.spyOn(client['client'].embeddings, 'create');
            mockCreate.mockResolvedValue(mockEmbeddingResponse);
            const promises = Array(5).fill(null).map(() => client.createEmbedding('test input'));
            const results = await Promise.all(promises);
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result).toEqual([mockEmbeddingResponse.data[0].embedding]);
            });
        });
    });
});
//# sourceMappingURL=client.test.js.map
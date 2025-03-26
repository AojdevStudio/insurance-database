import { APIError } from 'openai';
import { OpenAIClient } from '../client.js';
import { resetConfig } from '../config.js';
export function setupTestEnv() {
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MAX_RETRIES = '3';
    process.env.OPENAI_RATE_LIMIT_RPM = '200';
    process.env.OPENAI_TIMEOUT_MS = '30000';
}
export function resetAll() {
    resetConfig();
    OpenAIClient.resetInstance();
}
export const mockEmbeddingResponse = {
    object: 'list',
    data: [
        {
            object: 'embedding',
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
};
export function createMockAPIError(status, message, code, headers = {}) {
    return new APIError(status, message, code, headers);
}
export const mockRateLimitError = createMockAPIError(429, 'Rate limit exceeded', 'rate_limit_exceeded', { 'retry-after': '30' });
export class MockNetworkError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'MockNetworkError';
    }
}
//# sourceMappingURL=setup.js.map
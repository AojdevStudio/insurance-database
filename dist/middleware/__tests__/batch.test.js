import { batchMiddleware } from '../batch.js';
import { Logger } from '../../utils/logging.js';
const mockBatchService = {
    addToBatch: jest.fn(),
    getBatchSize: jest.fn(),
    getBatchItems: jest.fn(),
    processBatch: jest.fn(),
    clearBatch: jest.fn()
};
jest.mock('../../utils/logging.js', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }))
}));
describe('Batch Middleware', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = {
            method: 'GET',
            path: '/test',
            originalUrl: '/test?param=value',
            headers: {}
        };
        res = {
            statusCode: 200,
            json: jest.fn(),
            setHeader: jest.fn(),
            getHeaders: jest.fn().mockReturnValue({}),
            status: jest.fn().mockReturnThis()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });
    it('should skip batching for non-batchable endpoints', async () => {
        const config = {
            batchableEndpoints: ['/batch']
        };
        const middleware = batchMiddleware(mockBatchService, config);
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(mockBatchService.addToBatch).not.toHaveBeenCalled();
    });
    it('should add request to batch and process when max size is reached', async () => {
        const config = {
            maxBatchSize: 2,
            batchableEndpoints: ['/test']
        };
        mockBatchService.getBatchSize.mockReturnValue(2);
        mockBatchService.processBatch.mockResolvedValue([
            { data: 'result1' },
            { data: 'result2' }
        ]);
        const middleware = batchMiddleware(mockBatchService, config);
        await middleware(req, res, next);
        expect(mockBatchService.addToBatch).toHaveBeenCalled();
        expect(mockBatchService.processBatch).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith('result1');
    });
    it('should add request to batch and wait for timer when first request', async () => {
        const config = {
            maxWaitTime: 50,
            batchableEndpoints: ['/test']
        };
        mockBatchService.getBatchSize.mockReturnValueOnce(1).mockReturnValueOnce(1);
        mockBatchService.processBatch.mockResolvedValue([{ data: 'result' }]);
        const middleware = batchMiddleware(mockBatchService, config);
        await middleware(req, res, next);
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(mockBatchService.addToBatch).toHaveBeenCalled();
        expect(mockBatchService.processBatch).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith('result');
    });
    it('should handle batch processing errors', async () => {
        const config = {
            batchableEndpoints: ['/test'],
            errorHandler: jest.fn()
        };
        const error = new Error('Batch error');
        mockBatchService.getBatchSize.mockReturnValue(1);
        mockBatchService.processBatch.mockRejectedValue(error);
        const middleware = batchMiddleware(mockBatchService, config);
        await middleware(req, res, next);
        expect(config.errorHandler).toHaveBeenCalledWith(error);
        expect(next).toHaveBeenCalledWith(error);
    });
    it('should handle empty batch results', async () => {
        const config = {
            batchableEndpoints: ['/test']
        };
        mockBatchService.getBatchSize.mockReturnValue(1);
        mockBatchService.getBatchItems.mockReturnValue([]);
        const middleware = batchMiddleware(mockBatchService, config);
        await middleware(req, res, next);
        expect(mockBatchService.processBatch).not.toHaveBeenCalled();
    });
    it('should use custom batch key generator', async () => {
        const config = {
            batchableEndpoints: ['/test'],
            batchKeyGenerator: () => 'custom-key'
        };
        mockBatchService.getBatchSize.mockReturnValue(1);
        mockBatchService.processBatch.mockResolvedValue([{ data: 'result' }]);
        const middleware = batchMiddleware(mockBatchService, config);
        await middleware(req, res, next);
        expect(mockBatchService.addToBatch).toHaveBeenCalledWith('custom-key', expect.any(Object));
    });
    it('should track batch metrics', async () => {
        const config = {
            batchableEndpoints: ['/test']
        };
        mockBatchService.getBatchSize.mockReturnValue(1);
        mockBatchService.processBatch.mockResolvedValue([{ data: 'result' }]);
        const middleware = batchMiddleware(mockBatchService, config);
        await middleware(req, res, next);
        const logger = new Logger('batch-middleware');
        expect(logger.debug).toHaveBeenCalledWith('Batch metrics', expect.any(Object));
    });
});
//# sourceMappingURL=batch.test.js.map
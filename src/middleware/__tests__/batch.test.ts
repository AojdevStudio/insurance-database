import { Request, Response, NextFunction } from 'express';
import { batchMiddleware, BatchConfig } from '../batch.js';
import { BatchService } from '../../services/batch.service.js';
import { Logger } from '../../utils/logging.js';

// Define mock BatchService interface
interface MockBatchService {
  addToBatch: jest.Mock;
  getBatchSize: jest.Mock;
  getBatchItems: jest.Mock;
  processBatch: jest.Mock;
  clearBatch: jest.Mock;
}

// Create mock BatchService
const mockBatchService: MockBatchService = {
  addToBatch: jest.fn(),
  getBatchSize: jest.fn(),
  getBatchItems: jest.fn(),
  processBatch: jest.fn(),
  clearBatch: jest.fn()
};

// Mock Logger
jest.mock('../../utils/logging.js', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Batch Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

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

    // Clear mock calls
    jest.clearAllMocks();
  });

  it('should skip batching for non-batchable endpoints', async () => {
    const config: BatchConfig = {
      batchableEndpoints: ['/batch']
    };

    const middleware = batchMiddleware(mockBatchService as unknown as BatchService<any, any>, config);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockBatchService.addToBatch).not.toHaveBeenCalled();
  });

  it('should add request to batch and process when max size is reached', async () => {
    const config: BatchConfig = {
      maxBatchSize: 2,
      batchableEndpoints: ['/test']
    };

    mockBatchService.getBatchSize.mockReturnValue(2);
    mockBatchService.processBatch.mockResolvedValue([
      { data: 'result1' },
      { data: 'result2' }
    ]);

    const middleware = batchMiddleware(mockBatchService as unknown as BatchService<any, any>, config);
    await middleware(req as Request, res as Response, next);

    expect(mockBatchService.addToBatch).toHaveBeenCalled();
    expect(mockBatchService.processBatch).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith('result1');
  });

  it('should add request to batch and wait for timer when first request', async () => {
    const config: BatchConfig = {
      maxWaitTime: 50,
      batchableEndpoints: ['/test']
    };

    mockBatchService.getBatchSize.mockReturnValueOnce(1).mockReturnValueOnce(1);
    mockBatchService.processBatch.mockResolvedValue([{ data: 'result' }]);

    const middleware = batchMiddleware(mockBatchService as unknown as BatchService<any, any>, config);
    await middleware(req as Request, res as Response, next);

    // Wait for timer
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockBatchService.addToBatch).toHaveBeenCalled();
    expect(mockBatchService.processBatch).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith('result');
  });

  it('should handle batch processing errors', async () => {
    const config: BatchConfig = {
      batchableEndpoints: ['/test'],
      errorHandler: jest.fn()
    };

    const error = new Error('Batch error');
    mockBatchService.getBatchSize.mockReturnValue(1);
    mockBatchService.processBatch.mockRejectedValue(error);

    const middleware = batchMiddleware(mockBatchService as unknown as BatchService<any, any>, config);
    await middleware(req as Request, res as Response, next);

    expect(config.errorHandler).toHaveBeenCalledWith(error);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should handle empty batch results', async () => {
    const config: BatchConfig = {
      batchableEndpoints: ['/test']
    };

    mockBatchService.getBatchSize.mockReturnValue(1);
    mockBatchService.getBatchItems.mockReturnValue([]);

    const middleware = batchMiddleware(mockBatchService as unknown as BatchService<any, any>, config);
    await middleware(req as Request, res as Response, next);

    expect(mockBatchService.processBatch).not.toHaveBeenCalled();
  });

  it('should use custom batch key generator', async () => {
    const config: BatchConfig = {
      batchableEndpoints: ['/test'],
      batchKeyGenerator: () => 'custom-key'
    };

    mockBatchService.getBatchSize.mockReturnValue(1);
    mockBatchService.processBatch.mockResolvedValue([{ data: 'result' }]);

    const middleware = batchMiddleware(mockBatchService as unknown as BatchService<any, any>, config);
    await middleware(req as Request, res as Response, next);

    expect(mockBatchService.addToBatch).toHaveBeenCalledWith('custom-key', expect.any(Object));
  });

  it('should track batch metrics', async () => {
    const config: BatchConfig = {
      batchableEndpoints: ['/test']
    };

    mockBatchService.getBatchSize.mockReturnValue(1);
    mockBatchService.processBatch.mockResolvedValue([{ data: 'result' }]);

    const middleware = batchMiddleware(mockBatchService as unknown as BatchService<any, any>, config);
    await middleware(req as Request, res as Response, next);

    const logger = new Logger('batch-middleware');
    expect(logger.debug).toHaveBeenCalledWith('Batch metrics', expect.any(Object));
  });
}); 
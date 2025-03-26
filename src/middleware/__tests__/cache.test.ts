import { Request, Response, NextFunction } from 'express';
import { cacheMiddleware, CacheConfig } from '../cache.js';
import { RedisService } from '../../services/redis.service.js';
import { Logger } from '../../utils/logging.js';
import { RedisClientType } from 'redis';

// Mock RedisService
const mockRedisService = {
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  hSet: jest.fn().mockResolvedValue(undefined),
  hGet: jest.fn().mockResolvedValue(null),
  hGetAll: jest.fn().mockResolvedValue({}),
  clear: jest.fn().mockResolvedValue(undefined),
  client: {} as RedisClientType,
  config: {
    host: 'localhost',
    port: 6379
  },
  connected: false,
  setupEventHandlers: jest.fn()
} as unknown as jest.Mocked<RedisService>;

// Mock Logger
jest.mock('../../utils/logging.js', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Cache Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      originalUrl: '/test?param=value',
      headers: {}
    };

    res = {
      statusCode: 200,
      setHeader: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({}),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    next = jest.fn();

    // Clear mock calls
    jest.clearAllMocks();
  });

  it('should skip caching for non-GET requests', async () => {
    req.method = 'POST';
    const middleware = cacheMiddleware(mockRedisService);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockRedisService.get).not.toHaveBeenCalled();
  });

  it('should skip caching for excluded paths', async () => {
    req.url = '/health';
    const middleware = cacheMiddleware(mockRedisService);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockRedisService.get).not.toHaveBeenCalled();
  });

  it('should skip caching for authenticated requests', async () => {
    req.headers = { authorization: 'Bearer token' };
    const middleware = cacheMiddleware(mockRedisService);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockRedisService.get).not.toHaveBeenCalled();
  });

  it('should return cached response when available', async () => {
    const cachedData = {
      body: { data: 'test' },
      status: 200,
      headers: { 'content-type': 'application/json' }
    };
    mockRedisService.get.mockImplementationOnce(() => Promise.resolve(JSON.stringify(cachedData)));

    const middleware = cacheMiddleware(mockRedisService);
    await middleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(cachedData.body);
    expect(next).not.toHaveBeenCalled();
  });

  it('should cache successful responses', async () => {
    mockRedisService.get.mockImplementationOnce(() => Promise.resolve(null));

    const middleware = cacheMiddleware(mockRedisService);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();

    // Simulate response
    const responseBody = { data: 'test' };
    res.send!(responseBody);

    expect(mockRedisService.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"body":{"data":"test"}'),
      expect.any(Number)
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
  });

  it('should handle custom cache configuration', async () => {
    const config: CacheConfig = {
      ttl: 7200,
      prefix: 'custom:',
      exclude: () => false,
      keyGenerator: () => 'custom-key',
      cacheControl: 'private, max-age=7200'
    };

    mockRedisService.get.mockImplementationOnce(() => Promise.resolve(null));

    const middleware = cacheMiddleware(mockRedisService, config);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();

    // Simulate response
    const responseBody = { data: 'test' };
    res.send!(responseBody);

    expect(mockRedisService.set).toHaveBeenCalledWith(
      'custom:custom-key',
      expect.any(String),
      7200
    );
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=7200');
  });

  it('should handle cache errors gracefully', async () => {
    mockRedisService.get.mockImplementationOnce(() => Promise.reject(new Error('Redis error')));

    const middleware = cacheMiddleware(mockRedisService);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    const logger = new Logger('cache-middleware');
    expect(logger.error).toHaveBeenCalledWith('Cache error:', expect.any(Error));
  });

  it('should not cache error responses', async () => {
    mockRedisService.get.mockImplementationOnce(() => Promise.resolve(null));
    res.statusCode = 500;

    const middleware = cacheMiddleware(mockRedisService);
    await middleware(req as Request, res as Response, next);

    // Simulate error response
    const responseBody = { error: 'Internal Server Error' };
    res.send!(responseBody);

    expect(mockRedisService.set).not.toHaveBeenCalled();
  });
}); 
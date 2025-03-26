import { Request, Response, NextFunction } from 'express';
import { monitoringMiddleware, MonitoringConfig } from '../monitoring.js';
import { Logger } from '../../utils/logging.js';
import { trackRequestMetrics } from '../../utils/monitoring.js';

// Mock dependencies
jest.mock('../../utils/logging.js');
jest.mock('../../utils/monitoring.js');

describe('Monitoring Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      path: '/test',
      method: 'GET',
      headers: {},
      body: { test: 'data' }
    };

    res = {
      statusCode: 200,
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
      on: jest.fn()
    };

    next = jest.fn();

    // Clear mock calls
    jest.clearAllMocks();
  });

  it('should skip monitoring for excluded paths', async () => {
    const config: MonitoringConfig = {
      excludePaths: ['/test']
    };

    const middleware = monitoringMiddleware(config);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(trackRequestMetrics).not.toHaveBeenCalled();
  });

  it('should track request size when enabled', async () => {
    const config: MonitoringConfig = {
      enableSizeTracking: true
    };

    const middleware = monitoringMiddleware(config);
    await middleware(req as Request, res as Response, next);

    expect(trackRequestMetrics).toHaveBeenCalledWith(
      expect.any(Function),
      'request-size'
    );
  });

  it('should track response size for JSON responses', async () => {
    const config: MonitoringConfig = {
      enableSizeTracking: true
    };

    const middleware = monitoringMiddleware(config);
    await middleware(req as Request, res as Response, next);

    const jsonResponse = { data: 'test' };
    res.json!(jsonResponse);

    expect(trackRequestMetrics).toHaveBeenCalledWith(
      expect.any(Function),
      'response-size'
    );
  });

  it('should track response size for string responses', async () => {
    const config: MonitoringConfig = {
      enableSizeTracking: true
    };

    const middleware = monitoringMiddleware(config);
    await middleware(req as Request, res as Response, next);

    const stringResponse = 'test response';
    res.send!(stringResponse);

    expect(trackRequestMetrics).toHaveBeenCalledWith(
      expect.any(Function),
      'response-size'
    );
  });

  it('should track cache metrics when enabled', async () => {
    const config: MonitoringConfig = {
      enableCacheTracking: true
    };

    const middleware = monitoringMiddleware(config);
    await middleware(req as Request, res as Response, next);

    res.setHeader!('x-cache', 'HIT');

    expect(trackRequestMetrics).toHaveBeenCalledWith(
      expect.any(Function),
      'cache-metrics'
    );
  });

  it('should track request metrics on finish', async () => {
    const middleware = monitoringMiddleware();
    await middleware(req as Request, res as Response, next);

    // Simulate request finish
    const finishCallback = (res.on as jest.Mock).mock.calls[0][1];
    finishCallback();

    expect(trackRequestMetrics).toHaveBeenCalledWith(
      expect.any(Function),
      'request-metrics'
    );
  });

  it('should respect sampling rate', async () => {
    const config: MonitoringConfig = {
      sampleRate: 0
    };

    const middleware = monitoringMiddleware(config);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(trackRequestMetrics).not.toHaveBeenCalled();
  });

  it('should track memory usage', async () => {
    const middleware = monitoringMiddleware();
    await middleware(req as Request, res as Response, next);

    // Simulate request finish
    const finishCallback = (res.on as jest.Mock).mock.calls[0][1];
    finishCallback();

    const metricsCallback = (trackRequestMetrics as jest.Mock).mock.calls[0][0];
    await metricsCallback();

    const logger = new Logger('monitoring-middleware');
    expect(logger.debug).toHaveBeenCalledWith(
      'Request metrics',
      expect.objectContaining({
        memory: expect.any(Object)
      })
    );
  });

  it('should preserve original response methods', async () => {
    const middleware = monitoringMiddleware();
    await middleware(req as Request, res as Response, next);

    const jsonResponse = { data: 'test' };
    res.json!(jsonResponse);
    expect(res.json).toHaveBeenCalledWith(jsonResponse);

    const stringResponse = 'test';
    res.send!(stringResponse);
    expect(res.send).toHaveBeenCalledWith(stringResponse);

    const headerName = 'test-header';
    const headerValue = 'test-value';
    res.setHeader!(headerName, headerValue);
    expect(res.setHeader).toHaveBeenCalledWith(headerName, headerValue);
  });
}); 
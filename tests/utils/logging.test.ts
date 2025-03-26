import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import type { SupabaseClient, PostgrestResponse, PostgrestError } from '@supabase/supabase-js';
import { mockFrom, createMockResponse, MockPostgrestResponse, mockSupabaseClient } from '../setup.js';
import { Logger, LogLevel } from '../../src/utils/logging.js';

jest.mock('@supabase/supabase-js');

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  service?: string;
}

describe('Logging Module', () => {
  const mockClient = {
    from: mockFrom,
    supabaseUrl: 'http://localhost:54321',
    supabaseKey: 'test-key',
    auth: {
      getSession: jest.fn(),
      signOut: jest.fn()
    },
    storage: { from: jest.fn() },
    rpc: jest.fn()
  } as unknown as SupabaseClient;

  let logger: Logger;
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    logger = new Logger('test-service');
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('log levels', () => {
    it('should log debug messages', async () => {
      const mockInsertResult = createMockResponse<LogEntry>(null);
      const mockInsert = jest.fn<() => Promise<MockPostgrestResponse<LogEntry>>>()
        .mockResolvedValue(mockInsertResult);
      mockFrom.mockReturnValue({ insert: mockInsert });

      await logger.debug('test debug message', { test: true });
      expect(mockFrom).toHaveBeenCalledWith('logs');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should log info messages', async () => {
      const mockInsertResult = createMockResponse<LogEntry>(null);
      const mockInsert = jest.fn<() => Promise<MockPostgrestResponse<LogEntry>>>()
        .mockResolvedValue(mockInsertResult);
      mockFrom.mockReturnValue({ insert: mockInsert });

      await logger.info('test info message', { test: true });
      expect(mockFrom).toHaveBeenCalledWith('logs');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should log warning messages', async () => {
      const mockInsertResult = createMockResponse<LogEntry>(null);
      const mockInsert = jest.fn<() => Promise<MockPostgrestResponse<LogEntry>>>()
        .mockResolvedValue(mockInsertResult);
      mockFrom.mockReturnValue({ insert: mockInsert });

      await logger.warn('test warning message', { test: true });
      expect(mockFrom).toHaveBeenCalledWith('logs');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should log error messages', async () => {
      const mockInsertResult = createMockResponse<LogEntry>(null);
      const mockInsert = jest.fn<() => Promise<MockPostgrestResponse<LogEntry>>>()
        .mockResolvedValue(mockInsertResult);
      mockFrom.mockReturnValue({ insert: mockInsert });

      const error = new Error('test error');
      await logger.error('test error message', error, { test: true });
      expect(mockFrom).toHaveBeenCalledWith('logs');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle logging errors gracefully', async () => {
      const mockError: PostgrestError = {
        message: 'Database error',
        details: 'Test error details',
        hint: 'Test hint',
        code: 'TEST123',
        name: 'PostgrestError'
      };
      const mockInsertResult = createMockResponse<LogEntry>(null, mockError);
      const mockInsert = jest.fn<() => Promise<MockPostgrestResponse<LogEntry>>>()
        .mockResolvedValue(mockInsertResult);
      mockFrom.mockReturnValue({ insert: mockInsert });

      await logger.info('Test error', { error: true });
      expect(mockFrom).toHaveBeenCalledWith('logs');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('getLogs', () => {
    it('should retrieve logs', async () => {
      const mockLogs: LogEntry[] = [
        { level: LogLevel.INFO, message: 'Test 1', timestamp: new Date().toISOString(), service: 'test-service' },
        { level: LogLevel.ERROR, message: 'Test 2', timestamp: new Date().toISOString(), service: 'test-service' }
      ];
      
      const mockQueryResult = createMockResponse<LogEntry[]>(mockLogs);
      const mockLimit = jest.fn<() => Promise<MockPostgrestResponse<LogEntry[]>>>()
        .mockResolvedValue(mockQueryResult);
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({ select: mockSelect });

      const logs = await logger.getLogs();
      expect(logs).toEqual(mockLogs);
      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('should handle retrieval errors gracefully', async () => {
      const mockError: PostgrestError = {
        message: 'Database error',
        details: 'Test error details',
        hint: 'Test hint',
        code: 'TEST123',
        name: 'PostgrestError'
      };
      const mockQueryResult = createMockResponse<LogEntry[]>(null, mockError);
      const mockLimit = jest.fn<() => Promise<MockPostgrestResponse<LogEntry[]>>>()
        .mockResolvedValue(mockQueryResult);
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({ select: mockSelect });

      const logs = await logger.getLogs();
      expect(logs).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should filter logs by level', async () => {
      const mockQueryResult = createMockResponse<LogEntry[]>([]);
      const mockLimit = jest.fn<() => Promise<MockPostgrestResponse<LogEntry[]>>>()
        .mockResolvedValue(mockQueryResult);
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({ select: mockSelect });

      await logger.getLogs(LogLevel.ERROR);
      expect(mockFrom).toHaveBeenCalledWith('logs');
    });
  });
});

describe('Logging Module Performance', () => {
  let logger: Logger;
  let mockInsert: jest.Mock;
  let mockInsertResult: MockPostgrestResponse<LogEntry>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock response and spies
    mockInsertResult = createMockResponse<LogEntry>(null);
    mockInsert = jest.fn().mockResolvedValue(mockInsertResult as any);
    mockFrom.mockReturnValue({ insert: mockInsert });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Initialize logger with service name
    logger = new Logger('performance-tests');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle multiple log entries efficiently', async () => {
    const startTime = performance.now();
    const iterations = 100;
    const promises = [];

    for (let i = 0; i < iterations; i++) {
      promises.push(logger.info('Performance test message', { iteration: i }));
    }

    await Promise.all(promises);
    const endTime = performance.now();
    const timePerOperation = (endTime - startTime) / iterations;

    // Verify mock calls
    expect(mockFrom).toHaveBeenCalledTimes(iterations);
    expect(mockInsert).toHaveBeenCalledTimes(iterations);
    expect(timePerOperation).toBeLessThan(5);
  });

  it('should handle concurrent logging operations', async () => {
    const startTime = performance.now();
    const concurrentOperations = 10;
    const promises = [];

    for (let i = 0; i < concurrentOperations; i++) {
      const context = { operationId: i };
      promises.push(
        Promise.all([
          logger.debug('Debug message', context),
          logger.info('Info message', context),
          logger.warn('Warning message', context),
          logger.error('Error message', new Error(`Test error ${i}`))
        ])
      );
    }

    await Promise.all(promises);
    const endTime = performance.now();
    const timePerBatch = (endTime - startTime) / concurrentOperations;

    // Verify mock calls (4 log calls per operation)
    expect(mockFrom).toHaveBeenCalledTimes(concurrentOperations * 4);
    expect(mockInsert).toHaveBeenCalledTimes(concurrentOperations * 4);
    expect(timePerBatch).toBeLessThan(20);
  });

  it('should maintain performance with large context objects', async () => {
    const largeContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      metadata: {
        browser: 'test-browser',
        version: '1.0.0',
        platform: 'test-platform',
        timestamp: new Date().toISOString(),
        details: Array(100).fill('test-detail')
      }
    };

    const startTime = performance.now();
    await logger.info('Large context test', largeContext);
    const endTime = performance.now();
    const operationTime = endTime - startTime;

    // Verify mock calls
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(operationTime).toBeLessThan(10);
  });

  it('should handle logging errors during high load', async () => {
    // Simulate database errors
    const mockError: PostgrestError = {
      message: 'Database error',
      details: 'Test error details',
      hint: 'Test hint',
      code: 'TEST123',
      name: 'PostgrestError'
    };
    
    // Update mock to return error response
    mockInsert.mockResolvedValue(createMockResponse<LogEntry>(null, mockError) as any);

    const promises = Array(50).fill(null).map((_, i) => 
      logger.error('High load error test', new Error(`Test error ${i}`))
    );

    await Promise.all(promises);

    // Verify error handling
    expect(mockFrom).toHaveBeenCalledTimes(50);
    expect(mockInsert).toHaveBeenCalledTimes(50);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
}); 
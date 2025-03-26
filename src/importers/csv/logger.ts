import winston from 'winston';
import { ImportProgress, ImportError, ImportResult } from './types.js';

/**
 * Custom log levels for CSV import operations
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  progress: 3,
  performance: 4,
  debug: 5,
};

/**
 * Custom colors for different log levels
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  progress: 'blue',
  performance: 'magenta',
  debug: 'cyan',
};

// Add colors to Winston
winston.addColors(colors);

/**
 * Custom format for structured logging
 */
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

/**
 * Create the logger instance
 */
export const logger = winston.createLogger({
  levels,
  level: 'debug',
  format: customFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File transport for production
    new winston.transports.File({
      filename: 'logs/csv-import-error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/csv-import.log',
    }),
  ],
});

/**
 * Log progress update
 */
export const logProgress = (progress: ImportProgress): void => {
  logger.log('progress', 'Import progress update', { progress });
};

/**
 * Log error
 */
export const logError = (error: ImportError): void => {
  logger.error('Import error occurred', { error });
};

/**
 * Log performance metrics
 */
export const logPerformance = (metrics: ImportResult['performance']): void => {
  logger.log('performance', 'Performance metrics', { metrics });
};

/**
 * Log import completion
 */
export const logCompletion = (result: ImportResult): void => {
  logger.info('Import operation completed', { result });
};

/**
 * Log debug information
 */
export const logDebug = (message: string, meta?: Record<string, unknown>): void => {
  logger.debug(message, meta);
};

/**
 * Create a child logger with additional context
 */
export const createContextLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

// Ensure logs directory exists
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  console.error('Failed to create logs directory:', error);
} 
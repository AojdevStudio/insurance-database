import { Request, Response, NextFunction } from 'express';
import { APIError, ErrorResponse } from '../types/error.js';
import { ValidationError } from 'express-validator';
import winston from 'winston';

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error('Error handling request:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle validation errors from express-validator
  if (Array.isArray(err)) {
    const response: ErrorResponse = {
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.reduce((acc: Record<string, string[]>, error: ValidationError) => {
          const field = error.type === 'field' ? error.path : 'general';
          if (!acc[field]) {
            acc[field] = [];
          }
          acc[field].push(error.msg);
          return acc;
        }, {}),
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle custom API errors
  if (err instanceof APIError) {
    const response: ErrorResponse = {
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    };
    res.status(err.status).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  };
  res.status(500).json(response);
}

/**
 * Not found middleware
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const err = new APIError('Resource not found', 404, 'NOT_FOUND');
  next(err);
} 
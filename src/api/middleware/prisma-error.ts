import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { APIError } from '../types/error.js';

/**
 * Middleware to handle Prisma-specific errors
 * Maps Prisma error codes to appropriate HTTP status codes and error messages
 */
export function handlePrismaErrors(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle Prisma Client known request errors (with error codes)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = err.meta?.target as string[] || ['unknown field'];
        const error = new APIError(
          `Unique constraint violated on ${target.join(', ')}`,
          409,
          'UNIQUE_CONSTRAINT_VIOLATION',
          { fields: target }
        );
        next(error);
        return;
      }

      // Record not found
      case 'P2025': {
        const error = new APIError(
          err.message || 'Record not found',
          404,
          'NOT_FOUND',
          err.meta
        );
        next(error);
        return;
      }

      // Foreign key constraint violation
      case 'P2003': {
        const field = (err.meta?.field_name as string) || 'unknown field';
        const error = new APIError(
          `Foreign key constraint failed on field: ${field}`,
          400,
          'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          { field }
        );
        next(error);
        return;
      }

      // Required field constraint violation
      case 'P2011': {
        const error = new APIError(
          err.message || 'Required field constraint violation',
          400,
          'REQUIRED_FIELD_CONSTRAINT_VIOLATION',
          err.meta
        );
        next(error);
        return;
      }

      // Input validation error
      case 'P2007': {
        const error = new APIError(
          err.message || 'Invalid input data',
          400,
          'INVALID_INPUT',
          err.meta
        );
        next(error);
        return;
      }

      // Default case for other Prisma error codes
      default: {
        const error = new APIError(
          `Database error: ${err.message}`,
          500,
          `PRISMA_ERROR_${err.code}`,
          { 
            code: err.code,
            meta: err.meta 
          }
        );
        next(error);
        return;
      }
    }
  }

  // Handle Prisma validation errors (usually from invalid inputs/types)
  if (err instanceof Prisma.PrismaClientValidationError) {
    const error = new APIError(
      'Validation error: Invalid input data format',
      400,
      'PRISMA_VALIDATION_ERROR'
    );
    next(error);
    return;
  }

  // Handle Prisma initialization errors
  if (err instanceof Prisma.PrismaClientInitializationError) {
    const error = new APIError(
      'Database connection failed',
      503,
      'DATABASE_CONNECTION_ERROR',
      { message: err.message }
    );
    next(error);
    return;
  }

  // Handle Prisma unexpected errors
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const error = new APIError(
      'Unexpected database error',
      500,
      'UNEXPECTED_DATABASE_ERROR'
    );
    next(error);
    return;
  }

  // If not a Prisma error, pass to the next error handler
  next(err);
}

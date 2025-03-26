import { Request } from 'express';

/**
 * Extended request interface with pagination
 */
export interface PaginatedRequest extends Request {
  query: {
    page?: string;
    limit?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Parse pagination parameters from request
 */
export function getPaginationParams(req: PaginatedRequest): PaginationParams {
  const page = Math.max(parseInt(req.query.page || String(DEFAULT_PAGE), 10), 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || String(DEFAULT_LIMIT), 10), 1),
    MAX_LIMIT
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
} 
import { z } from 'zod';
import { Request } from 'express';

// Base procedure type
export interface IProcedure {
  id: number;
  code: string;
  description: string;
  category: string | null;
  subcategory: string | null;
  created_at: Date;
}

// Procedure requirements type
export interface IProcedureRequirement {
  id: number;
  carrier_id: number;
  procedure_id: number;
  requirements: Record<string, any>;
  created_at: Date;
}

// Documentation requirements type
export interface IDocumentationRequirement {
  id: number;
  carrier_id: number;
  procedure_id: number;
  requirements: string[];
  examples: string[];
  created_at: Date;
}

// Combined procedure requirements response type
export interface IProcedureWithRequirements extends IProcedure {
  carrier_requirements?: IProcedureRequirement[];
  documentation_requirements?: IDocumentationRequirement[];
}

// Search/List query parameters
export interface IProcedureSearchQuery {
  query?: string;
  category?: string;
  page?: number;
  limit?: number;
  sort_by?: 'code' | 'description' | 'category' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// Request types with typed query/params
export interface IProcedureSearchRequest extends Request {
  query: IProcedureSearchQuery;
}

export interface IProcedureDetailRequest extends Request {
  params: {
    code: string;
  };
}

// Validation schemas
export const ProcedureSearchQuerySchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
  sort_by: z.enum(['code', 'description', 'category', 'created_at']).optional().default('code'),
  sort_order: z.enum(['asc', 'desc']).optional().default('asc')
});

export const ProcedureCodeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{5}$/, 'Invalid procedure code format')
}); 
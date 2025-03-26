import { z } from 'zod';
import { Request } from 'express';

// Base guideline interface
export interface IGuideline {
  id: number;
  carrier_id: number;
  title: string;
  content: string;
  category: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
}

// API response interface
export interface IGuidelineResponse extends Omit<IGuideline, 'created_at'> {
  created_at: string; // ISO string format for API responses
  similarity?: number; // Optional similarity score for semantic search
}

// Search query parameters
export interface IGuidelineSearchQuery {
  query?: string;
  carrier_id?: number;
  category?: string;
  page?: number;
  limit?: number;
  min_similarity?: number;
  search_type?: 'text' | 'semantic' | 'hybrid' | 'rrf_hybrid';
  text_weight?: number;
  vector_weight?: number;
  rrf_k?: number;
}

export interface ISearchScoreExplanation {
  text_rank?: number;
  vector_rank?: number;
  text_contribution?: number;
  vector_contribution?: number;
}

export interface IGuidelineSearchResult extends IGuideline {
  text_similarity?: number;
  vector_similarity?: number;
  combined_similarity?: number;
  rrf_score?: number;
  explanation?: ISearchScoreExplanation;
}

// Search response interface
export interface IGuidelineSearchResponse {
  guidelines: IGuidelineSearchResult[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Express request with typed query
export interface IGuidelineSearchRequest extends Request {
  query: IGuidelineSearchQuery;
}

// Validation schemas
export const GuidelineSearchQuerySchema = z.object({
  query: z.string().optional(),
  carrier_id: z.string().regex(/^\d+$/).transform(Number).optional(),
  category: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  min_similarity: z.string().regex(/^\d*\.?\d+$/).transform(Number).optional(),
});

export const GuidelineSemanticSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  carrier_id: z.string().regex(/^\d+$/).transform(Number).optional(),
  category: z.string().optional(),
  min_similarity: z.string().regex(/^\d*\.?\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
}); 
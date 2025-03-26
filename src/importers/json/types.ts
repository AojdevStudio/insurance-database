import { z } from 'zod';

// Base schema for insurance data
export const InsuranceRecordSchema = z.object({
  id: z.string().uuid().optional(),
  carrier: z.string(),
  policy_type: z.string(),
  coverage_limits: z.number().positive(),
  premium: z.number().positive(),
  effective_date: z.string().datetime(),
  expiration_date: z.string().datetime(),
  status: z.enum(['active', 'expired', 'cancelled', 'pending']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type InsuranceRecord = z.infer<typeof InsuranceRecordSchema>;

// Configuration for the JSON importer
export interface JsonImportConfig {
  batchSize: number;
  maxMemoryMB: number;
  progressInterval: number;
}

// Default configuration values
export const DEFAULT_CONFIG: JsonImportConfig = {
  batchSize: 100,
  maxMemoryMB: 100,
  progressInterval: 100,
};

// Import statistics for monitoring
export interface ImportStats {
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  startTime: Date;
  endTime?: Date;
  memoryUsage: number;
  batchesProcessed: number;
}

// Error types
export enum ImportErrorType {
  VALIDATION = 'validation',
  PARSING = 'parsing',
  MEMORY = 'memory',
  IO = 'io',
}

export interface ImportError {
  type: ImportErrorType;
  message: string;
  record?: unknown;
  line?: number;
} 
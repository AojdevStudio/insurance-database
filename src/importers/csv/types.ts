/**
 * CSV Import System Types
 * Defines the core types for the insurance database CSV import functionality
 */

import { z } from 'zod';

/**
 * Basic configuration for CSV import operations
 */
export interface CSVImportConfig {
  batchSize: number;
  maxMemoryMB: number;
  progressUpdateInterval: number;
  maxFileSize: number; // in bytes
}

/**
 * Default configuration values
 */
export const DEFAULT_IMPORT_CONFIG: CSVImportConfig = {
  batchSize: 100,
  maxMemoryMB: 100,
  progressUpdateInterval: 100,
  maxFileSize: 1024 * 1024 * 1024, // 1GB
};

/**
 * Progress tracking interface
 */
export interface ImportProgress {
  totalRows: number;
  processedRows: number;
  failedRows: number;
  currentBatch: number;
  memoryUsage: number;
  startTime: Date;
  endTime?: Date;
  status: ImportStatus;
}

/**
 * Import operation status
 */
export enum ImportStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Error types that can occur during import
 */
export enum ImportErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error information
 */
export interface ImportError {
  type: ImportErrorType;
  message: string;
  row?: number;
  column?: string;
  originalValue?: unknown;
}

/**
 * Result of an import operation
 */
export interface ImportResult {
  success: boolean;
  progress: ImportProgress;
  errors: ImportError[];
  performance: {
    rowsPerSecond: number;
    totalTimeMs: number;
    peakMemoryUsage: number;
  };
}

/**
 * Base insurance record structure
 * This will be extended based on specific import requirements
 */
export interface InsuranceRecord {
  id?: string;
  carrierName: string;
  policyType: string;
  coverageDetails: string;
  effectiveDate: Date;
  expirationDate: Date;
  premium: number;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Zod schema for insurance record validation
 */
export const InsuranceRecordSchema = z.object({
  id: z.string().optional(),
  carrierName: z.string().min(1, 'Carrier name is required'),
  policyType: z.string().min(1, 'Policy type is required'),
  coverageDetails: z.string(),
  effectiveDate: z.date(),
  expirationDate: z.date(),
  premium: z.number().positive('Premium must be positive'),
  status: z.string().min(1, 'Status is required'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
}).refine(
  (data) => data.effectiveDate < data.expirationDate,
  'Effective date must be before expiration date'
);

/**
 * Type for validated insurance record
 */
export type ValidatedInsuranceRecord = z.infer<typeof InsuranceRecordSchema>;

/**
 * Event types for progress updates
 */
export enum ImportEventType {
  PROGRESS_UPDATE = 'PROGRESS_UPDATE',
  ERROR = 'ERROR',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
}

/**
 * Progress event structure
 */
export interface ImportEvent {
  type: ImportEventType;
  data: ImportProgress | ImportError | ImportResult;
  timestamp: Date;
} 
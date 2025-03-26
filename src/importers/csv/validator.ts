import { z } from 'zod';
import {
  InsuranceRecordSchema,
  ImportError,
  ImportErrorType,
  CSVImportConfig,
  DEFAULT_IMPORT_CONFIG,
} from './types.js';
import { logError, logDebug } from './logger.js';

/**
 * CSV row validation schema
 * Extends InsuranceRecordSchema with CSV-specific validations
 */
export const CSVRowSchema = z.object({
  ...InsuranceRecordSchema.shape,
  _rowNumber: z.number().int().positive(),
  _raw: z.record(z.string(), z.unknown()),
});

export type CSVRow = z.infer<typeof CSVRowSchema>;

/**
 * Options for CSV validation
 */
export interface ValidationOptions {
  batchSize?: number;
  maxMemoryMB?: number;
  progressUpdateInterval?: number;
  maxFileSize?: number;
  strictMode?: boolean;
  allowUnknownColumns?: boolean;
  requiredColumns?: string[];
  dateFormat?: string;
}

/**
 * Validates a single CSV row
 */
export const validateRow = async (
  row: Record<string, unknown>,
  rowNumber: number,
  options: ValidationOptions = {}
): Promise<{ valid: boolean; data?: CSVRow; error?: ImportError }> => {
  try {
    const enrichedRow = {
      ...row,
      _rowNumber: rowNumber,
      _raw: { ...row },
      // Convert date strings to Date objects
      effectiveDate: row.effectiveDate ? new Date(row.effectiveDate as string) : undefined,
      expirationDate: row.expirationDate ? new Date(row.expirationDate as string) : undefined,
    };

    // Validate with Zod schema
    const validatedData = await CSVRowSchema.parseAsync(enrichedRow);

    return {
      valid: true,
      data: validatedData,
    };
  } catch (error) {
    const importError: ImportError = {
      type: ImportErrorType.VALIDATION_ERROR,
      message: error instanceof Error ? error.message : 'Unknown validation error',
      row: rowNumber,
      originalValue: row,
    };

    logError(importError);
    return {
      valid: false,
      error: importError,
    };
  }
};

/**
 * Validates a batch of CSV rows
 */
export const validateBatch = async (
  rows: Record<string, unknown>[],
  startRow: number,
  options: ValidationOptions = {}
): Promise<{
  valid: boolean;
  validRows: CSVRow[];
  errors: ImportError[];
}> => {
  const batchSize = options.batchSize || DEFAULT_IMPORT_CONFIG.batchSize;
  const results = await Promise.all(
    rows.slice(0, batchSize).map((row, index) =>
      validateRow(row, startRow + index, options)
    )
  );

  const validRows = results
    .filter((result): result is { valid: true; data: CSVRow } => 
      result.valid && result.data !== undefined
    )
    .map(result => result.data);

  const errors = results
    .filter((result): result is { valid: false; error: ImportError } => 
      !result.valid && result.error !== undefined
    )
    .map(result => result.error);

  logDebug('Batch validation complete', {
    batchSize: rows.length,
    validCount: validRows.length,
    errorCount: errors.length,
  });

  return {
    valid: errors.length === 0,
    validRows,
    errors,
  };
};

/**
 * Validates CSV headers
 */
export const validateHeaders = (
  headers: string[],
  options: ValidationOptions = {}
): { valid: boolean; error?: ImportError } => {
  const requiredColumns = options.requiredColumns || [
    'carrierName',
    'policyType',
    'coverageDetails',
    'effectiveDate',
    'expirationDate',
    'premium',
    'status',
  ];

  const missingColumns = requiredColumns.filter(
    col => !headers.includes(col)
  );

  if (missingColumns.length > 0) {
    const error: ImportError = {
      type: ImportErrorType.VALIDATION_ERROR,
      message: `Missing required columns: ${missingColumns.join(', ')}`,
      column: missingColumns.join(', '),
    };
    logError(error);
    return { valid: false, error };
  }

  if (!options.allowUnknownColumns) {
    const unknownColumns = headers.filter(
      col => !requiredColumns.includes(col) && !['id', 'createdAt', 'updatedAt'].includes(col)
    );

    if (unknownColumns.length > 0) {
      const error: ImportError = {
        type: ImportErrorType.VALIDATION_ERROR,
        message: `Unknown columns found: ${unknownColumns.join(', ')}`,
        column: unknownColumns.join(', '),
      };
      logError(error);
      return { valid: false, error };
    }
  }

  return { valid: true };
}; 
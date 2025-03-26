import { parse } from 'csv-parse';
import { Readable } from 'stream';

/**
 * Represents the possible validation error types for CSV processing
 */
export type CSVValidationErrorType = 
  | 'COLUMN_COUNT_MISMATCH'
  | 'MISSING_REQUIRED_COLUMN'
  | 'INVALID_DATE_FORMAT'
  | 'INVALID_ENUM_VALUE'
  | 'INVALID_FIELD_LENGTH'
  | 'EMPTY_REQUIRED_FIELD';

/**
 * Represents valid plan types in the system
 */
export enum PlanType {
  PPO = 'PPO',
  HMO = 'HMO',
  EPO = 'EPO'
}

/**
 * Valid field names for CSV records
 */
export type CSVFieldName = 'carrier_name' | 'network_name' | 'plan_type' | 'effective_date';

/**
 * Represents field length constraints
 */
export type CSVFieldLengths = {
  [K in CSVFieldName]?: number;
};

/**
 * Represents the structure of a CSV record
 */
export interface CSVRecord {
  carrier_name: string;
  network_name: string;
  plan_type: PlanType;
  effective_date: string;
  [key: string]: string | PlanType; // Allow additional fields with string or PlanType values
}

/**
 * Represents a CSV validation error
 */
export interface CSVValidationError {
  row: number;
  type: CSVValidationErrorType;
  message: string;
}

/**
 * Represents the result of CSV validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: CSVValidationError[];
  data?: CSVRecord[];
}

/**
 * Custom error class for CSV parsing errors
 */
export class CSVParsingError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly lines?: number
  ) {
    super(message);
    this.name = 'CSVParsingError';
  }
}

const REQUIRED_COLUMNS: CSVFieldName[] = ['carrier_name', 'network_name', 'plan_type', 'effective_date'];
const VALID_PLAN_TYPES: PlanType[] = Object.values(PlanType);
const MAX_FIELD_LENGTHS: CSVFieldLengths = {
  carrier_name: 100,
  network_name: 100,
  plan_type: 10,
};

/**
 * Type guard to check if an error is a CSVParsingError
 */
function isCSVParsingError(error: unknown): error is CSVParsingError {
  return error instanceof CSVParsingError ||
    (error instanceof Error && 'code' in error && 'lines' in error);
}

/**
 * Validates a CSV string against predefined rules and returns validation results
 * @param csvContent - The CSV content as a string
 * @returns Promise<ValidationResult> - The validation result containing errors if any
 */
export async function validateCSV(csvContent: string): Promise<ValidationResult> {
  const errors: CSVValidationError[] = [];
  const data: CSVRecord[] = [];
  
  // Split content into lines for pre-validation
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) {
    return {
      isValid: false,
      errors: [{
        row: 0,
        type: 'COLUMN_COUNT_MISMATCH',
        message: 'CSV file is empty'
      }]
    };
  }

  // Validate headers first
  const headerValidation = validateHeaders(lines[0]);
  if (!headerValidation.isValid) {
    return headerValidation;
  }

  const headerColumns = lines[0].split(',').map(h => h.trim());

  // Pre-validate column counts before parsing
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(',').map(c => c.trim());
    if (columns.length !== headerColumns.length) {
      return {
        isValid: false,
        errors: [{
          row: i + 1,
          type: 'COLUMN_COUNT_MISMATCH',
          message: `Row has ${columns.length} columns but header has ${headerColumns.length} columns`
        }]
      };
    }
  }

  // Create a readable stream from the CSV content
  const stream = Readable.from([csvContent]);
  
  try {
    // Create parser with configuration
    const parser = stream.pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false
    }));

    // Process each row
    for await (const record of parser) {
      const rowIndex = data.length + 1;
      const rowErrors = validateRow(record as Partial<CSVRecord>, rowIndex);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      }
      data.push(record as CSVRecord);
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : undefined
    };
  } catch (error) {
    if (isCSVParsingError(error)) {
      const errorLine = error.lines || 0;
      return {
        isValid: false,
        errors: [{
          row: errorLine,
          type: 'COLUMN_COUNT_MISMATCH',
          message: `Row has inconsistent number of columns`
        }]
      };
    }

    // Handle other parsing errors
    return {
      isValid: false,
      errors: [{
        row: 0,
        type: 'COLUMN_COUNT_MISMATCH',
        message: 'Failed to parse CSV: ' + (error instanceof Error ? error.message : String(error))
      }]
    };
  }
}

function validateHeaders(headerRow: string): ValidationResult {
  const headers = headerRow.split(',').map(h => h.trim());
  const errors: CSVValidationError[] = [];

  // Check for required columns
  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      errors.push({
        row: 0,
        type: 'MISSING_REQUIRED_COLUMN',
        message: `Required column "${required}" is missing`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateRow(record: Partial<CSVRecord>, rowIndex: number): CSVValidationError[] {
  const errors: CSVValidationError[] = [];

  // Validate field lengths
  for (const [field, maxLength] of Object.entries(MAX_FIELD_LENGTHS)) {
    const fieldName = field as CSVFieldName;
    const value = record[fieldName];
    if (typeof value === 'string' && value.length > maxLength) {
      errors.push({
        row: rowIndex,
        type: 'INVALID_FIELD_LENGTH',
        message: `${field} exceeds maximum length of ${maxLength} characters`
      });
    }
  }

  // Validate required fields are not empty
  for (const field of REQUIRED_COLUMNS) {
    const value = record[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        row: rowIndex,
        type: 'EMPTY_REQUIRED_FIELD',
        message: `Required field "${field}" is empty`
      });
    }
  }

  // Validate plan type enum
  const planType = record.plan_type;
  if (planType && !VALID_PLAN_TYPES.includes(planType as PlanType)) {
    errors.push({
      row: rowIndex,
      type: 'INVALID_ENUM_VALUE',
      message: `Invalid plan_type value. Expected one of: ${VALID_PLAN_TYPES.join(', ')}`
    });
  }

  // Validate date format
  if (record.effective_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(record.effective_date)) {
      errors.push({
        row: rowIndex,
        type: 'INVALID_DATE_FORMAT',
        message: 'Invalid date format in column "effective_date". Expected YYYY-MM-DD'
      });
    } else {
      // Check if it's a valid date
      const date = new Date(record.effective_date);
      if (isNaN(date.getTime())) {
        errors.push({
          row: rowIndex,
          type: 'INVALID_DATE_FORMAT',
          message: 'Invalid date value in column "effective_date"'
        });
      }
    }
  }

  return errors;
} 
import { InsuranceRecord, InsuranceRecordSchema, ImportError, ImportErrorType } from './types.js';
import { Logger } from 'winston';

export class JsonValidator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validates a single insurance record
   * @param record The record to validate
   * @returns Tuple of [validated record, error if any]
   */
  public validateRecord(record: unknown): [InsuranceRecord | null, ImportError | null] {
    try {
      const validatedRecord = InsuranceRecordSchema.parse(record);
      return [validatedRecord, null];
    } catch (error) {
      const importError: ImportError = {
        type: ImportErrorType.VALIDATION,
        message: error instanceof Error ? error.message : 'Unknown validation error',
        record: record,
      };
      
      this.logger.error('Validation error', {
        error: importError,
        record: record,
      });

      return [null, importError];
    }
  }

  /**
   * Validates an array of records in batch
   * @param records Array of records to validate
   * @returns Object containing valid records and errors
   */
  public validateBatch(records: unknown[]): {
    validRecords: InsuranceRecord[];
    errors: ImportError[];
  } {
    const validRecords: InsuranceRecord[] = [];
    const errors: ImportError[] = [];

    for (const [index, record] of records.entries()) {
      const [validRecord, error] = this.validateRecord(record);
      
      if (validRecord) {
        validRecords.push(validRecord);
      }
      
      if (error) {
        error.line = index + 1;
        errors.push(error);
      }
    }

    return { validRecords, errors };
  }
} 
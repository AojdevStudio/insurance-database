import { createReadStream } from 'fs';
import { parse as csvParse } from 'csv-parse';
import { Transform } from 'stream';
import { BufferEncoding } from 'node:buffer';
import {
  ImportProgress,
  ImportResult,
  ImportError,
  ImportErrorType,
  ImportStatus,
  CSVImportConfig,
  DEFAULT_IMPORT_CONFIG,
} from './types.js';
import { validateBatch, validateHeaders, ValidationOptions } from './validator.js';
import { logProgress, logError, logPerformance, logCompletion, logDebug } from './logger.js';

/**
 * CSV Parser options
 */
export interface ParserOptions extends CSVImportConfig, ValidationOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
  skipRows?: number;
  encoding?: BufferEncoding;
}

/**
 * Default parser options
 */
const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  ...DEFAULT_IMPORT_CONFIG,
  delimiter: ',',
  skipEmptyLines: true,
  skipRows: 0,
  encoding: 'utf-8',
  strictMode: true,
  allowUnknownColumns: false,
};

/**
 * CSV Parser class
 */
export class CSVParser {
  private options: ParserOptions;
  private progress: ImportProgress;
  private startTime: Date;
  private currentBatch: Record<string, unknown>[] = [];
  private headers: string[] = [];

  constructor(options: Partial<ParserOptions> = {}) {
    this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
    this.startTime = new Date();
    this.progress = {
      totalRows: 0,
      processedRows: 0,
      failedRows: 0,
      currentBatch: 0,
      memoryUsage: 0,
      startTime: this.startTime,
      status: ImportStatus.PENDING,
    };
  }

  /**
   * Parse a CSV file
   */
  public async parseFile(filePath: string): Promise<ImportResult> {
    try {
      this.progress.status = ImportStatus.IN_PROGRESS;
      logDebug('Starting CSV parse', { filePath, options: this.options });

      const result = await new Promise<ImportResult>((resolve, reject) => {
        const errors: ImportError[] = [];
        const parser = csvParse({
          delimiter: this.options.delimiter,
          skipEmptyLines: this.options.skipEmptyLines,
          from: this.options.skipRows + 2, // +1 for header row
          columns: true,
        });

        const fileStream = createReadStream(filePath, {
          encoding: this.options.encoding,
          highWaterMark: 64 * 1024, // 64KB chunks
        });

        // Process rows in batches
        const transformer = new Transform({
          objectMode: true,
          async transform(row, encoding, callback) {
            try {
              this.push(row);
              callback();
            } catch (error) {
              callback(error);
            }
          },
        });

        // Handle headers
        parser.once('headers', async (headers: string[]) => {
          this.headers = headers;
          const headerValidation = validateHeaders(headers, this.options);
          if (!headerValidation.valid && headerValidation.error) {
            errors.push(headerValidation.error);
            parser.end();
            return;
          }
        });

        // Process each row
        parser.on('readable', async () => {
          let row: Record<string, unknown>;
          while ((row = parser.read()) !== null) {
            this.currentBatch.push(row);
            this.progress.totalRows++;

            if (this.currentBatch.length >= this.options.batchSize) {
              await this.processBatch();
            }
          }
        });

        // Handle completion
        parser.on('end', async () => {
          try {
            // Process remaining rows
            if (this.currentBatch.length > 0) {
              await this.processBatch();
            }

            this.progress.status = ImportStatus.COMPLETED;
            this.progress.endTime = new Date();

            const result: ImportResult = {
              success: this.progress.failedRows === 0,
              progress: this.progress,
              errors,
              performance: this.calculatePerformance(),
            };

            logCompletion(result);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });

        // Handle errors
        parser.on('error', (error) => {
          const importError: ImportError = {
            type: ImportErrorType.PARSING_ERROR,
            message: error.message,
          };
          errors.push(importError);
          logError(importError);
          reject(error);
        });

        // Start processing
        fileStream.pipe(parser).pipe(transformer);
      });

      return result;
    } catch (error) {
      this.progress.status = ImportStatus.FAILED;
      const importError: ImportError = {
        type: ImportErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error during parsing',
      };
      logError(importError);
      throw error;
    }
  }

  /**
   * Process a batch of rows
   */
  private async processBatch(): Promise<void> {
    try {
      this.progress.currentBatch++;
      const startRow = this.progress.processedRows + 1;

      const validation = await validateBatch(
        this.currentBatch,
        startRow,
        this.options
      );

      this.progress.processedRows += validation.validRows.length;
      this.progress.failedRows += validation.errors.length;
      this.progress.memoryUsage = process.memoryUsage().heapUsed;

      // Log progress at configured intervals
      if (this.progress.processedRows % this.options.progressUpdateInterval === 0) {
        logProgress(this.progress);
        logPerformance(this.calculatePerformance());
      }

      // Clear the batch
      this.currentBatch = [];
    } catch (error) {
      const importError: ImportError = {
        type: ImportErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error processing batch',
      };
      logError(importError);
      throw error;
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformance(): ImportResult['performance'] {
    const now = new Date();
    const totalTimeMs = now.getTime() - this.startTime.getTime();
    const rowsPerSecond = totalTimeMs > 0 
      ? (this.progress.processedRows / totalTimeMs) * 1000 
      : 0;

    return {
      rowsPerSecond,
      totalTimeMs,
      peakMemoryUsage: this.progress.memoryUsage,
    };
  }
} 
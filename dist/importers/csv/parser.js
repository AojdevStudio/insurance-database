import { createReadStream } from 'fs';
import { parse as csvParse } from 'csv-parse';
import { Transform } from 'stream';
import { ImportErrorType, ImportStatus, DEFAULT_IMPORT_CONFIG, } from './types.js';
import { validateBatch, validateHeaders } from './validator.js';
import { logProgress, logError, logPerformance, logCompletion, logDebug } from './logger.js';
const DEFAULT_PARSER_OPTIONS = {
    ...DEFAULT_IMPORT_CONFIG,
    delimiter: ',',
    skipEmptyLines: true,
    skipRows: 0,
    encoding: 'utf-8',
    strictMode: true,
    allowUnknownColumns: false,
};
export class CSVParser {
    options;
    progress;
    startTime;
    currentBatch = [];
    headers = [];
    constructor(options = {}) {
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
    async parseFile(filePath) {
        try {
            this.progress.status = ImportStatus.IN_PROGRESS;
            logDebug('Starting CSV parse', { filePath, options: this.options });
            const result = await new Promise((resolve, reject) => {
                const errors = [];
                const parser = csvParse({
                    delimiter: this.options.delimiter,
                    skipEmptyLines: this.options.skipEmptyLines,
                    from: this.options.skipRows + 2,
                    columns: true,
                });
                const fileStream = createReadStream(filePath, {
                    encoding: this.options.encoding,
                    highWaterMark: 64 * 1024,
                });
                const transformer = new Transform({
                    objectMode: true,
                    async transform(row, encoding, callback) {
                        try {
                            this.push(row);
                            callback();
                        }
                        catch (error) {
                            callback(error);
                        }
                    },
                });
                parser.once('headers', async (headers) => {
                    this.headers = headers;
                    const headerValidation = validateHeaders(headers, this.options);
                    if (!headerValidation.valid && headerValidation.error) {
                        errors.push(headerValidation.error);
                        parser.end();
                        return;
                    }
                });
                parser.on('readable', async () => {
                    let row;
                    while ((row = parser.read()) !== null) {
                        this.currentBatch.push(row);
                        this.progress.totalRows++;
                        if (this.currentBatch.length >= this.options.batchSize) {
                            await this.processBatch();
                        }
                    }
                });
                parser.on('end', async () => {
                    try {
                        if (this.currentBatch.length > 0) {
                            await this.processBatch();
                        }
                        this.progress.status = ImportStatus.COMPLETED;
                        this.progress.endTime = new Date();
                        const result = {
                            success: this.progress.failedRows === 0,
                            progress: this.progress,
                            errors,
                            performance: this.calculatePerformance(),
                        };
                        logCompletion(result);
                        resolve(result);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                parser.on('error', (error) => {
                    const importError = {
                        type: ImportErrorType.PARSING_ERROR,
                        message: error.message,
                    };
                    errors.push(importError);
                    logError(importError);
                    reject(error);
                });
                fileStream.pipe(parser).pipe(transformer);
            });
            return result;
        }
        catch (error) {
            this.progress.status = ImportStatus.FAILED;
            const importError = {
                type: ImportErrorType.UNKNOWN_ERROR,
                message: error instanceof Error ? error.message : 'Unknown error during parsing',
            };
            logError(importError);
            throw error;
        }
    }
    async processBatch() {
        try {
            this.progress.currentBatch++;
            const startRow = this.progress.processedRows + 1;
            const validation = await validateBatch(this.currentBatch, startRow, this.options);
            this.progress.processedRows += validation.validRows.length;
            this.progress.failedRows += validation.errors.length;
            this.progress.memoryUsage = process.memoryUsage().heapUsed;
            if (this.progress.processedRows % this.options.progressUpdateInterval === 0) {
                logProgress(this.progress);
                logPerformance(this.calculatePerformance());
            }
            this.currentBatch = [];
        }
        catch (error) {
            const importError = {
                type: ImportErrorType.UNKNOWN_ERROR,
                message: error instanceof Error ? error.message : 'Unknown error processing batch',
            };
            logError(importError);
            throw error;
        }
    }
    calculatePerformance() {
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
//# sourceMappingURL=parser.js.map
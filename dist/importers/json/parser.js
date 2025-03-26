import { createReadStream } from 'fs';
import { Transform } from 'stream';
import pLimit from 'p-limit';
import { EventEmitter } from 'events';
import { DEFAULT_CONFIG, ImportErrorType } from './types.js';
import { JsonValidator } from './validator.js';
export class JsonParser extends EventEmitter {
    config;
    logger;
    validator;
    stats;
    currentBatch = [];
    constructor(logger, config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = logger;
        this.validator = new JsonValidator(logger);
        this.stats = this.initializeStats();
    }
    initializeStats() {
        return {
            totalRecords: 0,
            processedRecords: 0,
            errorCount: 0,
            startTime: new Date(),
            memoryUsage: 0,
            batchesProcessed: 0,
        };
    }
    checkMemoryUsage() {
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        this.stats.memoryUsage = memoryUsage;
        if (memoryUsage > this.config.maxMemoryMB) {
            this.emit('error', {
                type: ImportErrorType.MEMORY,
                message: `Memory usage exceeded limit: ${memoryUsage.toFixed(2)}MB`,
            });
            return false;
        }
        return true;
    }
    async processBatch(records) {
        const { validRecords, errors } = this.validator.validateBatch(records);
        this.stats.processedRecords += records.length;
        this.stats.errorCount += errors.length;
        this.stats.batchesProcessed++;
        if (errors.length > 0) {
            this.emit('errors', errors);
        }
        if (validRecords.length > 0) {
            this.emit('records', validRecords);
        }
        if (this.stats.processedRecords % this.config.progressInterval === 0) {
            this.emit('progress', {
                ...this.stats,
                currentMemoryUsage: this.stats.memoryUsage,
            });
        }
    }
    async parseFile(filePath) {
        this.stats = this.initializeStats();
        this.currentBatch = [];
        const limiter = pLimit(1);
        const processPromises = [];
        return new Promise((resolve, reject) => {
            const jsonStream = new Transform({
                objectMode: true,
                transform: (chunk, encoding, callback) => {
                    if (!this.checkMemoryUsage()) {
                        callback(new Error('Memory limit exceeded'));
                        return;
                    }
                    this.currentBatch.push(chunk);
                    this.stats.totalRecords++;
                    if (this.currentBatch.length >= this.config.batchSize) {
                        const batchToProcess = [...this.currentBatch];
                        this.currentBatch = [];
                        processPromises.push(limiter(() => this.processBatch(batchToProcess)));
                    }
                    callback();
                },
                flush: async (callback) => {
                    if (this.currentBatch.length > 0) {
                        processPromises.push(limiter(() => this.processBatch(this.currentBatch)));
                    }
                    try {
                        await Promise.all(processPromises);
                        callback();
                    }
                    catch (error) {
                        callback(error);
                    }
                }
            });
            createReadStream(filePath, { encoding: 'utf-8' })
                .on('error', (error) => {
                this.logger.error('Error reading file', { error });
                reject(error);
            })
                .pipe(jsonStream)
                .on('error', (error) => {
                this.logger.error('Error processing JSON', { error });
                reject(error);
            })
                .on('finish', () => {
                this.stats.endTime = new Date();
                resolve(this.stats);
            });
        });
    }
}
//# sourceMappingURL=parser.js.map
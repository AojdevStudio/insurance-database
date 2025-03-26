export class SizeOptimizationRule {
    name = 'size';
    priority = 100;
    optimize(chunks, options) {
        const startTime = performance.now();
        const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const optimizedChunks = [];
        let currentChunk = '';
        for (const chunk of chunks) {
            if (currentChunk.length + chunk.length <= options.targetChunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + chunk;
            }
            else {
                if (currentChunk) {
                    optimizedChunks.push(currentChunk);
                }
                currentChunk = chunk;
            }
        }
        if (currentChunk) {
            optimizedChunks.push(currentChunk);
        }
        const optimizedSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const processingTime = performance.now() - startTime;
        const memoryUsage = process.memoryUsage().heapUsed;
        return {
            chunks: optimizedChunks,
            metrics: {
                originalSize,
                optimizedSize,
                compressionRatio: optimizedSize / originalSize,
                processingTime,
                memoryUsage,
                averageChunkSize: optimizedSize / optimizedChunks.length,
                contentQuality: 1.0
            },
            metadata: {
                rule: 'size',
                parameters: {
                    targetSize: options.targetChunkSize
                }
            }
        };
    }
    validate(result, options) {
        return result.chunks.every(chunk => chunk.length >= options.minChunkSize &&
            chunk.length <= options.maxChunkSize);
    }
}
export class MemoryOptimizationRule {
    name = 'memory';
    priority = 90;
    optimize(chunks, options) {
        const startTime = performance.now();
        const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const optimizedChunks = [];
        let memoryUsed = process.memoryUsage().heapUsed;
        const batchSize = Math.max(1, Math.floor(chunks.length / 10));
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const processedBatch = this.processBatch(batch, options);
            optimizedChunks.push(...processedBatch);
            const currentMemory = process.memoryUsage().heapUsed;
            if (options.memoryLimit && currentMemory > options.memoryLimit) {
                if (global.gc) {
                    global.gc();
                }
            }
        }
        const optimizedSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const processingTime = performance.now() - startTime;
        const finalMemoryUsage = process.memoryUsage().heapUsed;
        return {
            chunks: optimizedChunks,
            metrics: {
                originalSize,
                optimizedSize,
                compressionRatio: optimizedSize / originalSize,
                processingTime,
                memoryUsage: finalMemoryUsage,
                averageChunkSize: optimizedSize / optimizedChunks.length,
                contentQuality: 0.9
            },
            metadata: {
                rule: 'memory',
                parameters: {
                    batchSize,
                    memoryUsed: finalMemoryUsage - memoryUsed
                }
            }
        };
    }
    processBatch(batch, options) {
        const processed = [];
        let current = '';
        for (const chunk of batch) {
            if (current.length + chunk.length <= options.targetChunkSize) {
                current += (current ? ' ' : '') + chunk;
            }
            else {
                if (current) {
                    processed.push(current);
                }
                current = chunk;
            }
        }
        if (current) {
            processed.push(current);
        }
        return processed;
    }
    validate(result, options) {
        if (!options.memoryLimit) {
            return true;
        }
        return result.metrics.memoryUsage <= options.memoryLimit;
    }
}
export class SpeedOptimizationRule {
    name = 'speed';
    priority = 80;
    optimize(chunks, options) {
        const startTime = performance.now();
        const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const optimizedChunks = chunks.map(chunk => {
            if (chunk.length > options.maxChunkSize) {
                return chunk.slice(0, options.maxChunkSize);
            }
            return chunk;
        });
        const processingTime = performance.now() - startTime;
        const optimizedSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        return {
            chunks: optimizedChunks,
            metrics: {
                originalSize,
                optimizedSize,
                compressionRatio: optimizedSize / originalSize,
                processingTime,
                memoryUsage: process.memoryUsage().heapUsed,
                averageChunkSize: optimizedSize / optimizedChunks.length,
                contentQuality: 0.8
            },
            metadata: {
                rule: 'speed',
                parameters: {
                    processingTime
                }
            }
        };
    }
    validate(result, options) {
        if (!options.processingTimeLimit) {
            return true;
        }
        return result.metrics.processingTime <= options.processingTimeLimit;
    }
}
export class ChunkOptimizer {
    options;
    rules = [];
    constructor(options) {
        this.options = options;
        if (!options.customRules || options.customRules.length === 0) {
            this.rules = [
                new SizeOptimizationRule(),
                new MemoryOptimizationRule(),
                new SpeedOptimizationRule()
            ];
        }
        else {
            this.rules = [...options.customRules].sort((a, b) => b.priority - a.priority);
        }
        this.validateOptions();
    }
    validateOptions() {
        const { targetChunkSize, minChunkSize, maxChunkSize } = this.options;
        if (targetChunkSize < minChunkSize || targetChunkSize > maxChunkSize) {
            throw new Error('Target chunk size must be between min and max chunk size');
        }
        if (minChunkSize < 0 || maxChunkSize < 0 || targetChunkSize < 0) {
            throw new Error('Chunk sizes cannot be negative');
        }
        if (this.options.overlapSize < 0) {
            throw new Error('Overlap size cannot be negative');
        }
    }
    optimize(chunks) {
        const startTime = performance.now();
        let currentChunks = [...chunks];
        let bestResult = null;
        for (const rule of this.rules) {
            const result = rule.optimize(currentChunks, this.options);
            if (!rule.validate(result, this.options)) {
                continue;
            }
            currentChunks = result.chunks;
            if (!bestResult || this.isBetterResult(result, bestResult)) {
                bestResult = result;
            }
        }
        if (!bestResult) {
            return this.createBaseResult(chunks, startTime);
        }
        return bestResult;
    }
    createBaseResult(chunks, startTime) {
        const originalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        return {
            chunks,
            metrics: {
                originalSize,
                optimizedSize: originalSize,
                compressionRatio: 1,
                processingTime: performance.now() - startTime,
                memoryUsage: process.memoryUsage().heapUsed,
                averageChunkSize: originalSize / chunks.length,
                contentQuality: 1.0
            },
            metadata: {
                optimizationStatus: 'none'
            }
        };
    }
    isBetterResult(newResult, currentBest) {
        const weights = {
            compressionRatio: 0.3,
            processingTime: 0.2,
            memoryUsage: 0.2,
            contentQuality: 0.3
        };
        const newScore = weights.compressionRatio * (1 / newResult.metrics.compressionRatio) +
            weights.processingTime * (1 / newResult.metrics.processingTime) +
            weights.memoryUsage * (1 / newResult.metrics.memoryUsage) +
            weights.contentQuality * newResult.metrics.contentQuality;
        const currentScore = weights.compressionRatio * (1 / currentBest.metrics.compressionRatio) +
            weights.processingTime * (1 / currentBest.metrics.processingTime) +
            weights.memoryUsage * (1 / currentBest.metrics.memoryUsage) +
            weights.contentQuality * currentBest.metrics.contentQuality;
        return newScore > currentScore;
    }
    addRule(rule) {
        this.rules.push(rule);
        this.rules.sort((a, b) => b.priority - a.priority);
    }
    removeRule(ruleName) {
        this.rules = this.rules.filter(rule => rule.name !== ruleName);
    }
}
//# sourceMappingURL=ChunkOptimizer.js.map
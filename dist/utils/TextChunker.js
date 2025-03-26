export var ChunkingStrategy;
(function (ChunkingStrategy) {
    ChunkingStrategy["FixedSize"] = "fixed-size";
    ChunkingStrategy["Sentence"] = "sentence";
    ChunkingStrategy["Recursive"] = "recursive";
})(ChunkingStrategy || (ChunkingStrategy = {}));
export class TextChunker {
    chunk(text, options) {
        this.validateOptions(options);
        switch (options.strategy) {
            case ChunkingStrategy.FixedSize:
                return this.chunkByFixedSize(text, options);
            case ChunkingStrategy.Sentence:
                return this.chunkBySentence(text, options);
            case ChunkingStrategy.Recursive:
                return this.chunkRecursively(text, options);
            default:
                throw new Error(`Unknown chunking strategy: ${options.strategy}`);
        }
    }
    validateOptions(options) {
        if (!options.strategy) {
            throw new Error('Chunking strategy is required');
        }
        if (options.strategy === ChunkingStrategy.FixedSize) {
            if (!options.chunkSize || options.chunkSize <= 0) {
                throw new Error('Chunk size must be a positive number');
            }
        }
        if (options.minSize && options.maxSize && options.minSize > options.maxSize) {
            throw new Error('Minimum size cannot be greater than maximum size');
        }
        if (options.overlap && options.overlap < 0) {
            throw new Error('Overlap size cannot be negative');
        }
    }
    chunkByFixedSize(text, options) {
        const { chunkSize = 1000, overlap = 0, minSize = 1, maxSize = chunkSize } = options;
        if (text.length === 0) {
            return [];
        }
        const chunks = [];
        let startPos = 0;
        while (startPos < text.length) {
            const endPos = Math.min(startPos + chunkSize, text.length);
            const content = text.slice(startPos, endPos);
            if (content.length >= minSize && content.length <= maxSize) {
                chunks.push({
                    content,
                    metadata: {
                        index: chunks.length,
                        startPosition: startPos,
                        endPosition: endPos,
                        strategy: ChunkingStrategy.FixedSize
                    }
                });
            }
            startPos = endPos - overlap;
        }
        if (options.minChunks && chunks.length < options.minChunks) {
            const avgSize = Math.floor(text.length / options.minChunks);
            return this.chunkByFixedSize(text, { ...options, chunkSize: avgSize });
        }
        return chunks;
    }
    chunkBySentence(text, options) {
        if (text.length === 0) {
            return [];
        }
        const sentenceRegex = /[.!?](?=\s+|$)(?<!Mr\.|Mrs\.|Dr\.|Ms\.|Prof\.|Sr\.|Jr\.)/g;
        const sentences = text.split(sentenceRegex).map(s => s.trim()).filter(Boolean);
        return sentences.map((sentence, index) => {
            const startPos = text.indexOf(sentence);
            const endPos = startPos + sentence.length;
            return {
                content: sentence,
                metadata: {
                    index,
                    startPosition: startPos,
                    endPosition: endPos,
                    strategy: ChunkingStrategy.Sentence
                }
            };
        });
    }
    chunkRecursively(text, options) {
        if (text.length === 0) {
            return [];
        }
        const { separators = ['\n\n', '\n'] } = options;
        const chunks = [];
        let currentText = text;
        let startOffset = 0;
        for (const separator of separators) {
            const parts = currentText.split(separator);
            if (parts.length > 1) {
                parts.forEach((part, index) => {
                    if (part.trim()) {
                        const startPos = text.indexOf(part, startOffset);
                        const endPos = startPos + part.length;
                        chunks.push({
                            content: part.trim(),
                            metadata: {
                                index: chunks.length,
                                startPosition: startPos,
                                endPosition: endPos,
                                strategy: ChunkingStrategy.Recursive
                            }
                        });
                        startOffset = endPos + separator.length;
                    }
                });
                break;
            }
        }
        if (chunks.length === 0 && text.trim()) {
            chunks.push({
                content: text.trim(),
                metadata: {
                    index: 0,
                    startPosition: 0,
                    endPosition: text.length,
                    strategy: ChunkingStrategy.Recursive
                }
            });
        }
        return chunks;
    }
}
//# sourceMappingURL=TextChunker.js.map
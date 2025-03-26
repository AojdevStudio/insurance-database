/**
 * Chunking strategies
 */
export enum ChunkingStrategy {
  FixedSize = 'fixed-size',
  Sentence = 'sentence',
  Recursive = 'recursive',
  Adaptive = 'adaptive'
}

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  index: number;
  startPosition: number;
  endPosition: number;
  strategy: ChunkingStrategy;
}

/**
 * Chunk structure
 */
export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}

/**
 * Chunking options
 */
export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  chunkSize?: number;
  overlap?: number;
  minSize?: number;
  maxSize?: number;
  minChunks?: number;
  separators?: string[];
  contentType?: string;
  targetTokens?: number;
  qualityThreshold?: number;
}

/**
 * Text chunker class
 */
export class TextChunker {
  /**
   * Chunks text based on the specified strategy
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of chunks
   */
  chunk(text: string, options: ChunkingOptions): Chunk[] {
    this.validateOptions(options);

    switch (options.strategy) {
      case ChunkingStrategy.FixedSize:
        return this.chunkByFixedSize(text, options);
      case ChunkingStrategy.Sentence:
        return this.chunkBySentence(text, options);
      case ChunkingStrategy.Recursive:
        return this.chunkRecursively(text, options);
      case ChunkingStrategy.Adaptive:
        return this.chunkAdaptively(text, options);
      default:
        throw new Error(`Unknown chunking strategy: ${options.strategy}`);
    }
  }

  /**
   * Validates chunking options
   * @param options Options to validate
   */
  private validateOptions(options: ChunkingOptions): void {
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

  /**
   * Chunks text into fixed-size pieces
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of chunks
   */
  private chunkByFixedSize(text: string, options: ChunkingOptions): Chunk[] {
    const {
      chunkSize = 1000,
      overlap = 0,
      minSize = 1,
      maxSize = chunkSize
    } = options;

    if (text.length === 0) {
      return [];
    }

    const chunks: Chunk[] = [];
    let startPos = 0;

    while (startPos < text.length) {
      const endPos = Math.min(startPos + chunkSize, text.length);
      const content = text.slice(startPos, endPos);

      // Only add chunk if it meets size constraints
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

    // Handle minimum chunk count
    if (options.minChunks && chunks.length < options.minChunks) {
      const avgSize = Math.floor(text.length / options.minChunks);
      return this.chunkByFixedSize(text, { ...options, chunkSize: avgSize });
    }

    return chunks;
  }

  /**
   * Chunks text by sentences
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of chunks
   */
  private chunkBySentence(text: string, options: ChunkingOptions): Chunk[] {
    if (text.length === 0) {
      return [];
    }

    // Regex for sentence boundaries, handling common abbreviations
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

  /**
   * Chunks text recursively based on separators
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of chunks
   */
  private chunkRecursively(text: string, options: ChunkingOptions): Chunk[] {
    if (text.length === 0) {
      return [];
    }

    const { separators = ['\n\n', '\n'] } = options;
    const chunks: Chunk[] = [];
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

    // If no separators found, return the whole text as one chunk
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

  /**
   * Chunks text adaptively based on content type and structure
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of chunks
   */
  private chunkAdaptively(text: string, options: ChunkingOptions): Chunk[] {
    if (text.length === 0) {
      return [];
    }

    const {
      contentType = 'general',
      targetTokens = 512,
      qualityThreshold = 0.8,
      overlap = 50
    } = options;
    
    // Content-specific chunking
    switch (contentType) {
      case 'dental_policy':
        // Use section markers and policy structure
        return this.chunkPolicyDocument(text, targetTokens, overlap);
      
      case 'procedure_codes':
        // Use code boundaries and descriptions
        return this.chunkProcedureCodes(text, targetTokens, overlap);
      
      case 'benefits':
        // Use benefit category boundaries
        return this.chunkBenefitsDocument(text, targetTokens, overlap);
      
      default:
        // Fallback to hybrid approach
        return this.chunkWithHybridStrategy(text, targetTokens, overlap, qualityThreshold);
    }
  }

  /**
   * Chunks dental policy documents using section markers
   */
  private chunkPolicyDocument(text: string, targetTokens: number, overlap: number): Chunk[] {
    const sectionMarkers = /^(POLICY|COVERAGE|LIMITATIONS|EXCLUSIONS|DOCUMENTATION):/gm;
    return this.chunkByMarkers(text, sectionMarkers, targetTokens, overlap, ChunkingStrategy.Adaptive);
  }

  /**
   * Chunks procedure code documents
   */
  private chunkProcedureCodes(text: string, targetTokens: number, overlap: number): Chunk[] {
    const codeMarkers = /^D\d{4}:/gm;
    return this.chunkByMarkers(text, codeMarkers, targetTokens, overlap, ChunkingStrategy.Adaptive);
  }

  /**
   * Chunks benefits documents
   */
  private chunkBenefitsDocument(text: string, targetTokens: number, overlap: number): Chunk[] {
    const benefitMarkers = /^(PREVENTIVE|BASIC|MAJOR|ORTHODONTIC) BENEFITS:/gm;
    return this.chunkByMarkers(text, benefitMarkers, targetTokens, overlap, ChunkingStrategy.Adaptive);
  }

  /**
   * Chunks text using a hybrid strategy
   */
  private chunkWithHybridStrategy(
    text: string, 
    targetTokens: number, 
    overlap: number,
    qualityThreshold: number
  ): Chunk[] {
    // Try sentence-based chunking first
    let chunks = this.chunkBySentence(text, { 
      strategy: ChunkingStrategy.Sentence 
    });

    // Combine or split chunks to meet target token size
    chunks = this.optimizeChunkSize(chunks, targetTokens, overlap);

    // Filter low-quality chunks
    return this.filterChunksByQuality(chunks, qualityThreshold);
  }

  /**
   * Chunks text using specified markers
   */
  private chunkByMarkers(
    text: string,
    markers: RegExp,
    targetTokens: number,
    overlap: number,
    strategy: ChunkingStrategy
  ): Chunk[] {
    const sections = text.split(markers).filter(Boolean);
    const chunks: Chunk[] = [];
    let startOffset = 0;

    sections.forEach((section, index) => {
      const trimmedSection = section.trim();
      if (trimmedSection) {
        const startPos = text.indexOf(trimmedSection, startOffset);
        const endPos = startPos + trimmedSection.length;
        
        chunks.push({
          content: trimmedSection,
          metadata: {
            index: chunks.length,
            startPosition: startPos,
            endPosition: endPos,
            strategy
          }
        });
        
        startOffset = endPos;
      }
    });

    // Optimize chunk sizes
    return this.optimizeChunkSize(chunks, targetTokens, overlap);
  }

  /**
   * Optimizes chunk sizes to meet target token count
   */
  private optimizeChunkSize(chunks: Chunk[], targetTokens: number, overlap: number): Chunk[] {
    const optimized: Chunk[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    let startPos = 0;

    chunks.forEach((chunk, index) => {
      const chunkTokens = Math.ceil(chunk.content.length / 4);
      
      if (currentTokens + chunkTokens <= targetTokens) {
        currentChunk += (currentChunk ? ' ' : '') + chunk.content;
        currentTokens += chunkTokens;
      } else {
        if (currentChunk) {
          optimized.push({
            content: currentChunk,
            metadata: {
              index: optimized.length,
              startPosition: startPos,
              endPosition: startPos + currentChunk.length,
              strategy: ChunkingStrategy.Adaptive
            }
          });
        }
        
        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + chunk.content;
        currentTokens = Math.ceil(currentChunk.length / 4);
        startPos += currentChunk.length - overlap;
      }
    });

    // Add final chunk
    if (currentChunk) {
      optimized.push({
        content: currentChunk,
        metadata: {
          index: optimized.length,
          startPosition: startPos,
          endPosition: startPos + currentChunk.length,
          strategy: ChunkingStrategy.Adaptive
        }
      });
    }

    return optimized;
  }

  /**
   * Filters chunks based on quality metrics
   */
  private filterChunksByQuality(chunks: Chunk[], threshold: number): Chunk[] {
    return chunks.filter(chunk => {
      const quality = this.calculateChunkQuality(chunk.content);
      return quality >= threshold;
    });
  }

  /**
   * Calculates chunk quality score
   */
  private calculateChunkQuality(content: string): number {
    // Basic quality metrics
    const metrics = {
      length: content.length > 50 ? 0.3 : 0.1,
      sentences: content.split(/[.!?]+/).length > 1 ? 0.3 : 0.1,
      structure: /^[A-Z].*[.!?]$/.test(content) ? 0.2 : 0.1,
      specialChars: content.match(/[^a-zA-Z0-9\s]/) ? 0.1 : 0.2
    };

    return Object.values(metrics).reduce((sum, score) => sum + score, 0);
  }
} 
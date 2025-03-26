import { Chunk } from './TextChunker.js';

/**
 * Context window configuration
 */
export interface ContextWindowConfig {
  maxTokens: number;
  minTokens?: number;
  overlapPercentage?: number;
  maxDistance?: number;
  qualityThreshold?: number;
}

/**
 * Context window result
 */
export interface ContextWindow {
  chunks: Chunk[];
  totalTokens: number;
  overlapTokens: number;
  quality: number;
  metadata: {
    startPosition: number;
    endPosition: number;
    strategy: string;
  };
}

/**
 * Manages context windows for RAG operations
 */
export class ContextWindowManager {
  private static readonly DEFAULT_MAX_TOKENS = 1024;
  private static readonly DEFAULT_MIN_TOKENS = 256;
  private static readonly DEFAULT_OVERLAP = 0.1; // 10% overlap
  private static readonly DEFAULT_MAX_DISTANCE = 1000;
  private static readonly DEFAULT_QUALITY_THRESHOLD = 0.7;

  /**
   * Creates context windows from chunks
   * @param chunks Array of text chunks
   * @param config Window configuration
   * @returns Array of context windows
   */
  createWindows(chunks: Chunk[], config: Partial<ContextWindowConfig> = {}): ContextWindow[] {
    const {
      maxTokens = ContextWindowManager.DEFAULT_MAX_TOKENS,
      minTokens = ContextWindowManager.DEFAULT_MIN_TOKENS,
      overlapPercentage = ContextWindowManager.DEFAULT_OVERLAP,
      maxDistance = ContextWindowManager.DEFAULT_MAX_DISTANCE,
      qualityThreshold = ContextWindowManager.DEFAULT_QUALITY_THRESHOLD
    } = config;

    // Validate configuration
    this.validateConfig(maxTokens, minTokens, overlapPercentage);

    // Initialize windows array
    const windows: ContextWindow[] = [];
    let currentChunks: Chunk[] = [];
    let currentTokens = 0;
    let lastWindowEnd = 0;

    // Process chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkTokens = this.estimateTokens(chunk.content);

      // Check distance constraint
      if (currentChunks.length > 0) {
        const distance = chunk.metadata.startPosition - lastWindowEnd;
        if (distance > maxDistance) {
          // Start new window if distance is too large
          if (currentChunks.length > 0) {
            const window = this.createWindow(currentChunks, qualityThreshold);
            if (window) windows.push(window);
            currentChunks = [];
            currentTokens = 0;
          }
        }
      }

      // Add chunk to current window
      if (currentTokens + chunkTokens <= maxTokens) {
        currentChunks.push(chunk);
        currentTokens += chunkTokens;
        lastWindowEnd = chunk.metadata.endPosition;
      } else {
        // Create window from current chunks if we have enough tokens
        if (currentTokens >= minTokens) {
          const window = this.createWindow(currentChunks, qualityThreshold);
          if (window) windows.push(window);
        }

        // Start new window with overlap
        const overlapTokens = Math.floor(currentTokens * overlapPercentage);
        const overlapChunks = this.getOverlapChunks(currentChunks, overlapTokens);
        
        currentChunks = [...overlapChunks, chunk];
        currentTokens = this.estimateTokens(currentChunks.map(c => c.content).join(' '));
        lastWindowEnd = chunk.metadata.endPosition;
      }
    }

    // Add final window if it meets minimum size
    if (currentChunks.length > 0 && currentTokens >= minTokens) {
      const window = this.createWindow(currentChunks, qualityThreshold);
      if (window) windows.push(window);
    }

    return windows;
  }

  /**
   * Creates a context window from chunks
   */
  private createWindow(chunks: Chunk[], qualityThreshold: number): ContextWindow | null {
    const content = chunks.map(c => c.content).join(' ');
    const totalTokens = this.estimateTokens(content);
    const quality = this.calculateWindowQuality(chunks);

    if (quality < qualityThreshold) {
      return null;
    }

    return {
      chunks,
      totalTokens,
      overlapTokens: 0, // Will be set when creating next window
      quality,
      metadata: {
        startPosition: chunks[0].metadata.startPosition,
        endPosition: chunks[chunks.length - 1].metadata.endPosition,
        strategy: 'context_window'
      }
    };
  }

  /**
   * Gets chunks for overlap
   */
  private getOverlapChunks(chunks: Chunk[], targetTokens: number): Chunk[] {
    const overlapChunks: Chunk[] = [];
    let tokens = 0;

    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunk = chunks[i];
      const chunkTokens = this.estimateTokens(chunk.content);

      if (tokens + chunkTokens <= targetTokens) {
        overlapChunks.unshift(chunk);
        tokens += chunkTokens;
      } else {
        break;
      }
    }

    return overlapChunks;
  }

  /**
   * Estimates token count from text
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculates quality score for a context window
   */
  private calculateWindowQuality(chunks: Chunk[]): number {
    if (chunks.length === 0) return 0;

    // Calculate various quality metrics
    const metrics = {
      // Coherence: check if chunks are sequential
      sequentialScore: this.calculateSequentialScore(chunks),
      
      // Content density: ratio of meaningful content
      densityScore: this.calculateDensityScore(chunks),
      
      // Semantic similarity between chunks
      similarityScore: this.calculateSimilarityScore(chunks),
      
      // Structure completeness
      structureScore: this.calculateStructureScore(chunks)
    };

    // Weighted average of scores
    return Object.values(metrics).reduce((sum, score) => sum + score, 0) / Object.keys(metrics).length;
  }

  /**
   * Calculates score based on sequential ordering of chunks
   */
  private calculateSequentialScore(chunks: Chunk[]): number {
    let score = 1;
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const curr = chunks[i];
      if (curr.metadata.startPosition < prev.metadata.endPosition) {
        score -= 0.1; // Penalize overlaps
      } else if (curr.metadata.startPosition > prev.metadata.endPosition + 100) {
        score -= 0.2; // Penalize gaps
      }
    }
    return Math.max(0, score);
  }

  /**
   * Calculates content density score
   */
  private calculateDensityScore(chunks: Chunk[]): number {
    const content = chunks.map(c => c.content).join(' ');
    const words = content.split(/\s+/).filter(Boolean);
    const meaningfulWords = words.filter(w => w.length > 3).length;
    return meaningfulWords / words.length;
  }

  /**
   * Calculates similarity score between chunks
   */
  private calculateSimilarityScore(chunks: Chunk[]): number {
    if (chunks.length < 2) return 1;
    
    let totalScore = 0;
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1].content.toLowerCase();
      const curr = chunks[i].content.toLowerCase();
      
      // Simple word overlap similarity
      const prevWords = new Set(prev.split(/\s+/));
      const currWords = new Set(curr.split(/\s+/));
      const intersection = new Set([...prevWords].filter(x => currWords.has(x)));
      const similarity = intersection.size / Math.max(prevWords.size, currWords.size);
      
      totalScore += similarity;
    }
    
    return totalScore / (chunks.length - 1);
  }

  /**
   * Calculates structure completeness score
   */
  private calculateStructureScore(chunks: Chunk[]): number {
    const content = chunks.map(c => c.content).join(' ');
    
    // Check for complete sentences
    const completeSentences = content.split(/[.!?]+/).filter(s => {
      const trimmed = s.trim();
      return trimmed.length > 0 && /^[A-Z]/.test(trimmed);
    }).length;
    
    // Check for structural elements
    const hasIntro = /^(POLICY|COVERAGE|INTRODUCTION):/i.test(content);
    const hasConclusion = /(CONCLUSION|DOCUMENTATION REQUIRED|END):/i.test(content);
    
    let score = completeSentences > 0 ? 0.6 : 0;
    if (hasIntro) score += 0.2;
    if (hasConclusion) score += 0.2;
    
    return score;
  }

  /**
   * Validates configuration parameters
   */
  private validateConfig(maxTokens: number, minTokens: number, overlap: number): void {
    if (maxTokens <= 0) {
      throw new Error('Maximum tokens must be positive');
    }
    if (minTokens <= 0) {
      throw new Error('Minimum tokens must be positive');
    }
    if (minTokens > maxTokens) {
      throw new Error('Minimum tokens cannot be greater than maximum tokens');
    }
    if (overlap < 0 || overlap >= 1) {
      throw new Error('Overlap percentage must be between 0 and 1');
    }
  }
} 
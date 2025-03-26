import { ContextWindow } from './ContextWindowManager.js';

/**
 * Scoring method types
 */
export enum ScoringMethod {
  Semantic = 'semantic',
  Lexical = 'lexical',
  Hybrid = 'hybrid'
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  method: ScoringMethod;
  weights: {
    semantic: number;
    lexical: number;
    position: number;
    quality: number;
  };
  thresholds: {
    minimum: number;
    optimal: number;
  };
  boostFactors: {
    titleMatch: number;
    keywordMatch: number;
    recency: number;
  };
}

/**
 * Scoring result
 */
export interface ScoringResult {
  score: number;
  components: {
    semantic: number;
    lexical: number;
    position: number;
    quality: number;
  };
  metadata: {
    method: ScoringMethod;
    threshold: number;
    boosts: string[];
  };
}

/**
 * Manages relevance scoring for RAG results
 */
export class RelevanceScorer {
  private static readonly DEFAULT_WEIGHTS = {
    semantic: 0.4,
    lexical: 0.3,
    position: 0.2,
    quality: 0.1
  };

  private static readonly DEFAULT_THRESHOLDS = {
    minimum: 0.3,
    optimal: 0.7
  };

  private static readonly DEFAULT_BOOSTS = {
    titleMatch: 1.5,
    keywordMatch: 1.2,
    recency: 1.1
  };

  /**
   * Scores relevance of context windows for a query
   * @param query Search query
   * @param windows Context windows to score
   * @param config Scoring configuration
   * @returns Array of scoring results
   */
  scoreWindows(
    query: string,
    windows: ContextWindow[],
    config: Partial<ScoringConfig> = {}
  ): ScoringResult[] {
    const {
      method = ScoringMethod.Hybrid,
      weights = RelevanceScorer.DEFAULT_WEIGHTS,
      thresholds = RelevanceScorer.DEFAULT_THRESHOLDS,
      boostFactors = RelevanceScorer.DEFAULT_BOOSTS
    } = config;

    return windows.map(window => {
      // Calculate base scores
      const components = {
        semantic: this.calculateSemanticScore(query, window),
        lexical: this.calculateLexicalScore(query, window),
        position: this.calculatePositionScore(window),
        quality: window.quality
      };

      // Apply method-specific scoring
      let score: number;
      switch (method) {
        case ScoringMethod.Semantic:
          score = components.semantic;
          break;
        case ScoringMethod.Lexical:
          score = components.lexical;
          break;
        case ScoringMethod.Hybrid:
          score = this.calculateWeightedScore(components, weights);
          break;
        default:
          throw new Error(`Unknown scoring method: ${method}`);
      }

      // Apply boosts
      const boosts = this.applyBoostFactors(query, window, boostFactors);
      score = this.applyBoosts(score, boosts);

      // Normalize final score
      score = Math.max(0, Math.min(1, score));

      return {
        score,
        components,
        metadata: {
          method,
          threshold: thresholds.minimum,
          boosts: Object.keys(boosts)
        }
      };
    });
  }

  /**
   * Calculates semantic similarity score
   */
  private calculateSemanticScore(query: string, window: ContextWindow): number {
    // Simplified semantic scoring using word overlap
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(
      window.chunks
        .map(c => c.content.toLowerCase())
        .join(' ')
        .split(/\s+/)
    );

    const intersection = new Set(
      [...queryWords].filter(x => contentWords.has(x))
    );

    return intersection.size / queryWords.size;
  }

  /**
   * Calculates lexical matching score
   */
  private calculateLexicalScore(query: string, window: ContextWindow): number {
    const content = window.chunks.map(c => c.content).join(' ').toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Calculate term frequency
    const termFrequency: { [term: string]: number } = {};
    queryTerms.forEach(term => {
      const regex = new RegExp(term, 'g');
      termFrequency[term] = (content.match(regex) || []).length;
    });

    // Calculate TF-IDF like score
    const scores = queryTerms.map(term => {
      const tf = termFrequency[term] || 0;
      const normalizedTf = tf > 0 ? 1 + Math.log10(tf) : 0;
      return normalizedTf;
    });

    return scores.reduce((sum, score) => sum + score, 0) / queryTerms.length;
  }

  /**
   * Calculates position-based score
   */
  private calculatePositionScore(window: ContextWindow): number {
    // Favor content at the beginning of documents
    const firstChunk = window.chunks[0];
    const maxPosition = 10000; // Arbitrary max position

    const positionScore = Math.max(
      0,
      1 - firstChunk.metadata.startPosition / maxPosition
    );

    return positionScore;
  }

  /**
   * Calculates weighted score from components
   */
  private calculateWeightedScore(
    components: Required<ScoringResult['components']>,
    weights: Required<ScoringConfig['weights']>
  ): number {
    return (
      (components.semantic * weights.semantic) +
      (components.lexical * weights.lexical) +
      (components.position * weights.position) +
      (components.quality * weights.quality)
    );
  }

  /**
   * Applies boost factors to base score
   */
  private applyBoostFactors(
    query: string,
    window: ContextWindow,
    boostFactors: Required<ScoringConfig['boostFactors']>
  ): { [factor: string]: number } {
    const boosts: { [factor: string]: number } = {};
    const content = window.chunks.map(c => c.content).join(' ');

    // Title match boost
    if (this.hasSignificantTitleMatch(query, content)) {
      boosts.titleMatch = boostFactors.titleMatch;
    }

    // Keyword match boost
    if (this.hasSignificantKeywordMatch(query, content)) {
      boosts.keywordMatch = boostFactors.keywordMatch;
    }

    // Recency boost (if applicable)
    if (this.hasRecencyIndicator(content)) {
      boosts.recency = boostFactors.recency;
    }

    return boosts;
  }

  /**
   * Applies boosts to score
   */
  private applyBoosts(score: number, boosts: { [factor: string]: number }): number {
    return Object.values(boosts).reduce((s, boost) => s * boost, score);
  }

  /**
   * Checks for significant title matches
   */
  private hasSignificantTitleMatch(query: string, content: string): boolean {
    const titlePattern = new RegExp(`^(${query})`, 'i');
    return titlePattern.test(content);
  }

  /**
   * Checks for significant keyword matches
   */
  private hasSignificantKeywordMatch(query: string, content: string): boolean {
    const keywords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    return keywords.every(keyword => contentLower.includes(keyword));
  }

  /**
   * Checks for recency indicators in content
   */
  private hasRecencyIndicator(content: string): boolean {
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear - 1, currentYear, currentYear + 1];
    return recentYears.some(year => content.includes(year.toString()));
  }
} 
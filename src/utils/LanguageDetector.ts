import { franc, francAll } from 'franc';

/**
 * Language detection result with confidence score
 */
interface LanguageDetectionResult {
  languageCode: string;
  confidence: number;
  alternatives?: Array<{
    languageCode: string;
    confidence: number;
  }>;
}

/**
 * Configuration options for language detection
 */
interface LanguageDetectionOptions {
  minLength?: number;
  onlyLanguages?: string[];
  ignoreLanguages?: string[];
  includeAlternatives?: boolean;
  minConfidence?: number;
}

/**
 * Type for franc language detection results
 */
type FrancResult = [string, number];

/**
 * Class for detecting languages in text using the franc library
 */
export class LanguageDetector {
  private static readonly DEFAULT_MIN_LENGTH = 20;
  private static readonly DEFAULT_MIN_CONFIDENCE = 0.5;
  private static readonly UNDETERMINED = 'und';

  /**
   * Detects the language of the given text
   * @param text Text to analyze
   * @param options Detection options
   * @returns Language detection result
   */
  detectLanguage(text: string, options: LanguageDetectionOptions = {}): LanguageDetectionResult {
    const {
      minLength = LanguageDetector.DEFAULT_MIN_LENGTH,
      onlyLanguages,
      ignoreLanguages,
      includeAlternatives = false,
      minConfidence = LanguageDetector.DEFAULT_MIN_CONFIDENCE
    } = options;

    // Check minimum text length
    if (text.length < minLength) {
      return {
        languageCode: LanguageDetector.UNDETERMINED,
        confidence: 0,
        alternatives: []
      };
    }

    try {
      if (includeAlternatives) {
        // Get all language probabilities
        const results = francAll(text, {
          minLength,
          only: onlyLanguages,
          ignore: ignoreLanguages
        });

        // Filter and format results
        const filteredResults = results
          .filter(([_, confidence]: FrancResult) => confidence >= minConfidence)
          .map(([code, confidence]: FrancResult) => ({
            languageCode: code,
            confidence
          }));

        if (filteredResults.length === 0) {
          return {
            languageCode: LanguageDetector.UNDETERMINED,
            confidence: 0,
            alternatives: []
          };
        }

        // Return primary language and alternatives
        const [primary, ...alternatives] = filteredResults;
        return {
          ...primary,
          alternatives
        };
      } else {
        // Get single most likely language
        const languageCode = franc(text, {
          minLength,
          only: onlyLanguages,
          ignore: ignoreLanguages
        });

        // If language is undetermined or below confidence threshold
        if (languageCode === LanguageDetector.UNDETERMINED) {
          return {
            languageCode: LanguageDetector.UNDETERMINED,
            confidence: 0
          };
        }

        // Get confidence score from francAll
        const allResults = francAll(text, {
          minLength,
          only: [languageCode]
        });

        const confidence = allResults[0]?.[1] ?? 0;

        // Check confidence threshold
        if (confidence < minConfidence) {
          return {
            languageCode: LanguageDetector.UNDETERMINED,
            confidence: 0
          };
        }

        return {
          languageCode,
          confidence
        };
      }
    } catch (error) {
      console.error('Language detection failed:', error);
      return {
        languageCode: LanguageDetector.UNDETERMINED,
        confidence: 0
      };
    }
  }

  /**
   * Detects languages in multiple chunks of text
   * @param chunks Array of text chunks to analyze
   * @param options Detection options
   * @returns Array of language detection results
   */
  detectLanguages(chunks: string[], options: LanguageDetectionOptions = {}): LanguageDetectionResult[] {
    return chunks.map(chunk => this.detectLanguage(chunk, options));
  }

  /**
   * Determines if a text is multilingual
   * @param text Text to analyze
   * @param options Detection options
   * @returns Whether the text appears to be multilingual
   */
  isMultilingual(text: string, options: LanguageDetectionOptions = {}): boolean {
    const {
      minLength = LanguageDetector.DEFAULT_MIN_LENGTH,
      minConfidence = LanguageDetector.DEFAULT_MIN_CONFIDENCE
    } = options;

    // Split text into paragraphs
    const paragraphs = text
      .split(/\n\s*\n/)
      .filter(p => p.trim().length >= minLength);

    if (paragraphs.length < 2) {
      return false;
    }

    // Detect language of each paragraph
    const languages = new Set<string>();
    
    for (const paragraph of paragraphs) {
      const result = this.detectLanguage(paragraph, {
        ...options,
        minLength,
        minConfidence
      });

      if (result.languageCode !== LanguageDetector.UNDETERMINED) {
        languages.add(result.languageCode);
        if (languages.size > 1) {
          return true;
        }
      }
    }

    return false;
  }
} 
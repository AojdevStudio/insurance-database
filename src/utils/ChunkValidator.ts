import { LanguageDetector } from './LanguageDetector.js';

/**
 * Validation error severity levels
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Validation error structure
 */
export interface ValidationError {
  code: string;
  message: string;
  severity: ValidationSeverity;
  position?: {
    start: number;
    end: number;
  };
  context?: unknown;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  suggestions?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  name: string;
  validate: (chunk: string, metadata?: unknown) => ValidationResult | Promise<ValidationResult>;
  priority: number;
  isAsync: boolean;
  options?: Record<string, unknown>;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  rules?: ValidationRule[];
  stopOnFirstError?: boolean;
  validateAsync?: boolean;
  cacheResults?: boolean;
  customMetadata?: Record<string, unknown>;
}

/**
 * Built-in length validation rule
 */
export class LengthValidationRule implements ValidationRule {
  name = 'length';
  priority = 100;
  isAsync = false;

  constructor(
    public options: {
      minLength?: number;
      maxLength?: number;
      warnThreshold?: number;
    } = {}
  ) {}

  validate(chunk: string): ValidationResult {
    const errors: ValidationError[] = [];
    const { minLength, maxLength, warnThreshold = 0.9 } = this.options;

    if (minLength !== undefined && chunk.length < minLength) {
      errors.push({
        code: 'LENGTH_TOO_SHORT',
        message: `Chunk length (${chunk.length}) is below minimum length (${minLength})`,
        severity: 'error'
      });
    }

    if (maxLength !== undefined) {
      if (chunk.length > maxLength) {
        errors.push({
          code: 'LENGTH_TOO_LONG',
          message: `Chunk length (${chunk.length}) exceeds maximum length (${maxLength})`,
          severity: 'error'
        });
      } else if (chunk.length > maxLength * warnThreshold) {
        errors.push({
          code: 'LENGTH_NEAR_LIMIT',
          message: `Chunk length (${chunk.length}) is approaching maximum length (${maxLength})`,
          severity: 'warning'
        });
      }
    }

    return {
      isValid: errors.length === 0 || errors.every(e => e.severity === 'warning'),
      errors,
      metadata: {
        length: chunk.length
      }
    };
  }
}

/**
 * Built-in format validation rule
 */
export class FormatValidationRule implements ValidationRule {
  name = 'format';
  priority = 90;
  isAsync = false;

  constructor(
    public options: {
      allowedCharacters?: RegExp;
      disallowedPatterns?: RegExp[];
      requiredPatterns?: RegExp[];
    } = {}
  ) {}

  validate(chunk: string): ValidationResult {
    const errors: ValidationError[] = [];
    const {
      allowedCharacters,
      disallowedPatterns = [],
      requiredPatterns = []
    } = this.options;

    // Check allowed characters
    if (allowedCharacters) {
      const invalidChars = chunk.split('').filter(char => !allowedCharacters.test(char));
      if (invalidChars.length > 0) {
        errors.push({
          code: 'INVALID_CHARACTERS',
          message: `Chunk contains invalid characters: ${Array.from(new Set(invalidChars)).join(', ')}`,
          severity: 'error'
        });
      }
    }

    // Check disallowed patterns
    disallowedPatterns.forEach((pattern, index) => {
      const match = pattern.exec(chunk);
      if (match) {
        errors.push({
          code: 'DISALLOWED_PATTERN',
          message: `Chunk contains disallowed pattern: ${match[0]}`,
          severity: 'error',
          position: {
            start: match.index,
            end: match.index + match[0].length
          }
        });
      }
    });

    // Check required patterns
    requiredPatterns.forEach((pattern, index) => {
      if (!pattern.test(chunk)) {
        errors.push({
          code: 'MISSING_REQUIRED_PATTERN',
          message: `Chunk is missing required pattern: ${pattern}`,
          severity: 'error'
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Built-in language validation rule
 */
export class LanguageValidationRule implements ValidationRule {
  name = 'language';
  priority = 80;
  isAsync = false;
  private languageDetector: LanguageDetector;

  constructor(
    public options: {
      allowedLanguages?: string[];
      minConfidence?: number;
    } = {}
  ) {
    this.languageDetector = new LanguageDetector();
  }

  validate(chunk: string): ValidationResult {
    const errors: ValidationError[] = [];
    const { allowedLanguages, minConfidence = 0.5 } = this.options;

    const result = this.languageDetector.detectLanguage(chunk);

    if (result.confidence < minConfidence) {
      errors.push({
        code: 'LOW_LANGUAGE_CONFIDENCE',
        message: `Language detection confidence (${result.confidence}) is below minimum (${minConfidence})`,
        severity: 'warning'
      });
    }

    if (allowedLanguages && !allowedLanguages.includes(result.languageCode)) {
      errors.push({
        code: 'UNSUPPORTED_LANGUAGE',
        message: `Detected language (${result.languageCode}) is not in allowed languages: ${allowedLanguages.join(', ')}`,
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0 || errors.every(e => e.severity === 'warning'),
      errors,
      metadata: {
        language: result.languageCode,
        confidence: result.confidence
      }
    };
  }
}

/**
 * Main chunk validator class
 */
export class ChunkValidator {
  private rules: ValidationRule[] = [];
  private cache: Map<string, ValidationResult> = new Map();

  constructor(private options: ValidationOptions = {}) {
    // Initialize with default rules if none provided
    if (!options.rules || options.rules.length === 0) {
      this.rules = [
        new LengthValidationRule(),
        new FormatValidationRule(),
        new LanguageValidationRule()
      ];
    } else {
      this.rules = [...options.rules].sort((a, b) => b.priority - a.priority);
    }
  }

  /**
   * Adds a new validation rule
   * @param rule Validation rule to add
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.clearCache();
  }

  /**
   * Removes a validation rule
   * @param ruleName Name of the rule to remove
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
    this.clearCache();
  }

  /**
   * Clears the validation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Validates a chunk synchronously
   * @param chunk Chunk to validate
   * @returns Validation result
   */
  validate(chunk: string): ValidationResult {
    // Check cache if enabled
    if (this.options.cacheResults) {
      const cached = this.cache.get(chunk);
      if (cached) {
        return cached;
      }
    }

    const errors: ValidationError[] = [];
    let metadata: Record<string, unknown> = {};

    // Run synchronous rules
    for (const rule of this.rules) {
      if (rule.isAsync) {
        continue;
      }

      const result = rule.validate(chunk, this.options.customMetadata) as ValidationResult;
      errors.push(...result.errors);
      metadata = { ...metadata, ...result.metadata };

      if (this.options.stopOnFirstError && errors.some(e => e.severity === 'error')) {
        break;
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0 || errors.every(e => e.severity === 'warning'),
      errors,
      metadata
    };

    // Cache result if enabled
    if (this.options.cacheResults) {
      this.cache.set(chunk, result);
    }

    return result;
  }

  /**
   * Validates a chunk asynchronously
   * @param chunk Chunk to validate
   * @returns Promise resolving to validation result
   */
  async validateAsync(chunk: string): Promise<ValidationResult> {
    // Check cache if enabled
    if (this.options.cacheResults) {
      const cached = this.cache.get(chunk);
      if (cached) {
        return cached;
      }
    }

    const errors: ValidationError[] = [];
    let metadata: Record<string, unknown> = {};

    // Run all rules (sync and async)
    for (const rule of this.rules) {
      const result = await Promise.resolve(rule.validate(chunk, this.options.customMetadata));
      errors.push(...result.errors);
      metadata = { ...metadata, ...result.metadata };

      if (this.options.stopOnFirstError && errors.some(e => e.severity === 'error')) {
        break;
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0 || errors.every(e => e.severity === 'warning'),
      errors,
      metadata
    };

    // Cache result if enabled
    if (this.options.cacheResults) {
      this.cache.set(chunk, result);
    }

    return result;
  }

  /**
   * Validates multiple chunks in parallel
   * @param chunks Array of chunks to validate
   * @returns Promise resolving to array of validation results
   */
  async validateBatch(chunks: string[]): Promise<ValidationResult[]> {
    return Promise.all(chunks.map(chunk => this.validateAsync(chunk)));
  }
} 
import { LanguageDetector } from './LanguageDetector.js';
export class LengthValidationRule {
    options;
    name = 'length';
    priority = 100;
    isAsync = false;
    constructor(options = {}) {
        this.options = options;
    }
    validate(chunk) {
        const errors = [];
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
            }
            else if (chunk.length > maxLength * warnThreshold) {
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
export class FormatValidationRule {
    options;
    name = 'format';
    priority = 90;
    isAsync = false;
    constructor(options = {}) {
        this.options = options;
    }
    validate(chunk) {
        const errors = [];
        const { allowedCharacters, disallowedPatterns = [], requiredPatterns = [] } = this.options;
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
export class LanguageValidationRule {
    options;
    name = 'language';
    priority = 80;
    isAsync = false;
    languageDetector;
    constructor(options = {}) {
        this.options = options;
        this.languageDetector = new LanguageDetector();
    }
    validate(chunk) {
        const errors = [];
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
export class ChunkValidator {
    options;
    rules = [];
    cache = new Map();
    constructor(options = {}) {
        this.options = options;
        if (!options.rules || options.rules.length === 0) {
            this.rules = [
                new LengthValidationRule(),
                new FormatValidationRule(),
                new LanguageValidationRule()
            ];
        }
        else {
            this.rules = [...options.rules].sort((a, b) => b.priority - a.priority);
        }
    }
    addRule(rule) {
        this.rules.push(rule);
        this.rules.sort((a, b) => b.priority - a.priority);
        this.clearCache();
    }
    removeRule(ruleName) {
        this.rules = this.rules.filter(rule => rule.name !== ruleName);
        this.clearCache();
    }
    clearCache() {
        this.cache.clear();
    }
    validate(chunk) {
        if (this.options.cacheResults) {
            const cached = this.cache.get(chunk);
            if (cached) {
                return cached;
            }
        }
        const errors = [];
        let metadata = {};
        for (const rule of this.rules) {
            if (rule.isAsync) {
                continue;
            }
            const result = rule.validate(chunk, this.options.customMetadata);
            errors.push(...result.errors);
            metadata = { ...metadata, ...result.metadata };
            if (this.options.stopOnFirstError && errors.some(e => e.severity === 'error')) {
                break;
            }
        }
        const result = {
            isValid: errors.length === 0 || errors.every(e => e.severity === 'warning'),
            errors,
            metadata
        };
        if (this.options.cacheResults) {
            this.cache.set(chunk, result);
        }
        return result;
    }
    async validateAsync(chunk) {
        if (this.options.cacheResults) {
            const cached = this.cache.get(chunk);
            if (cached) {
                return cached;
            }
        }
        const errors = [];
        let metadata = {};
        for (const rule of this.rules) {
            const result = await Promise.resolve(rule.validate(chunk, this.options.customMetadata));
            errors.push(...result.errors);
            metadata = { ...metadata, ...result.metadata };
            if (this.options.stopOnFirstError && errors.some(e => e.severity === 'error')) {
                break;
            }
        }
        const result = {
            isValid: errors.length === 0 || errors.every(e => e.severity === 'warning'),
            errors,
            metadata
        };
        if (this.options.cacheResults) {
            this.cache.set(chunk, result);
        }
        return result;
    }
    async validateBatch(chunks) {
        return Promise.all(chunks.map(chunk => this.validateAsync(chunk)));
    }
}
//# sourceMappingURL=ChunkValidator.js.map
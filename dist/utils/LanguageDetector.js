import { franc, francAll } from 'franc';
export class LanguageDetector {
    static DEFAULT_MIN_LENGTH = 20;
    static DEFAULT_MIN_CONFIDENCE = 0.5;
    static UNDETERMINED = 'und';
    detectLanguage(text, options = {}) {
        const { minLength = LanguageDetector.DEFAULT_MIN_LENGTH, onlyLanguages, ignoreLanguages, includeAlternatives = false, minConfidence = LanguageDetector.DEFAULT_MIN_CONFIDENCE } = options;
        if (text.length < minLength) {
            return {
                languageCode: LanguageDetector.UNDETERMINED,
                confidence: 0,
                alternatives: []
            };
        }
        try {
            if (includeAlternatives) {
                const results = francAll(text, {
                    minLength,
                    only: onlyLanguages,
                    ignore: ignoreLanguages
                });
                const filteredResults = results
                    .filter(([_, confidence]) => confidence >= minConfidence)
                    .map(([code, confidence]) => ({
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
                const [primary, ...alternatives] = filteredResults;
                return {
                    ...primary,
                    alternatives
                };
            }
            else {
                const languageCode = franc(text, {
                    minLength,
                    only: onlyLanguages,
                    ignore: ignoreLanguages
                });
                if (languageCode === LanguageDetector.UNDETERMINED) {
                    return {
                        languageCode: LanguageDetector.UNDETERMINED,
                        confidence: 0
                    };
                }
                const allResults = francAll(text, {
                    minLength,
                    only: [languageCode]
                });
                const confidence = allResults[0]?.[1] ?? 0;
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
        }
        catch (error) {
            console.error('Language detection failed:', error);
            return {
                languageCode: LanguageDetector.UNDETERMINED,
                confidence: 0
            };
        }
    }
    detectLanguages(chunks, options = {}) {
        return chunks.map(chunk => this.detectLanguage(chunk, options));
    }
    isMultilingual(text, options = {}) {
        const { minLength = LanguageDetector.DEFAULT_MIN_LENGTH, minConfidence = LanguageDetector.DEFAULT_MIN_CONFIDENCE } = options;
        const paragraphs = text
            .split(/\n\s*\n/)
            .filter(p => p.trim().length >= minLength);
        if (paragraphs.length < 2) {
            return false;
        }
        const languages = new Set();
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
//# sourceMappingURL=LanguageDetector.js.map
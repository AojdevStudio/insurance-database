import { LanguageDetector } from './LanguageDetector.js';
class TextExtractor {
    canHandle(content) {
        return true;
    }
    extractMetadata(content) {
        const headings = [];
        const sections = [];
        const paragraphs = content.split(/\n\s*\n/);
        let currentPosition = 0;
        paragraphs.forEach((paragraph, index) => {
            const headingMatch = paragraph.match(/^(#{1,6})\s+(.+)$/m);
            if (headingMatch) {
                headings.push({
                    level: headingMatch[1].length,
                    text: headingMatch[2],
                    position: currentPosition
                });
            }
            sections.push({
                content: paragraph,
                startPosition: currentPosition,
                endPosition: currentPosition + paragraph.length
            });
            currentPosition += paragraph.length + 2;
        });
        const statistics = {
            totalLength: content.length,
            wordCount: content.split(/\s+/).length,
            sentenceCount: content.split(/[.!?]+\s+/).length,
            paragraphCount: paragraphs.length
        };
        return {
            format: 'text',
            structure: {
                headings,
                sections
            },
            statistics
        };
    }
}
class MarkdownExtractor {
    canHandle(content) {
        return /^#\s|[*_][\w\s]+[*_]|`[\w\s]+`|\[[\w\s]+\]\(.*\)/.test(content);
    }
    extractMetadata(content) {
        const headings = [];
        const sections = [];
        const lines = content.split('\n');
        let currentPosition = 0;
        let currentSection = '';
        let sectionStart = 0;
        lines.forEach(line => {
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                if (currentSection) {
                    sections.push({
                        content: currentSection.trim(),
                        startPosition: sectionStart,
                        endPosition: currentPosition
                    });
                    currentSection = '';
                }
                headings.push({
                    level: headingMatch[1].length,
                    text: headingMatch[2],
                    position: currentPosition
                });
                sectionStart = currentPosition + line.length + 1;
            }
            else {
                currentSection += line + '\n';
            }
            currentPosition += line.length + 1;
        });
        if (currentSection) {
            sections.push({
                content: currentSection.trim(),
                startPosition: sectionStart,
                endPosition: currentPosition
            });
        }
        const statistics = {
            totalLength: content.length,
            wordCount: content.split(/\s+/).length,
            sentenceCount: content.split(/[.!?]+\s+/).length,
            paragraphCount: content.split(/\n\s*\n/).length
        };
        return {
            format: 'markdown',
            structure: {
                headings,
                sections
            },
            statistics
        };
    }
}
export class MetadataExtractor {
    extractors;
    languageDetector;
    constructor() {
        this.extractors = [
            new MarkdownExtractor(),
            new TextExtractor()
        ];
        this.languageDetector = new LanguageDetector();
    }
    detectFormat(content) {
        for (const extractor of this.extractors) {
            if (extractor.canHandle(content)) {
                return extractor instanceof MarkdownExtractor ? 'markdown' : 'text';
            }
        }
        return 'text';
    }
    extractDates(content) {
        const dates = [];
        const datePatterns = [
            /\b(\d{4}-\d{2}-\d{2})\b/g,
            /\b(\d{2}\/\d{2}\/\d{4})\b/g,
            /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/g
        ];
        datePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                try {
                    const date = new Date(match[1]);
                    if (!isNaN(date.getTime())) {
                        dates.push({
                            value: date,
                            position: match.index,
                            context: content.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20)
                        });
                    }
                }
                catch (err) {
                    console.warn(`Failed to parse date: ${match[1]}`, err);
                    continue;
                }
            }
        });
        return dates;
    }
    extractEntities(content) {
        const entities = [];
        const entityPatterns = [
            {
                type: 'email',
                pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
            },
            {
                type: 'phone',
                pattern: /\b\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g
            },
            {
                type: 'url',
                pattern: /\bhttps?:\/\/[^\s<>[\]{}|\\^]+\b/g
            },
            {
                type: 'ipAddress',
                pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
            }
        ];
        entityPatterns.forEach(({ type, pattern }) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                entities.push({
                    type,
                    value: match[0],
                    position: match.index,
                    context: content.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20)
                });
            }
        });
        return entities;
    }
    extractMetadata(content, options = {}) {
        const { includeLanguage = true, includeDates = true, includeEntities = true, customFields = {} } = options;
        const format = this.detectFormat(content);
        const extractor = this.extractors.find(e => (e instanceof MarkdownExtractor && format === 'markdown') ||
            (e instanceof TextExtractor && format === 'text'));
        if (!extractor) {
            throw new Error(`No extractor found for format: ${format}`);
        }
        const baseMetadata = extractor.extractMetadata(content);
        const metadata = {
            format,
            structure: baseMetadata.structure,
            statistics: baseMetadata.statistics
        };
        if (includeLanguage) {
            const languageResult = this.languageDetector.detectLanguage(content);
            if (languageResult.languageCode !== 'und') {
                metadata.language = {
                    code: languageResult.languageCode,
                    confidence: languageResult.confidence
                };
            }
        }
        if (includeDates) {
            const dates = this.extractDates(content);
            if (dates.length > 0) {
                metadata.dates = dates;
            }
        }
        if (includeEntities) {
            const entities = this.extractEntities(content);
            if (entities.length > 0) {
                metadata.entities = entities;
            }
        }
        if (Object.keys(customFields).length > 0) {
            metadata.customFields = {};
            for (const [key, extractor] of Object.entries(customFields)) {
                try {
                    metadata.customFields[key] = extractor(content);
                }
                catch (error) {
                    console.error(`Error extracting custom field ${key}:`, error);
                }
            }
        }
        return metadata;
    }
    registerExtractor(extractor) {
        this.extractors.unshift(extractor);
    }
}
//# sourceMappingURL=MetadataExtractor.js.map
import { LanguageDetector } from './LanguageDetector.js';

/**
 * Document metadata structure
 */
interface DocumentMetadata {
  format: string;
  language?: {
    code: string;
    confidence: number;
  };
  structure: {
    headings: Array<{
      level: number;
      text: string;
      position: number;
    }>;
    sections: Array<{
      title?: string;
      content: string;
      startPosition: number;
      endPosition: number;
    }>;
  };
  statistics: {
    totalLength: number;
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
  };
  dates?: Array<{
    value: Date;
    position: number;
    context: string;
  }>;
  entities?: Array<{
    type: string;
    value: string;
    position: number;
    context: string;
  }>;
  customFields?: Record<string, unknown>;
}

/**
 * Interface for format-specific metadata extractors
 */
interface FormatExtractor {
  canHandle(content: string): boolean;
  extractMetadata(content: string): Partial<DocumentMetadata>;
}

/**
 * Plain text metadata extractor
 */
class TextExtractor implements FormatExtractor {
  canHandle(content: string): boolean {
    return true; // Can handle any text
  }

  extractMetadata(content: string): Partial<DocumentMetadata> {
    const headings: DocumentMetadata['structure']['headings'] = [];
    const sections: DocumentMetadata['structure']['sections'] = [];
    
    // Split into paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    let currentPosition = 0;

    // Process each paragraph
    paragraphs.forEach((paragraph, index) => {
      // Check if paragraph looks like a heading
      const headingMatch = paragraph.match(/^(#{1,6})\s+(.+)$/m);
      if (headingMatch) {
        headings.push({
          level: headingMatch[1].length,
          text: headingMatch[2],
          position: currentPosition
        });
      }

      // Add section
      sections.push({
        content: paragraph,
        startPosition: currentPosition,
        endPosition: currentPosition + paragraph.length
      });

      currentPosition += paragraph.length + 2; // +2 for paragraph separator
    });

    // Calculate statistics
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

/**
 * Markdown metadata extractor
 */
class MarkdownExtractor implements FormatExtractor {
  canHandle(content: string): boolean {
    // Check for common Markdown indicators
    return /^#\s|[*_][\w\s]+[*_]|`[\w\s]+`|\[[\w\s]+\]\(.*\)/.test(content);
  }

  extractMetadata(content: string): Partial<DocumentMetadata> {
    const headings: DocumentMetadata['structure']['headings'] = [];
    const sections: DocumentMetadata['structure']['sections'] = [];
    
    // Split into lines
    const lines = content.split('\n');
    let currentPosition = 0;
    let currentSection = '';
    let sectionStart = 0;

    lines.forEach(line => {
      // Check for headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // Save previous section if exists
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
      } else {
        currentSection += line + '\n';
      }

      currentPosition += line.length + 1;
    });

    // Add final section
    if (currentSection) {
      sections.push({
        content: currentSection.trim(),
        startPosition: sectionStart,
        endPosition: currentPosition
      });
    }

    // Calculate statistics
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

/**
 * Main metadata extractor class
 */
export class MetadataExtractor {
  private extractors: FormatExtractor[];
  private languageDetector: LanguageDetector;

  constructor() {
    this.extractors = [
      new MarkdownExtractor(),
      new TextExtractor() // Fallback extractor
    ];
    this.languageDetector = new LanguageDetector();
  }

  /**
   * Detects the format of the content
   * @param content Content to analyze
   * @returns Detected format
   */
  private detectFormat(content: string): string {
    for (const extractor of this.extractors) {
      if (extractor.canHandle(content)) {
        return extractor instanceof MarkdownExtractor ? 'markdown' : 'text';
      }
    }
    return 'text';
  }

  /**
   * Extracts dates from text
   * @param content Text to analyze
   * @returns Array of found dates with context
   */
  private extractDates(content: string): NonNullable<DocumentMetadata['dates']> {
    const dates: NonNullable<DocumentMetadata['dates']> = [];
    
    // Match common date formats
    const datePatterns = [
      // ISO dates: 2024-03-24
      /\b(\d{4}-\d{2}-\d{2})\b/g,
      // US dates: 03/24/2024
      /\b(\d{2}\/\d{2}\/\d{4})\b/g,
      // Written dates: March 24, 2024
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
        } catch (err) {
          console.warn(`Failed to parse date: ${match[1]}`, err);
          continue;
        }
      }
    });

    return dates;
  }

  /**
   * Extracts named entities from text
   * @param content Text to analyze
   * @returns Array of found entities with context
   */
  private extractEntities(content: string): NonNullable<DocumentMetadata['entities']> {
    const entities: NonNullable<DocumentMetadata['entities']> = [];

    // Simple patterns for common entities
    const entityPatterns: Array<{ type: string; pattern: RegExp }> = [
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

  /**
   * Extracts metadata from the given content
   * @param content Content to analyze
   * @param options Optional extraction options
   * @returns Extracted metadata
   */
  extractMetadata(content: string, options: {
    includeLanguage?: boolean;
    includeDates?: boolean;
    includeEntities?: boolean;
    customFields?: Record<string, (content: string) => unknown>;
  } = {}): DocumentMetadata {
    const {
      includeLanguage = true,
      includeDates = true,
      includeEntities = true,
      customFields = {}
    } = options;

    // Detect format and get base metadata
    const format = this.detectFormat(content);
    const extractor = this.extractors.find(e => 
      (e instanceof MarkdownExtractor && format === 'markdown') ||
      (e instanceof TextExtractor && format === 'text')
    );

    if (!extractor) {
      throw new Error(`No extractor found for format: ${format}`);
    }

    const baseMetadata = extractor.extractMetadata(content);

    // Build complete metadata
    const metadata: DocumentMetadata = {
      format,
      structure: baseMetadata.structure!,
      statistics: baseMetadata.statistics!
    };

    // Add language detection if requested
    if (includeLanguage) {
      const languageResult = this.languageDetector.detectLanguage(content);
      if (languageResult.languageCode !== 'und') {
        metadata.language = {
          code: languageResult.languageCode,
          confidence: languageResult.confidence
        };
      }
    }

    // Add dates if requested
    if (includeDates) {
      const dates = this.extractDates(content);
      if (dates.length > 0) {
        metadata.dates = dates;
      }
    }

    // Add entities if requested
    if (includeEntities) {
      const entities = this.extractEntities(content);
      if (entities.length > 0) {
        metadata.entities = entities;
      }
    }

    // Add custom fields
    if (Object.keys(customFields).length > 0) {
      metadata.customFields = {};
      for (const [key, extractor] of Object.entries(customFields)) {
        try {
          metadata.customFields[key] = extractor(content);
        } catch (error) {
          console.error(`Error extracting custom field ${key}:`, error);
        }
      }
    }

    return metadata;
  }

  /**
   * Registers a new format extractor
   * @param extractor Format extractor to register
   */
  registerExtractor(extractor: FormatExtractor): void {
    this.extractors.unshift(extractor);
  }
} 
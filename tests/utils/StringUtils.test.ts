import { StringUtils } from '../../src/utils/StringUtils.js';

describe('StringUtils', () => {
  describe('normalizeString', () => {
    it('should convert to lowercase and remove special characters', () => {
      const input = 'Hello, World! @#$';
      const expected = 'hello world';
      expect(StringUtils.normalizeString(input)).toBe(expected);
    });

    it('should handle multiple spaces', () => {
      const input = '  Multiple   Spaces  ';
      const expected = 'multiple spaces';
      expect(StringUtils.normalizeString(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(StringUtils.normalizeString('')).toBe('');
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(StringUtils.levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should calculate correct distance for similar strings', () => {
      expect(StringUtils.levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(StringUtils.levenshteinDistance('', '')).toBe(0);
      expect(StringUtils.levenshteinDistance('abc', '')).toBe(3);
      expect(StringUtils.levenshteinDistance('', 'abc')).toBe(3);
    });
  });

  describe('calculateStringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(StringUtils.calculateStringSimilarity('test', 'test')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(StringUtils.calculateStringSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should return value between 0 and 1 for similar strings', () => {
      const similarity = StringUtils.calculateStringSimilarity('hello', 'helo');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('standardizeAbbreviations', () => {
    it('should standardize common abbreviations', () => {
      const input = 'ABC Corp and XYZ Inc';
      const expected = 'ABC Corporation and XYZ Incorporated';
      expect(StringUtils.standardizeAbbreviations(input)).toBe(expected);
    });

    it('should standardize address abbreviations', () => {
      const input = '123 Main St, First Ave';
      const expected = '123 Main Street, First Avenue';
      expect(StringUtils.standardizeAbbreviations(input)).toBe(expected);
    });

    it('should preserve unknown words', () => {
      const input = 'Unknown Word Here';
      expect(StringUtils.standardizeAbbreviations(input)).toBe(input);
    });

    it('should handle empty string', () => {
      expect(StringUtils.standardizeAbbreviations('')).toBe('');
    });
  });
}); 
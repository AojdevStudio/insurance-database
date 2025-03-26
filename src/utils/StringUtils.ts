/**
 * Utility class for string manipulation operations
 */
export class StringUtils {
  /**
   * Normalizes a string by converting to lowercase, removing special characters, and trimming
   * @param str The string to normalize
   * @returns Normalized string
   */
  static normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculates the Levenshtein distance between two strings
   * @param str1 First string
   * @param str2 Second string
   * @returns The Levenshtein distance
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculates string similarity based on Levenshtein distance
   * @param str1 First string
   * @param str2 Second string
   * @returns Similarity score between 0 and 1
   */
  static calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Standardizes common abbreviations in text
   * @param text Text containing abbreviations
   * @returns Text with standardized abbreviations
   */
  static standardizeAbbreviations(text: string): string {
    const abbreviations: Record<string, string> = {
      'corp': 'Corporation',
      'inc': 'Incorporated',
      'llc': 'LLC',
      'ltd': 'Limited',
      'st': 'Street',
      'ave': 'Avenue',
      'blvd': 'Boulevard',
      'rd': 'Road',
      'dr': 'Drive',
      'ln': 'Lane',
      'ct': 'Court',
      'cir': 'Circle',
      'plz': 'Plaza',
      'pkwy': 'Parkway'
    };

    return text.replace(/\b\w+\b/g, word => {
      const lower = word.toLowerCase();
      return abbreviations[lower] || word;
    });
  }
} 
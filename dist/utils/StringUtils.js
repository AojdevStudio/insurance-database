export class StringUtils {
    static normalizeString(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    static levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++)
            dp[i][0] = i;
        for (let j = 0; j <= n; j++)
            dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                }
                else {
                    dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
                }
            }
        }
        return dp[m][n];
    }
    static calculateStringSimilarity(str1, str2) {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return 1 - (distance / maxLength);
    }
    static standardizeAbbreviations(text) {
        const abbreviations = {
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
//# sourceMappingURL=StringUtils.js.map
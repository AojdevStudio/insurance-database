/**
 * Data Validator Service
 * 
 * Service for validating data consistency between implementations
 */

/**
 * Validation result
 */
interface ValidationResult {
  match: boolean;
  timestamp: Date;
  differences?: any;
  error?: string;
}

/**
 * Service for validating data consistency between implementations
 */
export class DataValidatorService {
  /**
   * Validation results
   * @private
   */
  private static validationResults: Record<string, ValidationResult[]> = {};
  
  /**
   * Maximum number of validation results to store per operation
   * @private
   */
  private static readonly MAX_RESULTS_PER_OPERATION = 100;
  
  /**
   * Compare results between old and new implementations
   * @param operationName - Operation name
   * @param oldImplementation - Function that returns a promise with the old implementation result
   * @param newImplementation - Function that returns a promise with the new implementation result
   * @returns Validation result
   */
  static async compareResults(
    operationName: string,
    oldImplementation: () => Promise<any>,
    newImplementation: () => Promise<any>
  ): Promise<ValidationResult> {
    try {
      // Execute both implementations
      const [oldResult, newResult] = await Promise.all([
        oldImplementation(),
        newImplementation()
      ]);
      
      // Compare results
      const match = this.deepEqual(oldResult, newResult);
      
      // Create validation result
      const result: ValidationResult = {
        match,
        timestamp: new Date(),
        differences: match ? undefined : this.findDifferences(oldResult, newResult)
      };
      
      // Record validation result
      this.recordValidationResult(operationName, result);
      
      return result;
    } catch (error) {
      // Create error result
      const result: ValidationResult = {
        match: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
      
      // Record validation result
      this.recordValidationResult(operationName, result);
      
      return result;
    }
  }
  
  /**
   * Record validation result
   * @param operationName - Operation name
   * @param result - Validation result
   * @private
   */
  private static recordValidationResult(
    operationName: string,
    result: ValidationResult
  ): void {
    if (!this.validationResults[operationName]) {
      this.validationResults[operationName] = [];
    }
    
    // Add the result
    this.validationResults[operationName].push(result);
    
    // Trim the results array if it gets too large
    if (this.validationResults[operationName].length > this.MAX_RESULTS_PER_OPERATION) {
      this.validationResults[operationName] = this.validationResults[operationName].slice(-this.MAX_RESULTS_PER_OPERATION);
    }
  }
  
  /**
   * Get validation results for a specific operation
   * @param operationName - Operation name
   * @param limit - Maximum number of results to return
   * @returns Array of validation results
   */
  static getValidationResults(
    operationName: string,
    limit?: number
  ): ValidationResult[] {
    const results = this.validationResults[operationName] || [];
    
    if (limit && limit > 0) {
      return results.slice(-limit);
    }
    
    return results;
  }
  
  /**
   * Get validation summary for all operations
   * @returns Validation summary
   */
  static getValidationSummary(): Record<string, {
    totalTests: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    latestResult: ValidationResult;
  }> {
    const summary: Record<string, any> = {};
    
    for (const [operationName, results] of Object.entries(this.validationResults)) {
      if (results.length === 0) {
        continue;
      }
      
      const totalTests = results.length;
      const successCount = results.filter(r => r.match).length;
      const failureCount = totalTests - successCount;
      const successRate = (successCount / totalTests) * 100;
      const latestResult = results[results.length - 1];
      
      summary[operationName] = {
        totalTests,
        successCount,
        failureCount,
        successRate,
        latestResult
      };
    }
    
    return summary;
  }
  
  /**
   * Clear validation results
   * @param operationName - Optional operation name (if not provided, all results are cleared)
   */
  static clearValidationResults(operationName?: string): void {
    if (operationName) {
      delete this.validationResults[operationName];
    } else {
      this.validationResults = {};
    }
  }
  
  /**
   * Deep equality check
   * @param a - First value
   * @param b - Second value
   * @returns Whether the values are deeply equal
   * @private
   */
  private static deepEqual(a: any, b: any): boolean {
    // Handle primitive types
    if (a === b) {
      return true;
    }
    
    // Handle null/undefined
    if (a == null || b == null) {
      return a === b;
    }
    
    // Handle different types
    if (typeof a !== typeof b) {
      return false;
    }
    
    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) {
          return false;
        }
      }
      
      return true;
    }
    
    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) {
        return false;
      }
      
      for (const key of keysA) {
        if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) {
          return false;
        }
      }
      
      return true;
    }
    
    // Handle other types
    return false;
  }
  
  /**
   * Find differences between objects
   * @param a - First object
   * @param b - Second object
   * @returns Object describing the differences
   * @private
   */
  private static findDifferences(a: any, b: any): any {
    // Handle primitive types, null/undefined
    if (a === b || a == null || b == null || typeof a !== typeof b) {
      return { old: a, new: b };
    }
    
    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      if (a.getTime() !== b.getTime()) {
        return { old: a.toISOString(), new: b.toISOString() };
      }
      return undefined;
    }
    
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return { 
          lengthDiff: { old: a.length, new: b.length },
          sample: { old: a.slice(0, 3), new: b.slice(0, 3) }
        };
      }
      
      const diffIndexes: number[] = [];
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) {
          diffIndexes.push(i);
          if (diffIndexes.length >= 3) break; // Limit to 3 differences
        }
      }
      
      if (diffIndexes.length > 0) {
        const diffs: Record<string, any> = {};
        for (const index of diffIndexes) {
          diffs[`index_${index}`] = this.findDifferences(a[index], b[index]);
        }
        return diffs;
      }
      
      return undefined;
    }
    
    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      const diffs: Record<string, any> = {};
      
      // Find keys in a but not in b
      for (const key of keysA) {
        if (!keysB.includes(key)) {
          diffs[key] = { old: a[key], new: undefined };
        }
      }
      
      // Find keys in b but not in a
      for (const key of keysB) {
        if (!keysA.includes(key)) {
          diffs[key] = { old: undefined, new: b[key] };
        }
      }
      
      // Find keys with different values
      for (const key of keysA) {
        if (keysB.includes(key) && !this.deepEqual(a[key], b[key])) {
          diffs[key] = this.findDifferences(a[key], b[key]);
        }
      }
      
      return Object.keys(diffs).length > 0 ? diffs : undefined;
    }
    
    // Handle other types
    return { old: a, new: b };
  }
}

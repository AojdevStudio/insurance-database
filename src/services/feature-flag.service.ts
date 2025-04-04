/**
 * Feature Flag Service
 * 
 * Provides functionality for toggling between old and new implementations
 */

/**
 * Service for managing feature flags
 */
export class FeatureFlagService {
  /**
   * Feature flags
   * @private
   */
  private static flags: Record<string, boolean> = {};
  
  /**
   * Request-scoped flags (for traffic splitting)
   * @private
   */
  private static requestFlags: Record<string, Record<string, boolean>> = {};
  
  /**
   * Initialize flags from environment variables or configuration
   */
  static initialize(): void {
    this.flags = {
      // Global flag for using Prisma
      usePrisma: process.env.USE_PRISMA === 'true',
      
      // Entity-specific flags
      usePrismaCarriers: process.env.USE_PRISMA_CARRIERS === 'true',
      usePrismaProcedures: process.env.USE_PRISMA_PROCEDURES === 'true',
      usePrismaGuidelines: process.env.USE_PRISMA_GUIDELINES === 'true',
      usePrismaNetworks: process.env.USE_PRISMA_NETWORKS === 'true',
      usePrismaPlans: process.env.USE_PRISMA_PLANS === 'true',
      
      // Feature-specific flags
      usePrismaSearch: process.env.USE_PRISMA_SEARCH === 'true',
      usePrismaImportExport: process.env.USE_PRISMA_IMPORT_EXPORT === 'true',
      
      // Add more granular flags as needed
    };
    
    console.log('Feature flags initialized:', this.flags);
  }
  
  /**
   * Get flag value
   * @param flagName - Name of the flag
   * @param requestId - Optional request ID for request-scoped flags
   * @returns Flag value
   */
  static isEnabled(flagName: string, requestId?: string): boolean {
    // If request ID is provided, check request-scoped flags first
    if (requestId && this.requestFlags[requestId] && this.requestFlags[requestId][flagName] !== undefined) {
      return this.requestFlags[requestId][flagName];
    }
    
    // Fall back to global flags
    return this.flags[flagName] || false;
  }
  
  /**
   * Set flag value (for runtime toggling)
   * @param flagName - Name of the flag
   * @param value - Flag value
   */
  static setFlag(flagName: string, value: boolean): void {
    this.flags[flagName] = value;
  }
  
  /**
   * Set request-scoped flag value (for traffic splitting)
   * @param requestId - Request ID
   * @param flagName - Name of the flag
   * @param value - Flag value
   */
  static setRequestFlag(requestId: string, flagName: string, value: boolean): void {
    if (!this.requestFlags[requestId]) {
      this.requestFlags[requestId] = {};
    }
    
    this.requestFlags[requestId][flagName] = value;
  }
  
  /**
   * Clear request-scoped flags for a request
   * @param requestId - Request ID
   */
  static clearRequestFlags(requestId: string): void {
    delete this.requestFlags[requestId];
  }
  
  /**
   * Get all flags
   * @returns All flags
   */
  static getAllFlags(): Record<string, boolean> {
    return { ...this.flags };
  }
  
  /**
   * Reset all flags to default values
   */
  static resetFlags(): void {
    this.initialize();
  }
}

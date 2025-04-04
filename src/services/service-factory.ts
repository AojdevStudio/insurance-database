/**
 * Service Factory
 * 
 * Factory for creating service instances based on feature flags
 */

import { FeatureFlagService } from './feature-flag.service';

// Import old services
import { CarrierService as OldCarrierService } from '../api/services/carrier.service';
import { ProcedureService as OldProcedureService } from '../api/services/procedure.service';
import { GuidelinesService as OldGuidelinesService } from '../api/services/guidelines.service';
import { FuzzyMatchingService as OldFuzzyMatchingService } from '../api/services/fuzzy-matching.service';

// Import Prisma services
import { CarrierService as PrismaCarrierService } from '../api/services/prisma/carrier.service';
import { ProcedureService as PrismaProcedureService } from '../api/services/prisma/procedure.service';
import { GuidelinesService as PrismaGuidelinesService } from '../api/services/prisma/guidelines.service';
import { FuzzyMatchingService as PrismaFuzzyMatchingService } from '../api/services/fuzzy-matching.service';
import { DataTransferService } from '../api/services/data-transfer.service';

/**
 * Factory for creating service instances based on feature flags
 */
export class ServiceFactory {
  /**
   * Get the appropriate carrier service based on feature flags
   * @param requestId - Optional request ID for request-scoped flags
   * @returns Carrier service instance
   */
  static getCarrierService(requestId?: string) {
    const usePrisma = FeatureFlagService.isEnabled('usePrisma', requestId);
    const usePrismaCarriers = FeatureFlagService.isEnabled('usePrismaCarriers', requestId);
    
    return (usePrisma || usePrismaCarriers) ? new PrismaCarrierService() : new OldCarrierService();
  }
  
  /**
   * Get the appropriate procedure service based on feature flags
   * @param requestId - Optional request ID for request-scoped flags
   * @returns Procedure service instance
   */
  static getProcedureService(requestId?: string) {
    const usePrisma = FeatureFlagService.isEnabled('usePrisma', requestId);
    const usePrismaProcedures = FeatureFlagService.isEnabled('usePrismaProcedures', requestId);
    
    return (usePrisma || usePrismaProcedures) ? new PrismaProcedureService() : new OldProcedureService();
  }
  
  /**
   * Get the appropriate guidelines service based on feature flags
   * @param requestId - Optional request ID for request-scoped flags
   * @returns Guidelines service instance
   */
  static getGuidelinesService(requestId?: string) {
    const usePrisma = FeatureFlagService.isEnabled('usePrisma', requestId);
    const usePrismaGuidelines = FeatureFlagService.isEnabled('usePrismaGuidelines', requestId);
    
    return (usePrisma || usePrismaGuidelines) ? new PrismaGuidelinesService() : new OldGuidelinesService();
  }
  
  /**
   * Get the appropriate fuzzy matching service based on feature flags
   * @param requestId - Optional request ID for request-scoped flags
   * @returns Fuzzy matching service instance
   */
  static getFuzzyMatchingService(requestId?: string) {
    const usePrisma = FeatureFlagService.isEnabled('usePrisma', requestId);
    const usePrismaSearch = FeatureFlagService.isEnabled('usePrismaSearch', requestId);
    
    return (usePrisma || usePrismaSearch) ? PrismaFuzzyMatchingService : OldFuzzyMatchingService;
  }
  
  /**
   * Get the data transfer service (Prisma-only)
   * @returns Data transfer service
   */
  static getDataTransferService() {
    return DataTransferService;
  }
}

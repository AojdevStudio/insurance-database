/**
 * Data Transfer Service
 * 
 * Handles data import and export operations with Prisma
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { prisma } from '../../lib/prisma-optimized';

// Import options
export interface ImportOptions {
  batchSize?: number;
  validateOnly?: boolean;
  updateExisting?: boolean;
  entityType: 'carrier' | 'procedure' | 'guideline' | 'network' | 'plan';
}

// Export options
export interface ExportOptions {
  format?: 'json' | 'csv';
  entityType: 'carrier' | 'procedure' | 'guideline' | 'network' | 'plan';
  filters?: Record<string, any>;
  includeRelations?: boolean;
  limit?: number;
  offset?: number;
}

// Import result
export interface ImportResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  createdRecords: number;
  updatedRecords: number;
  failedRecords: number;
  errors: Array<{ index: number; error: string }>;
  validationErrors?: Array<{ index: number; field: string; error: string }>;
}

// Export result
export interface ExportResult {
  success: boolean;
  totalRecords: number;
  data: any[];
  format: 'json' | 'csv';
  entityType: string;
  timestamp: string;
}

/**
 * Service for handling data import and export operations
 */
export class DataTransferService {
  // Default batch size for import operations
  private static readonly DEFAULT_BATCH_SIZE = 100;

  /**
   * Import data in batches with transaction support
   * @param data Array of data objects to import
   * @param options Import options
   * @returns Import result
   */
  static async batchImport(
    data: any[],
    options: ImportOptions
  ): Promise<ImportResult> {
    const {
      batchSize = this.DEFAULT_BATCH_SIZE,
      validateOnly = false,
      updateExisting = false,
      entityType
    } = options;

    // Initialize result
    const result: ImportResult = {
      success: true,
      totalRecords: data.length,
      processedRecords: 0,
      createdRecords: 0,
      updatedRecords: 0,
      failedRecords: 0,
      errors: [],
      validationErrors: []
    };

    try {
      // Validate data before processing
      const validationErrors = await this.validateImportData(data, entityType);
      
      if (validationErrors.length > 0) {
        result.success = false;
        result.validationErrors = validationErrors;
        return result;
      }

      // If validateOnly is true, return after validation
      if (validateOnly) {
        return result;
      }

      // Process data in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          // Process batch in a transaction
          const batchResult = await prisma.$transaction(async (tx) => {
            const batchResults = {
              created: 0,
              updated: 0,
              failed: 0,
              errors: [] as { index: number; error: string }[]
            };

            // Process each record in the batch
            for (let j = 0; j < batch.length; j++) {
              const record = batch[j];
              const recordIndex = i + j;
              
              try {
                const processed = await this.processImportRecord(
                  tx as PrismaClient,
                  record,
                  entityType,
                  updateExisting
                );
                
                if (processed.created) {
                  batchResults.created++;
                } else if (processed.updated) {
                  batchResults.updated++;
                }
              } catch (error) {
                batchResults.failed++;
                batchResults.errors.push({
                  index: recordIndex,
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
            
            return batchResults;
          });

          // Update result with batch results
          result.processedRecords += batch.length;
          result.createdRecords += batchResult.created;
          result.updatedRecords += batchResult.updated;
          result.failedRecords += batchResult.failed;
          result.errors.push(...batchResult.errors);
          
        } catch (error) {
          // Handle transaction error
          logger.error(`Error processing batch ${i / batchSize + 1}:`, error);
          
          // Mark all records in the batch as failed
          result.failedRecords += batch.length;
          
          for (let j = 0; j < batch.length; j++) {
            result.errors.push({
              index: i + j,
              error: 'Transaction failed: ' + (error instanceof Error ? error.message : String(error))
            });
          }
        }
      }

      // Set success based on whether all records were processed successfully
      result.success = result.failedRecords === 0;
      
      return result;
    } catch (error) {
      logger.error('Error in batch import:', error);
      
      return {
        ...result,
        success: false,
        errors: [
          ...result.errors,
          { index: -1, error: `Global import error: ${error instanceof Error ? error.message : String(error)}` }
        ]
      };
    }
  }

  /**
   * Export data with filtering and relation inclusion
   * @param options Export options
   * @returns Export result
   */
  static async exportData(
    options: ExportOptions
  ): Promise<ExportResult> {
    const {
      format = 'json',
      entityType,
      filters = {},
      includeRelations = false,
      limit,
      offset = 0
    } = options;

    try {
      // Get the appropriate model and include options based on entity type
      const { model, include } = this.getModelAndInclude(entityType, includeRelations);
      
      // Build the query
      const query: any = {
        where: filters,
        skip: offset,
        include: includeRelations ? include : undefined
      };
      
      // Add limit if specified
      if (limit) {
        query.take = limit;
      }
      
      // Execute the query
      const data = await (prisma as any)[model].findMany(query);
      
      // Transform data if needed (e.g., BigInt to Number)
      const transformedData = this.transformExportData(data, entityType);
      
      // Return the result
      return {
        success: true,
        totalRecords: transformedData.length,
        data: transformedData,
        format,
        entityType,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in data export:', error);
      throw new Error(`Failed to export ${entityType} data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate import data before processing
   * @param data Array of data objects to validate
   * @param entityType Type of entity being imported
   * @returns Array of validation errors
   */
  private static async validateImportData(
    data: any[],
    entityType: string
  ): Promise<Array<{ index: number; field: string; error: string }>> {
    const validationErrors: Array<{ index: number; field: string; error: string }> = [];
    
    // Validate each record based on entity type
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      switch (entityType) {
        case 'carrier':
          if (!record.carrierName) {
            validationErrors.push({ index: i, field: 'carrierName', error: 'Carrier name is required' });
          }
          break;
          
        case 'procedure':
          if (!record.procedureCode) {
            validationErrors.push({ index: i, field: 'procedureCode', error: 'Procedure code is required' });
          }
          if (!record.description) {
            validationErrors.push({ index: i, field: 'description', error: 'Description is required' });
          }
          break;
          
        case 'guideline':
          if (!record.title) {
            validationErrors.push({ index: i, field: 'title', error: 'Title is required' });
          }
          if (!record.content) {
            validationErrors.push({ index: i, field: 'content', error: 'Content is required' });
          }
          if (!record.carrierId) {
            validationErrors.push({ index: i, field: 'carrierId', error: 'Carrier ID is required' });
          }
          break;
          
        case 'network':
          if (!record.networkName) {
            validationErrors.push({ index: i, field: 'networkName', error: 'Network name is required' });
          }
          break;
          
        case 'plan':
          if (!record.planName) {
            validationErrors.push({ index: i, field: 'planName', error: 'Plan name is required' });
          }
          if (!record.carrierId) {
            validationErrors.push({ index: i, field: 'carrierId', error: 'Carrier ID is required' });
          }
          break;
          
        default:
          validationErrors.push({ index: i, field: 'entityType', error: `Unknown entity type: ${entityType}` });
      }
    }
    
    return validationErrors;
  }

  /**
   * Process a single import record
   * @param tx Prisma transaction client
   * @param record Record to import
   * @param entityType Type of entity being imported
   * @param updateExisting Whether to update existing records
   * @returns Object indicating whether the record was created or updated
   */
  private static async processImportRecord(
    tx: PrismaClient,
    record: any,
    entityType: string,
    updateExisting: boolean
  ): Promise<{ created: boolean; updated: boolean }> {
    // Initialize result
    const result = { created: false, updated: false };
    
    switch (entityType) {
      case 'carrier':
        return this.processCarrierRecord(tx, record, updateExisting);
        
      case 'procedure':
        return this.processProcedureRecord(tx, record, updateExisting);
        
      case 'guideline':
        return this.processGuidelineRecord(tx, record, updateExisting);
        
      case 'network':
        return this.processNetworkRecord(tx, record, updateExisting);
        
      case 'plan':
        return this.processPlanRecord(tx, record, updateExisting);
        
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Process a carrier record
   * @param tx Prisma transaction client
   * @param record Carrier record to import
   * @param updateExisting Whether to update existing records
   * @returns Object indicating whether the record was created or updated
   */
  private static async processCarrierRecord(
    tx: PrismaClient,
    record: any,
    updateExisting: boolean
  ): Promise<{ created: boolean; updated: boolean }> {
    // Check if carrier exists
    const existingCarrier = await tx.insuranceCarrier.findFirst({
      where: {
        OR: [
          { id: record.id ? BigInt(record.id) : undefined },
          { carrierName: record.carrierName }
        ]
      }
    });
    
    if (existingCarrier) {
      // Update existing carrier if updateExisting is true
      if (updateExisting) {
        await tx.insuranceCarrier.update({
          where: { id: existingCarrier.id },
          data: {
            carrierName: record.carrierName,
            carrierCode: record.carrierCode,
            active: record.active !== undefined ? record.active : true
          }
        });
        
        return { created: false, updated: true };
      }
      
      return { created: false, updated: false };
    }
    
    // Create new carrier
    await tx.insuranceCarrier.create({
      data: {
        id: record.id ? BigInt(record.id) : undefined,
        carrierName: record.carrierName,
        carrierCode: record.carrierCode,
        active: record.active !== undefined ? record.active : true
      }
    });
    
    return { created: true, updated: false };
  }

  /**
   * Process a procedure record
   * @param tx Prisma transaction client
   * @param record Procedure record to import
   * @param updateExisting Whether to update existing records
   * @returns Object indicating whether the record was created or updated
   */
  private static async processProcedureRecord(
    tx: PrismaClient,
    record: any,
    updateExisting: boolean
  ): Promise<{ created: boolean; updated: boolean }> {
    // Check if procedure exists
    const existingProcedure = await tx.procedure.findFirst({
      where: {
        OR: [
          { id: record.id ? BigInt(record.id) : undefined },
          { procedureCode: record.procedureCode }
        ]
      }
    });
    
    if (existingProcedure) {
      // Update existing procedure if updateExisting is true
      if (updateExisting) {
        await tx.procedure.update({
          where: { id: existingProcedure.id },
          data: {
            procedureCode: record.procedureCode,
            description: record.description,
            category: record.category,
            active: record.active !== undefined ? record.active : true
          }
        });
        
        return { created: false, updated: true };
      }
      
      return { created: false, updated: false };
    }
    
    // Create new procedure
    await tx.procedure.create({
      data: {
        id: record.id ? BigInt(record.id) : undefined,
        procedureCode: record.procedureCode,
        description: record.description,
        category: record.category,
        active: record.active !== undefined ? record.active : true
      }
    });
    
    return { created: true, updated: false };
  }

  /**
   * Process a guideline record
   * @param tx Prisma transaction client
   * @param record Guideline record to import
   * @param updateExisting Whether to update existing records
   * @returns Object indicating whether the record was created or updated
   */
  private static async processGuidelineRecord(
    tx: PrismaClient,
    record: any,
    updateExisting: boolean
  ): Promise<{ created: boolean; updated: boolean }> {
    // Check if guideline exists
    const existingGuideline = await tx.guideline.findFirst({
      where: {
        OR: [
          { id: record.id ? BigInt(record.id) : undefined },
          {
            AND: [
              { title: record.title },
              { carrierId: BigInt(record.carrierId) }
            ]
          }
        ]
      }
    });
    
    if (existingGuideline) {
      // Update existing guideline if updateExisting is true
      if (updateExisting) {
        await tx.guideline.update({
          where: { id: existingGuideline.id },
          data: {
            title: record.title,
            content: record.content,
            category: record.category,
            carrierId: BigInt(record.carrierId),
            active: record.active !== undefined ? record.active : true
          }
        });
        
        return { created: false, updated: true };
      }
      
      return { created: false, updated: false };
    }
    
    // Create new guideline
    await tx.guideline.create({
      data: {
        id: record.id ? BigInt(record.id) : undefined,
        title: record.title,
        content: record.content,
        category: record.category,
        carrierId: BigInt(record.carrierId),
        active: record.active !== undefined ? record.active : true
      }
    });
    
    return { created: true, updated: false };
  }

  /**
   * Process a network record
   * @param tx Prisma transaction client
   * @param record Network record to import
   * @param updateExisting Whether to update existing records
   * @returns Object indicating whether the record was created or updated
   */
  private static async processNetworkRecord(
    tx: PrismaClient,
    record: any,
    updateExisting: boolean
  ): Promise<{ created: boolean; updated: boolean }> {
    // Check if network exists
    const existingNetwork = await tx.network.findFirst({
      where: {
        OR: [
          { id: record.id ? BigInt(record.id) : undefined },
          { networkName: record.networkName }
        ]
      }
    });
    
    if (existingNetwork) {
      // Update existing network if updateExisting is true
      if (updateExisting) {
        await tx.network.update({
          where: { id: existingNetwork.id },
          data: {
            networkName: record.networkName,
            networkCode: record.networkCode,
            active: record.active !== undefined ? record.active : true
          }
        });
        
        return { created: false, updated: true };
      }
      
      return { created: false, updated: false };
    }
    
    // Create new network
    await tx.network.create({
      data: {
        id: record.id ? BigInt(record.id) : undefined,
        networkName: record.networkName,
        networkCode: record.networkCode,
        active: record.active !== undefined ? record.active : true
      }
    });
    
    return { created: true, updated: false };
  }

  /**
   * Process a plan record
   * @param tx Prisma transaction client
   * @param record Plan record to import
   * @param updateExisting Whether to update existing records
   * @returns Object indicating whether the record was created or updated
   */
  private static async processPlanRecord(
    tx: PrismaClient,
    record: any,
    updateExisting: boolean
  ): Promise<{ created: boolean; updated: boolean }> {
    // Check if plan exists
    const existingPlan = await tx.plan.findFirst({
      where: {
        OR: [
          { id: record.id ? BigInt(record.id) : undefined },
          {
            AND: [
              { planName: record.planName },
              { carrierId: BigInt(record.carrierId) }
            ]
          }
        ]
      }
    });
    
    if (existingPlan) {
      // Update existing plan if updateExisting is true
      if (updateExisting) {
        await tx.plan.update({
          where: { id: existingPlan.id },
          data: {
            planName: record.planName,
            planCode: record.planCode,
            carrierId: BigInt(record.carrierId),
            networkId: record.networkId ? BigInt(record.networkId) : undefined,
            active: record.active !== undefined ? record.active : true
          }
        });
        
        return { created: false, updated: true };
      }
      
      return { created: false, updated: false };
    }
    
    // Create new plan
    await tx.plan.create({
      data: {
        id: record.id ? BigInt(record.id) : undefined,
        planName: record.planName,
        planCode: record.planCode,
        carrierId: BigInt(record.carrierId),
        networkId: record.networkId ? BigInt(record.networkId) : undefined,
        active: record.active !== undefined ? record.active : true
      }
    });
    
    return { created: true, updated: false };
  }

  /**
   * Get the appropriate model and include options based on entity type
   * @param entityType Type of entity
   * @param includeRelations Whether to include relations
   * @returns Object with model and include options
   */
  private static getModelAndInclude(
    entityType: string,
    includeRelations: boolean
  ): { model: string; include: any } {
    switch (entityType) {
      case 'carrier':
        return {
          model: 'insuranceCarrier',
          include: includeRelations ? {
            plans: true,
            guidelines: true
          } : {}
        };
        
      case 'procedure':
        return {
          model: 'procedure',
          include: includeRelations ? {
            requirements: {
              include: {
                carrier: true
              }
            }
          } : {}
        };
        
      case 'guideline':
        return {
          model: 'guideline',
          include: includeRelations ? {
            carrier: true
          } : {}
        };
        
      case 'network':
        return {
          model: 'network',
          include: includeRelations ? {
            plans: {
              include: {
                carrier: true
              }
            }
          } : {}
        };
        
      case 'plan':
        return {
          model: 'plan',
          include: includeRelations ? {
            carrier: true,
            network: true
          } : {}
        };
        
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Transform export data (e.g., convert BigInt to Number)
   * @param data Data to transform
   * @param entityType Type of entity
   * @returns Transformed data
   */
  private static transformExportData(
    data: any[],
    entityType: string
  ): any[] {
    return data.map(item => {
      // Create a deep copy to avoid modifying the original
      const transformed = JSON.parse(JSON.stringify(item, (key, value) => {
        // Convert BigInt to Number
        if (typeof value === 'bigint') {
          return Number(value);
        }
        return value;
      }));
      
      return transformed;
    });
  }
}

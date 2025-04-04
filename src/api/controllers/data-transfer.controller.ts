/**
 * Data Transfer Controller
 * 
 * Handles data import and export operations
 */

import { Request, Response } from 'express';
import { DataTransferService } from '../services/data-transfer.service';
import { logger } from '../utils/logger';

/**
 * Controller for data import and export operations
 */
export class DataTransferController {
  /**
   * Import data in batches
   */
  static async importData(req: Request, res: Response): Promise<void> {
    try {
      const { data, options } = req.body;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        res.status(400).json({ error: 'Data array is required and must not be empty' });
        return;
      }
      
      if (!options || !options.entityType) {
        res.status(400).json({ error: 'Entity type is required in options' });
        return;
      }
      
      // Validate entity type
      const validEntityTypes = ['carrier', 'procedure', 'guideline', 'network', 'plan'];
      if (!validEntityTypes.includes(options.entityType)) {
        res.status(400).json({ 
          error: 'Invalid entity type', 
          validOptions: validEntityTypes 
        });
        return;
      }
      
      const result = await DataTransferService.batchImport(data, options);
      
      // If validation failed, return 400 status
      if (!result.success && result.validationErrors && result.validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          validationErrors: result.validationErrors
        });
        return;
      }
      
      res.json({
        success: result.success,
        totalRecords: result.totalRecords,
        processedRecords: result.processedRecords,
        createdRecords: result.createdRecords,
        updatedRecords: result.updatedRecords,
        failedRecords: result.failedRecords,
        errors: result.errors
      });
    } catch (error) {
      logger.error('Error in importData:', error);
      res.status(500).json({ 
        error: 'Failed to import data',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Export data with filtering and relation inclusion
   */
  static async exportData(req: Request, res: Response): Promise<void> {
    try {
      const { 
        entityType, 
        format, 
        filters, 
        includeRelations,
        limit,
        offset
      } = req.query;
      
      if (!entityType || typeof entityType !== 'string') {
        res.status(400).json({ error: 'Entity type is required' });
        return;
      }
      
      // Validate entity type
      const validEntityTypes = ['carrier', 'procedure', 'guideline', 'network', 'plan'];
      if (!validEntityTypes.includes(entityType)) {
        res.status(400).json({ 
          error: 'Invalid entity type', 
          validOptions: validEntityTypes 
        });
        return;
      }
      
      // Validate format if provided
      const validFormats = ['json', 'csv'];
      if (format && typeof format === 'string' && !validFormats.includes(format)) {
        res.status(400).json({ 
          error: 'Invalid format', 
          validOptions: validFormats 
        });
        return;
      }
      
      // Parse filters if provided
      let parsedFilters = {};
      if (filters && typeof filters === 'string') {
        try {
          parsedFilters = JSON.parse(filters);
        } catch (error) {
          res.status(400).json({ error: 'Invalid filters JSON' });
          return;
        }
      }
      
      const options = {
        entityType,
        format: format as 'json' | 'csv' | undefined,
        filters: parsedFilters,
        includeRelations: includeRelations === 'true',
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined
      };
      
      const result = await DataTransferService.exportData(options);
      
      // Set appropriate headers based on format
      if (result.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${entityType}_export_${result.timestamp}.csv`);
        
        // Convert JSON to CSV
        const csv = this.convertToCSV(result.data);
        res.send(csv);
      } else {
        res.json({
          success: result.success,
          totalRecords: result.totalRecords,
          data: result.data,
          format: result.format,
          entityType: result.entityType,
          timestamp: result.timestamp
        });
      }
    } catch (error) {
      logger.error('Error in exportData:', error);
      res.status(500).json({ 
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Validate import data without actually importing
   */
  static async validateImportData(req: Request, res: Response): Promise<void> {
    try {
      const { data, entityType } = req.body;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        res.status(400).json({ error: 'Data array is required and must not be empty' });
        return;
      }
      
      if (!entityType) {
        res.status(400).json({ error: 'Entity type is required' });
        return;
      }
      
      // Validate entity type
      const validEntityTypes = ['carrier', 'procedure', 'guideline', 'network', 'plan'];
      if (!validEntityTypes.includes(entityType)) {
        res.status(400).json({ 
          error: 'Invalid entity type', 
          validOptions: validEntityTypes 
        });
        return;
      }
      
      const result = await DataTransferService.batchImport(data, {
        entityType,
        validateOnly: true
      });
      
      res.json({
        success: result.success,
        totalRecords: result.totalRecords,
        validationErrors: result.validationErrors || []
      });
    } catch (error) {
      logger.error('Error in validateImportData:', error);
      res.status(500).json({ 
        error: 'Failed to validate import data',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Convert JSON data to CSV format
   * @param jsonData JSON data to convert
   * @returns CSV string
   */
  private static convertToCSV(jsonData: any[]): string {
    if (jsonData.length === 0) {
      return '';
    }
    
    // Get headers from the first object
    const headers = Object.keys(jsonData[0]);
    
    // Create CSV header row
    const csvRows = [headers.join(',')];
    
    // Add data rows
    for (const row of jsonData) {
      const values = headers.map(header => {
        const value = row[header];
        
        // Handle different value types
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'object') {
          // Convert objects to JSON strings
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else {
          // Escape quotes and wrap in quotes if the value contains commas or quotes
          const stringValue = String(value);
          return stringValue.includes(',') || stringValue.includes('"')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }
      });
      
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}

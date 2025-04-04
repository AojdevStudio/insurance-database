/**
 * Data Transfer Routes
 * 
 * Routes for data import and export operations
 */

import express from 'express';
import { DataTransferController } from '../controllers/data-transfer.controller';

const router = express.Router();

/**
 * @route   POST /api/data-transfer/import
 * @desc    Import data in batches
 * @access  Private
 * @body    {Array} data - Array of data objects to import
 * @body    {Object} options - Import options
 * @body    {string} options.entityType - Type of entity to import ('carrier', 'procedure', 'guideline', 'network', 'plan')
 * @body    {number} [options.batchSize=100] - Number of records to process in each batch
 * @body    {boolean} [options.validateOnly=false] - Whether to only validate the data without importing
 * @body    {boolean} [options.updateExisting=false] - Whether to update existing records
 */
router.post('/import', DataTransferController.importData);

/**
 * @route   GET /api/data-transfer/export
 * @desc    Export data with filtering and relation inclusion
 * @access  Private
 * @query   {string} entityType - Type of entity to export ('carrier', 'procedure', 'guideline', 'network', 'plan')
 * @query   {string} [format=json] - Export format ('json' or 'csv')
 * @query   {string} [filters] - JSON string of filters to apply
 * @query   {boolean} [includeRelations=false] - Whether to include related entities
 * @query   {number} [limit] - Maximum number of records to export
 * @query   {number} [offset=0] - Number of records to skip
 */
router.get('/export', DataTransferController.exportData);

/**
 * @route   POST /api/data-transfer/validate
 * @desc    Validate import data without actually importing
 * @access  Private
 * @body    {Array} data - Array of data objects to validate
 * @body    {string} entityType - Type of entity to validate ('carrier', 'procedure', 'guideline', 'network', 'plan')
 */
router.post('/validate', DataTransferController.validateImportData);

export default router;

/**
 * Data Transfer API Integration Tests
 * 
 * Tests for the data import and export API endpoints
 */

import request from 'supertest';
import app from '../../../src/api/app';
import { DataTransferService } from '../../../src/api/services/data-transfer.service';

// Mock the DataTransferService
jest.mock('../../../src/api/services/data-transfer.service');

describe('Data Transfer API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/data-transfer/import', () => {
    it('should import data successfully', async () => {
      // Mock data
      const requestBody = {
        data: [
          { carrierName: 'Test Carrier 1', carrierCode: 'TC1' },
          { carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
        ],
        options: {
          entityType: 'carrier',
          batchSize: 10,
          updateExisting: false
        }
      };

      // Mock service response
      const mockResult = {
        success: true,
        totalRecords: 2,
        processedRecords: 2,
        createdRecords: 2,
        updatedRecords: 0,
        failedRecords: 0,
        errors: []
      };

      // Mock the service method
      (DataTransferService.batchImport as jest.Mock).mockResolvedValue(mockResult);

      // Make the request
      const response = await request(app)
        .post('/api/data-transfer/import')
        .send(requestBody);

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalRecords).toBe(2);
      expect(response.body.createdRecords).toBe(2);
      expect(DataTransferService.batchImport).toHaveBeenCalledWith(
        requestBody.data,
        requestBody.options
      );
    });

    it('should return 400 when data array is missing', async () => {
      // Make the request without data
      const response = await request(app)
        .post('/api/data-transfer/import')
        .send({
          options: {
            entityType: 'carrier'
          }
        });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Data array is required and must not be empty');
      expect(DataTransferService.batchImport).not.toHaveBeenCalled();
    });

    it('should return 400 when entity type is missing', async () => {
      // Make the request without entity type
      const response = await request(app)
        .post('/api/data-transfer/import')
        .send({
          data: [{ carrierName: 'Test Carrier' }],
          options: {}
        });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Entity type is required in options');
      expect(DataTransferService.batchImport).not.toHaveBeenCalled();
    });

    it('should return 400 when entity type is invalid', async () => {
      // Make the request with invalid entity type
      const response = await request(app)
        .post('/api/data-transfer/import')
        .send({
          data: [{ carrierName: 'Test Carrier' }],
          options: {
            entityType: 'invalid'
          }
        });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entity type');
      expect(response.body.validOptions).toEqual(['carrier', 'procedure', 'guideline', 'network', 'plan']);
      expect(DataTransferService.batchImport).not.toHaveBeenCalled();
    });

    it('should return 400 when validation fails', async () => {
      // Mock data
      const requestBody = {
        data: [
          { /* Missing required fields */ }
        ],
        options: {
          entityType: 'carrier'
        }
      };

      // Mock service response with validation errors
      const mockResult = {
        success: false,
        totalRecords: 1,
        processedRecords: 0,
        createdRecords: 0,
        updatedRecords: 0,
        failedRecords: 0,
        errors: [],
        validationErrors: [
          { index: 0, field: 'carrierName', error: 'Carrier name is required' }
        ]
      };

      // Mock the service method
      (DataTransferService.batchImport as jest.Mock).mockResolvedValue(mockResult);

      // Make the request
      const response = await request(app)
        .post('/api/data-transfer/import')
        .send(requestBody);

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.validationErrors).toHaveLength(1);
    });

    it('should handle service errors gracefully', async () => {
      // Mock data
      const requestBody = {
        data: [
          { carrierName: 'Test Carrier' }
        ],
        options: {
          entityType: 'carrier'
        }
      };

      // Mock service error
      (DataTransferService.batchImport as jest.Mock).mockRejectedValue(new Error('Service error'));

      // Make the request
      const response = await request(app)
        .post('/api/data-transfer/import')
        .send(requestBody);

      // Assertions
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to import data');
      expect(response.body.message).toBe('Service error');
    });
  });

  describe('GET /api/data-transfer/export', () => {
    it('should export data successfully', async () => {
      // Mock service response
      const mockResult = {
        success: true,
        totalRecords: 2,
        data: [
          { id: 1, carrierName: 'Test Carrier 1', carrierCode: 'TC1' },
          { id: 2, carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
        ],
        format: 'json',
        entityType: 'carrier',
        timestamp: '2025-04-05T12:00:00.000Z'
      };

      // Mock the service method
      (DataTransferService.exportData as jest.Mock).mockResolvedValue(mockResult);

      // Make the request
      const response = await request(app)
        .get('/api/data-transfer/export')
        .query({ entityType: 'carrier' });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalRecords).toBe(2);
      expect(response.body.data).toHaveLength(2);
      expect(DataTransferService.exportData).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'carrier'
        })
      );
    });

    it('should return 400 when entity type is missing', async () => {
      // Make the request without entity type
      const response = await request(app)
        .get('/api/data-transfer/export');

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Entity type is required');
      expect(DataTransferService.exportData).not.toHaveBeenCalled();
    });

    it('should return 400 when entity type is invalid', async () => {
      // Make the request with invalid entity type
      const response = await request(app)
        .get('/api/data-transfer/export')
        .query({ entityType: 'invalid' });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entity type');
      expect(response.body.validOptions).toEqual(['carrier', 'procedure', 'guideline', 'network', 'plan']);
      expect(DataTransferService.exportData).not.toHaveBeenCalled();
    });

    it('should return 400 when format is invalid', async () => {
      // Make the request with invalid format
      const response = await request(app)
        .get('/api/data-transfer/export')
        .query({ entityType: 'carrier', format: 'invalid' });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid format');
      expect(response.body.validOptions).toEqual(['json', 'csv']);
      expect(DataTransferService.exportData).not.toHaveBeenCalled();
    });

    it('should return 400 when filters JSON is invalid', async () => {
      // Make the request with invalid filters JSON
      const response = await request(app)
        .get('/api/data-transfer/export')
        .query({ entityType: 'carrier', filters: 'invalid-json' });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid filters JSON');
      expect(DataTransferService.exportData).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Mock service error
      (DataTransferService.exportData as jest.Mock).mockRejectedValue(new Error('Service error'));

      // Make the request
      const response = await request(app)
        .get('/api/data-transfer/export')
        .query({ entityType: 'carrier' });

      // Assertions
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to export data');
      expect(response.body.message).toBe('Service error');
    });

    it('should export data in CSV format when requested', async () => {
      // Mock service response
      const mockResult = {
        success: true,
        totalRecords: 2,
        data: [
          { id: 1, carrierName: 'Test Carrier 1', carrierCode: 'TC1' },
          { id: 2, carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
        ],
        format: 'csv',
        entityType: 'carrier',
        timestamp: '2025-04-05T12:00:00.000Z'
      };

      // Mock the service method
      (DataTransferService.exportData as jest.Mock).mockResolvedValue(mockResult);

      // Make the request
      const response = await request(app)
        .get('/api/data-transfer/export')
        .query({ entityType: 'carrier', format: 'csv' });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('text/csv');
      expect(response.header['content-disposition']).toContain('attachment; filename=carrier_export_');
      expect(DataTransferService.exportData).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'carrier',
          format: 'csv'
        })
      );
    });
  });

  describe('POST /api/data-transfer/validate', () => {
    it('should validate data successfully', async () => {
      // Mock data
      const requestBody = {
        data: [
          { carrierName: 'Test Carrier 1', carrierCode: 'TC1' },
          { carrierName: 'Test Carrier 2', carrierCode: 'TC2' }
        ],
        entityType: 'carrier'
      };

      // Mock service response
      const mockResult = {
        success: true,
        totalRecords: 2,
        validationErrors: []
      };

      // Mock the service method
      (DataTransferService.batchImport as jest.Mock).mockResolvedValue(mockResult);

      // Make the request
      const response = await request(app)
        .post('/api/data-transfer/validate')
        .send(requestBody);

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalRecords).toBe(2);
      expect(response.body.validationErrors).toHaveLength(0);
      expect(DataTransferService.batchImport).toHaveBeenCalledWith(
        requestBody.data,
        {
          entityType: 'carrier',
          validateOnly: true
        }
      );
    });

    it('should return validation errors when data is invalid', async () => {
      // Mock data
      const requestBody = {
        data: [
          { /* Missing required fields */ }
        ],
        entityType: 'carrier'
      };

      // Mock service response with validation errors
      const mockResult = {
        success: false,
        totalRecords: 1,
        validationErrors: [
          { index: 0, field: 'carrierName', error: 'Carrier name is required' }
        ]
      };

      // Mock the service method
      (DataTransferService.batchImport as jest.Mock).mockResolvedValue(mockResult);

      // Make the request
      const response = await request(app)
        .post('/api/data-transfer/validate')
        .send(requestBody);

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.validationErrors).toHaveLength(1);
    });

    it('should return 400 when data array is missing', async () => {
      // Make the request without data
      const response = await request(app)
        .post('/api/data-transfer/validate')
        .send({
          entityType: 'carrier'
        });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Data array is required and must not be empty');
      expect(DataTransferService.batchImport).not.toHaveBeenCalled();
    });

    it('should return 400 when entity type is missing', async () => {
      // Make the request without entity type
      const response = await request(app)
        .post('/api/data-transfer/validate')
        .send({
          data: [{ carrierName: 'Test Carrier' }]
        });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Entity type is required');
      expect(DataTransferService.batchImport).not.toHaveBeenCalled();
    });

    it('should return 400 when entity type is invalid', async () => {
      // Make the request with invalid entity type
      const response = await request(app)
        .post('/api/data-transfer/validate')
        .send({
          data: [{ carrierName: 'Test Carrier' }],
          entityType: 'invalid'
        });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid entity type');
      expect(response.body.validOptions).toEqual(['carrier', 'procedure', 'guideline', 'network', 'plan']);
      expect(DataTransferService.batchImport).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Mock data
      const requestBody = {
        data: [
          { carrierName: 'Test Carrier' }
        ],
        entityType: 'carrier'
      };

      // Mock service error
      (DataTransferService.batchImport as jest.Mock).mockRejectedValue(new Error('Service error'));

      // Make the request
      const response = await request(app)
        .post('/api/data-transfer/validate')
        .send(requestBody);

      // Assertions
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to validate import data');
      expect(response.body.message).toBe('Service error');
    });
  });
});

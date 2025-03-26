import { Response } from 'express';
import { GuidelineController } from '../guidelines.controller.js';
import { GuidelineService } from '../../services/guidelines.service.js';
import type { IGuidelineSearchRequest } from '../../types/guidelines.js';
import { logger } from '../../utils/logger.js';

// Mock the GuidelineService
jest.mock('../../services/guidelines.service.js');
jest.mock('../../utils/logger.js');

describe('GuidelineController', () => {
  let mockRequest: Partial<IGuidelineSearchRequest>;
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup response spies
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnThis();
    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
    };

    // Setup request mock
    mockRequest = {
      query: {
        query: 'test query',
        limit: 10,
        page: 1,
      },
    };
  });

  describe('searchGuidelines', () => {
    it('should return search results successfully', async () => {
      const mockResults = { results: ['result1', 'result2'] };
      (GuidelineService.searchGuidelines as jest.Mock).mockResolvedValue(mockResults);

      await GuidelineController.searchGuidelines(
        mockRequest as IGuidelineSearchRequest,
        mockResponse as Response
      );

      expect(GuidelineService.searchGuidelines).toHaveBeenCalledWith(mockRequest.query);
      expect(jsonSpy).toHaveBeenCalledWith(mockResults);
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should handle errors appropriately', async () => {
      const error = new Error('Search failed');
      (GuidelineService.searchGuidelines as jest.Mock).mockRejectedValue(error);

      await GuidelineController.searchGuidelines(
        mockRequest as IGuidelineSearchRequest,
        mockResponse as Response
      );

      expect(logger.error).toHaveBeenCalledWith('Error searching guidelines:', error);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Failed to search guidelines' });
    });
  });

  describe('semanticSearch', () => {
    it('should return semantic search results successfully', async () => {
      const mockResults = { results: ['semantic1', 'semantic2'] };
      (GuidelineService.semanticSearch as jest.Mock).mockResolvedValue(mockResults);

      await GuidelineController.semanticSearch(
        mockRequest as IGuidelineSearchRequest,
        mockResponse as Response
      );

      expect(GuidelineService.semanticSearch).toHaveBeenCalledWith(mockRequest.query);
      expect(jsonSpy).toHaveBeenCalledWith(mockResults);
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should handle missing query error with 400 status', async () => {
      const error = new Error('Query is required for semantic search');
      (GuidelineService.semanticSearch as jest.Mock).mockRejectedValue(error);

      await GuidelineController.semanticSearch(
        mockRequest as IGuidelineSearchRequest,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Query is required for semantic search' });
    });

    it('should handle general errors with 500 status', async () => {
      const error = new Error('Unexpected error');
      (GuidelineService.semanticSearch as jest.Mock).mockRejectedValue(error);

      await GuidelineController.semanticSearch(
        mockRequest as IGuidelineSearchRequest,
        mockResponse as Response
      );

      expect(logger.error).toHaveBeenCalledWith('Error performing semantic search:', error);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Failed to perform semantic search' });
    });
  });
}); 
import { GuidelineController } from '../guidelines.controller.js';
import { GuidelineService } from '../../services/guidelines.service.js';
import { logger } from '../../utils/logger.js';
jest.mock('../../services/guidelines.service.js');
jest.mock('../../utils/logger.js');
describe('GuidelineController', () => {
    let mockRequest;
    let mockResponse;
    let jsonSpy;
    let statusSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        jsonSpy = jest.fn();
        statusSpy = jest.fn().mockReturnThis();
        mockResponse = {
            json: jsonSpy,
            status: statusSpy,
        };
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
            GuidelineService.searchGuidelines.mockResolvedValue(mockResults);
            await GuidelineController.searchGuidelines(mockRequest, mockResponse);
            expect(GuidelineService.searchGuidelines).toHaveBeenCalledWith(mockRequest.query);
            expect(jsonSpy).toHaveBeenCalledWith(mockResults);
            expect(statusSpy).not.toHaveBeenCalled();
        });
        it('should handle errors appropriately', async () => {
            const error = new Error('Search failed');
            GuidelineService.searchGuidelines.mockRejectedValue(error);
            await GuidelineController.searchGuidelines(mockRequest, mockResponse);
            expect(logger.error).toHaveBeenCalledWith('Error searching guidelines:', error);
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(jsonSpy).toHaveBeenCalledWith({ error: 'Failed to search guidelines' });
        });
    });
    describe('semanticSearch', () => {
        it('should return semantic search results successfully', async () => {
            const mockResults = { results: ['semantic1', 'semantic2'] };
            GuidelineService.semanticSearch.mockResolvedValue(mockResults);
            await GuidelineController.semanticSearch(mockRequest, mockResponse);
            expect(GuidelineService.semanticSearch).toHaveBeenCalledWith(mockRequest.query);
            expect(jsonSpy).toHaveBeenCalledWith(mockResults);
            expect(statusSpy).not.toHaveBeenCalled();
        });
        it('should handle missing query error with 400 status', async () => {
            const error = new Error('Query is required for semantic search');
            GuidelineService.semanticSearch.mockRejectedValue(error);
            await GuidelineController.semanticSearch(mockRequest, mockResponse);
            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(jsonSpy).toHaveBeenCalledWith({ error: 'Query is required for semantic search' });
        });
        it('should handle general errors with 500 status', async () => {
            const error = new Error('Unexpected error');
            GuidelineService.semanticSearch.mockRejectedValue(error);
            await GuidelineController.semanticSearch(mockRequest, mockResponse);
            expect(logger.error).toHaveBeenCalledWith('Error performing semantic search:', error);
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(jsonSpy).toHaveBeenCalledWith({ error: 'Failed to perform semantic search' });
        });
    });
});
//# sourceMappingURL=guidelines.controller.test.js.map
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { ProcedureService } from '../../services/procedure.service.js';
import procedureRoutes from '../procedure.routes.js';
jest.mock('../../services/procedure.service.js');
const mockProcedureService = ProcedureService;
describe('Procedure Routes', () => {
    let app;
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/procedures', procedureRoutes);
        jest.clearAllMocks();
    });
    describe('GET /api/procedures', () => {
        it('should return a list of procedures', async () => {
            const mockProcedures = {
                procedures: [
                    {
                        id: 1,
                        code: 'TEST1',
                        description: 'A test medical procedure',
                        category: 'Test Category',
                        subcategory: 'Test Subcategory',
                        created_at: new Date('2024-03-24T12:00:00Z')
                    }
                ],
                total: 1,
                page: 1,
                limit: 10,
                total_pages: 1
            };
            const expectedResponse = {
                ...mockProcedures,
                procedures: mockProcedures.procedures.map(procedure => ({
                    ...procedure,
                    created_at: procedure.created_at.toISOString()
                }))
            };
            mockProcedureService.listProcedures.mockResolvedValue(mockProcedures);
            const response = await request(app)
                .get('/api/procedures')
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual(expectedResponse);
        });
        it('should handle pagination parameters', async () => {
            await request(app)
                .get('/api/procedures?page=2&limit=20')
                .expect(200);
            expect(mockProcedureService.listProcedures).toHaveBeenCalledWith({
                page: 2,
                limit: 20
            });
        });
        it('should handle sorting parameters', async () => {
            await request(app)
                .get('/api/procedures?sort_by=code&sort_order=desc')
                .expect(200);
            expect(mockProcedureService.listProcedures).toHaveBeenCalledWith({
                sort_by: 'code',
                sort_order: 'desc'
            });
        });
        it('should handle filtering by category', async () => {
            await request(app)
                .get('/api/procedures?category=Test')
                .expect(200);
            expect(mockProcedureService.listProcedures).toHaveBeenCalledWith({
                category: 'Test'
            });
        });
        it('should handle service errors', async () => {
            mockProcedureService.listProcedures.mockRejectedValue(new Error('Database error'));
            await request(app)
                .get('/api/procedures')
                .expect(500)
                .expect({
                error: 'Failed to list procedures'
            });
        });
    });
    describe('GET /api/procedures/search', () => {
        it('should search procedures by query', async () => {
            const mockSearchResults = {
                procedures: [
                    {
                        id: 1,
                        code: 'TEST1',
                        description: 'A test medical procedure',
                        category: 'Test Category',
                        subcategory: 'Test Subcategory',
                        created_at: new Date('2024-03-24T12:00:00Z')
                    }
                ],
                total: 1,
                page: 1,
                limit: 10,
                total_pages: 1
            };
            const expectedResponse = {
                ...mockSearchResults,
                procedures: mockSearchResults.procedures.map(procedure => ({
                    ...procedure,
                    created_at: procedure.created_at.toISOString()
                }))
            };
            mockProcedureService.searchProcedures.mockResolvedValue(mockSearchResults);
            const response = await request(app)
                .get('/api/procedures/search?query=test')
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual(expectedResponse);
            expect(mockProcedureService.searchProcedures).toHaveBeenCalledWith({
                query: 'test'
            });
        });
        it('should handle empty search results', async () => {
            const mockEmptyResults = {
                procedures: [],
                total: 0,
                page: 1,
                limit: 10,
                total_pages: 0
            };
            mockProcedureService.searchProcedures.mockResolvedValue(mockEmptyResults);
            const response = await request(app)
                .get('/api/procedures/search?query=nonexistent')
                .expect(200);
            expect(response.body).toEqual(mockEmptyResults);
        });
        it('should handle service errors', async () => {
            mockProcedureService.searchProcedures.mockRejectedValue(new Error('Search error'));
            await request(app)
                .get('/api/procedures/search?query=test')
                .expect(500)
                .expect({
                error: 'Failed to search procedures'
            });
        });
    });
    describe('GET /api/procedures/:code', () => {
        it('should return a procedure by code', async () => {
            const mockProcedure = {
                id: 1,
                code: 'TEST1',
                description: 'A test medical procedure',
                category: 'Test Category',
                subcategory: 'Test Subcategory',
                created_at: new Date('2024-03-24T12:00:00Z')
            };
            const expectedResponse = {
                ...mockProcedure,
                created_at: mockProcedure.created_at.toISOString()
            };
            mockProcedureService.getProcedureByCode.mockResolvedValue(mockProcedure);
            const response = await request(app)
                .get('/api/procedures/TEST1')
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual(expectedResponse);
        });
        it('should handle invalid procedure code', async () => {
            await request(app)
                .get('/api/procedures/invalid')
                .expect(400)
                .expect({
                error: 'Invalid procedure code format'
            });
        });
        it('should handle non-existent procedure', async () => {
            mockProcedureService.getProcedureByCode.mockRejectedValue(new Error('Procedure not found'));
            await request(app)
                .get('/api/procedures/TEST2')
                .expect(404)
                .expect({
                error: 'Procedure not found'
            });
        });
        it('should handle service errors', async () => {
            mockProcedureService.getProcedureByCode.mockRejectedValue(new Error('Database error'));
            await request(app)
                .get('/api/procedures/TEST1')
                .expect(500)
                .expect({
                error: 'Failed to get procedure'
            });
        });
    });
});
//# sourceMappingURL=procedure.routes.test.js.map
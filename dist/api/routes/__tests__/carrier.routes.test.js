import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { CarrierService } from '../../services/carrier.service.js';
import carrierRoutes from '../carrier.routes.js';
jest.mock('../../services/carrier.service.js');
const mockCarrierService = CarrierService;
describe('Carrier Routes', () => {
    let app;
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/carriers', carrierRoutes);
        jest.clearAllMocks();
    });
    describe('GET /api/carriers', () => {
        it('should return a list of carriers', async () => {
            const mockCarriers = {
                carriers: [
                    {
                        id: 1,
                        name: 'Test Carrier',
                        code: 'TEST',
                        contact_info: {
                            phone: '123-456-7890',
                            email: 'test@example.com',
                            address: '123 Test St'
                        },
                        website: 'https://test.com',
                        created_at: new Date('2024-03-24T12:00:00Z')
                    }
                ],
                total: 1,
                page: 1,
                limit: 10,
                total_pages: 1
            };
            const expectedResponse = {
                ...mockCarriers,
                carriers: mockCarriers.carriers.map(carrier => ({
                    ...carrier,
                    created_at: carrier.created_at instanceof Date ? carrier.created_at.toISOString() : carrier.created_at
                }))
            };
            mockCarrierService.listCarriers.mockResolvedValue(mockCarriers);
            const response = await request(app)
                .get('/api/carriers')
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual(expectedResponse);
        });
        it('should handle pagination parameters', async () => {
            await request(app)
                .get('/api/carriers?page=2&limit=20')
                .expect(200);
            expect(mockCarrierService.listCarriers).toHaveBeenCalledWith({
                page: '2',
                limit: '20'
            });
        });
        it('should handle sorting parameters', async () => {
            await request(app)
                .get('/api/carriers?sort_by=name&sort_order=desc')
                .expect(200);
            expect(mockCarrierService.listCarriers).toHaveBeenCalledWith({
                sort_by: 'name',
                sort_order: 'desc'
            });
        });
        it('should handle service errors', async () => {
            mockCarrierService.listCarriers.mockRejectedValue(new Error('Database error'));
            await request(app)
                .get('/api/carriers')
                .expect(500)
                .expect({
                error: 'Failed to list carriers'
            });
        });
    });
    describe('GET /api/carriers/search', () => {
        it('should search carriers by query', async () => {
            const mockSearchResults = {
                carriers: [
                    {
                        id: 1,
                        name: 'Test Carrier',
                        code: 'TEST',
                        contact_info: null,
                        website: null,
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
                carriers: mockSearchResults.carriers.map(carrier => ({
                    ...carrier,
                    created_at: carrier.created_at instanceof Date ? carrier.created_at.toISOString() : carrier.created_at
                }))
            };
            mockCarrierService.searchCarriers.mockResolvedValue(mockSearchResults);
            const response = await request(app)
                .get('/api/carriers/search?query=test')
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual(expectedResponse);
            expect(mockCarrierService.searchCarriers).toHaveBeenCalledWith({
                query: 'test'
            });
        });
        it('should handle empty search results', async () => {
            const mockEmptyResults = {
                carriers: [],
                total: 0,
                page: 1,
                limit: 10,
                total_pages: 0
            };
            mockCarrierService.searchCarriers.mockResolvedValue(mockEmptyResults);
            const response = await request(app)
                .get('/api/carriers/search?query=nonexistent')
                .expect(200);
            expect(response.body).toEqual(mockEmptyResults);
        });
        it('should handle service errors', async () => {
            mockCarrierService.searchCarriers.mockRejectedValue(new Error('Search error'));
            await request(app)
                .get('/api/carriers/search?query=test')
                .expect(500)
                .expect({
                error: 'Failed to search carriers'
            });
        });
    });
    describe('GET /api/carriers/:id', () => {
        it('should return a carrier by ID', async () => {
            const mockCarrier = {
                id: 1,
                name: 'Test Carrier',
                code: 'TEST',
                contact_info: {
                    phone: '123-456-7890',
                    email: 'test@example.com',
                    address: '123 Test St'
                },
                website: 'https://test.com',
                created_at: new Date('2024-03-24T12:00:00Z')
            };
            const expectedResponse = {
                ...mockCarrier,
                created_at: mockCarrier.created_at instanceof Date ? mockCarrier.created_at.toISOString() : mockCarrier.created_at
            };
            mockCarrierService.getCarrierById.mockResolvedValue(mockCarrier);
            const response = await request(app)
                .get('/api/carriers/1')
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual(expectedResponse);
        });
        it('should handle invalid carrier ID', async () => {
            await request(app)
                .get('/api/carriers/invalid')
                .expect(400)
                .expect({
                error: 'Invalid carrier ID'
            });
        });
        it('should handle non-existent carrier', async () => {
            mockCarrierService.getCarrierById.mockRejectedValue(new Error('Carrier not found'));
            await request(app)
                .get('/api/carriers/999')
                .expect(404)
                .expect({
                error: 'Carrier not found'
            });
        });
        it('should handle service errors', async () => {
            mockCarrierService.getCarrierById.mockRejectedValue(new Error('Database error'));
            await request(app)
                .get('/api/carriers/1')
                .expect(500)
                .expect({
                error: 'Failed to get carrier'
            });
        });
    });
});
//# sourceMappingURL=carrier.routes.test.js.map
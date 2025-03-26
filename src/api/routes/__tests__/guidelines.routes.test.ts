import request from 'supertest';
import type { SuperTest, Test } from 'supertest';
import express, { Express } from 'express';
import guidelinesRoutes from '../guidelines.routes.js';
import { GuidelineController } from '../../controllers/guidelines.controller.js';

// Mock the GuidelineController
jest.mock('../../controllers/guidelines.controller.js');

describe('Guidelines Routes', () => {
  let app: Express;
  let agent: SuperTest<Test>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/guidelines', guidelinesRoutes);
    agent = request(app);
  });

  describe('GET /api/guidelines/search', () => {
    it('should validate search query parameters', async () => {
      const response = await agent
        .get('/api/guidelines/search')
        .query({
          query: 'test',
          limit: '10',
          page: '1',
        });

      expect(response.status).not.toBe(400);
      expect(GuidelineController.searchGuidelines).toHaveBeenCalled();
    });

    it('should reject invalid query parameters', async () => {
      const response = await agent
        .get('/api/guidelines/search')
        .query({
          limit: 'invalid',
          page: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should enforce rate limiting', async () => {
      // Make multiple requests to trigger rate limit
      const requests = Array(101).fill(null).map(() =>
        agent
          .get('/api/guidelines/search')
          .query({ query: 'test' })
      );

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body).toHaveProperty('error', 'Too many search requests, please try again later');
    });
  });

  describe('GET /api/guidelines/semantic-search', () => {
    it('should validate semantic search query parameters', async () => {
      const response = await agent
        .get('/api/guidelines/semantic-search')
        .query({
          query: 'test query',
          limit: '10',
          min_similarity: '0.5',
        });

      expect(response.status).not.toBe(400);
      expect(GuidelineController.semanticSearch).toHaveBeenCalled();
    });

    it('should require query parameter', async () => {
      const response = await agent
        .get('/api/guidelines/semantic-search')
        .query({
          limit: '10',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate min_similarity parameter', async () => {
      const response = await agent
        .get('/api/guidelines/semantic-search')
        .query({
          query: 'test',
          min_similarity: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should enforce rate limiting', async () => {
      // Make multiple requests to trigger rate limit
      const requests = Array(51).fill(null).map(() =>
        agent
          .get('/api/guidelines/semantic-search')
          .query({ query: 'test' })
      );

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body).toHaveProperty('error', 'Too many semantic search requests, please try again later');
    });
  });
}); 
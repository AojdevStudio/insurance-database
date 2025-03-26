import request from 'supertest';
import { Express } from 'express';
import { setupIntegrationTests, teardownIntegrationTests, resetTestDatabase } from '../setup.js';
import app from '../../../src/api/app.js';

describe('Guidelines API Integration Tests', () => {
  let testApp: Express;

  beforeAll(async () => {
    await setupIntegrationTests();
    testApp = app;
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('GET /api/guidelines/search', () => {
    it('should return guidelines matching search query', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/search')
        .query({
          query: 'test guideline',
          limit: '10',
          page: '1',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(response.body.guidelines).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.guidelines[0]).toHaveProperty('title', 'Test Guideline 1');
    });

    it('should filter guidelines by carrier', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/search')
        .query({
          carrier_id: '1',
          limit: '10',
          page: '1',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(response.body.guidelines).toHaveLength(1);
      expect(response.body.guidelines[0]).toHaveProperty('carrier_id', 1);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/search')
        .query({
          limit: '1',
          page: '2',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(response.body.guidelines).toHaveLength(1);
      expect(response.body.page).toBe(2);
      expect(response.body.total_pages).toBe(2);
    });

    it('should handle invalid query parameters', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/search')
        .query({
          limit: 'invalid',
          page: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/guidelines/semantic-search', () => {
    it('should return semantically similar guidelines', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/semantic-search')
        .query({
          query: 'test guideline carrier one',
          limit: '10',
          min_similarity: '0.5',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(response.body.guidelines[0]).toHaveProperty('similarity');
      expect(response.body.guidelines[0].similarity).toBeGreaterThan(0);
    });

    it('should require query parameter', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/semantic-search')
        .query({
          limit: '10',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate min_similarity parameter', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/semantic-search')
        .query({
          query: 'test',
          min_similarity: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle no results found', async () => {
      const response = await request(testApp)
        .get('/api/guidelines/semantic-search')
        .query({
          query: 'completely unrelated query that should not match anything',
          min_similarity: '0.9',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guidelines');
      expect(response.body.guidelines).toHaveLength(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on search endpoint', async () => {
      const requests = Array(101).fill(null).map(() =>
        request(testApp)
          .get('/api/guidelines/search')
          .query({ query: 'test' })
      );

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body).toHaveProperty('error', 'Too many search requests, please try again later');
    });

    it('should enforce rate limits on semantic search endpoint', async () => {
      const requests = Array(51).fill(null).map(() =>
        request(testApp)
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
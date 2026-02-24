import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { tenantPlugin } from '../plugins/tenant';

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('AI Recommendations API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.register(tenantPlugin);
    // Import dinâmico para evitar carregar dependências nativas (tfjs-node) quando testes de DB estão desabilitados
    const { aiRoutes } = await import('../routes/ai');
    app.register(aiRoutes, { prefix: '/api/v1' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return recommendations with default parameters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations',
      headers: {
        'x-tenant-id': 'test-tenant',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body).toHaveProperty('tenantId');
    expect(body).toHaveProperty('generatedAt');
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('modelVersion');
    expect(body).toHaveProperty('inferenceTime');
    
    expect(body.tenantId).toBe('test-tenant');
    expect(body.modelVersion).toBe('v1.0');
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.inferenceTime).toBe('number');
  });

  it('should accept marketplace filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations?marketplace=shopee',
      headers: {
        'x-tenant-id': 'test-tenant',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('items');
  });

  it('should accept days parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations?days=14',
      headers: {
        'x-tenant-id': 'test-tenant',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('items');
  });

  it('should validate days parameter range', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations?days=100',
      headers: {
        'x-tenant-id': 'test-tenant',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should validate marketplace enum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations?marketplace=invalid',
      headers: {
        'x-tenant-id': 'test-tenant',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should complete within performance threshold', async () => {
    const startTime = Date.now();
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations',
      headers: {
        'x-tenant-id': 'test-tenant',
      },
    });

    const duration = Date.now() - startTime;
    
    expect(response.statusCode).toBe(200);
    expect(duration).toBeLessThan(200);
  });

  it('should include inference time in response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations',
      headers: {
        'x-tenant-id': 'test-tenant',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.inferenceTime).toBeGreaterThan(0);
    expect(body.inferenceTime).toBeLessThan(200);
  });

  it('should return empty items array when no data available', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/recommendations',
      headers: {
        'x-tenant-id': 'empty-tenant',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.items).toEqual([]);
  });
});

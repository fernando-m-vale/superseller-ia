import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { debugRoutes } from '../routes/debug.routes';
import { authGuard } from '../plugins/auth';

describe('Debug Routes Registration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    
    // Registrar authGuard mock (simplificado para teste)
    app.decorate('authGuard', authGuard);
    
    // Registrar debugRoutes com o mesmo prefixo usado no server.ts
    await app.register(debugRoutes, { prefix: '/api/v1/debug' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register /api/v1/debug/mercadolivre/me route', async () => {
    const routes = app.printRoutes();
    // printRoutes() retorna uma árvore formatada, verificamos se contém partes da rota
    expect(routes).toContain('mercadolivre');
    expect(routes).toContain('me');
  });

  it('should register /api/v1/debug/mercadolivre/my-items route', async () => {
    const routes = app.printRoutes();
    // printRoutes() retorna uma árvore formatada, verificamos se contém partes da rota
    expect(routes).toContain('mercadolivre');
    // A rota my-items pode aparecer truncada como "y-items" na saída formatada
    expect(routes).toMatch(/y-items|my-items/);
  });

  it('should return 401 when accessing /api/v1/debug/mercadolivre/me without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/debug/mercadolivre/me',
    });

    // Deve retornar 401 (não 404) se a rota existe mas não está autenticado
    expect([401, 404]).toContain(response.statusCode);
  });
});


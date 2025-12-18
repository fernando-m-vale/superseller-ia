/**
 * Request ID Plugin
 * 
 * Adiciona um requestId único a cada requisição e inclui nos logs
 */

import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
  }
}

export const requestIdPlugin: FastifyPluginCallback = (app, _, done) => {
  // Adicionar requestId no início de cada requisição
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.requestId = randomUUID();
    
    // Adicionar requestId ao contexto do logger
    request.log = request.log.child({ requestId: request.requestId });
  });

  // Adicionar requestId aos logs de resposta
  app.addHook('onResponse', async (request, reply) => {
    const { userId, tenantId, requestId } = request;
    
    request.log.info({
      requestId,
      userId,
      tenantId,
      statusCode: reply.statusCode,
      method: request.method,
      url: request.url,
    }, 'Request completed');
  });

  done();
};


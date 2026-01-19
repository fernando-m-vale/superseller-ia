/**
 * Internal Authentication Plugin
 * 
 * Protege endpoints internos com header X-Internal-Key
 * A chave vem do Secrets Manager (env var INTERNAL_JOBS_KEY)
 */

import { FastifyRequest, FastifyReply } from 'fastify';

const INTERNAL_KEY = process.env.INTERNAL_JOBS_KEY || '';

/**
 * Middleware para autenticar requisições internas
 * Verifica header X-Internal-Key
 */
export async function internalAuthGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Se não há chave configurada, rejeitar todas as requisições
  if (!INTERNAL_KEY || INTERNAL_KEY.trim() === '') {
    request.log.warn('INTERNAL_JOBS_KEY não configurada. Rejeitando requisição interna.');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Internal jobs authentication not configured',
    });
  }

  // Buscar header X-Internal-Key
  const providedKey = request.headers['x-internal-key'] || request.headers['X-Internal-Key'];

  if (!providedKey || providedKey !== INTERNAL_KEY) {
    request.log.warn(
      {
        providedKey: providedKey ? '***' : 'missing',
        expectedLength: INTERNAL_KEY.length,
      },
      'Requisição interna rejeitada: chave inválida ou ausente'
    );
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing X-Internal-Key header',
    });
  }

  // Autenticação OK, continuar
  request.log.debug('Requisição interna autenticada com sucesso');
}

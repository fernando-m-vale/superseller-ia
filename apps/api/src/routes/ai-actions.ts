import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createSafeErrorMessage } from '../utils/sanitize-error';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

const AIActionSchema = z.object({
  recommendationId: z.string(),
  action: z.enum(['approve', 'reject', 'execute']),
});

export const aiActionsRoutes: FastifyPluginCallback = (app, _, done) => {
  app.post('/ai/actions', async (req, reply) => {
    const tenantId = (req as RequestWithTenant).tenantId;
    const { requestId, userId } = req;
    
    try {
      const body = AIActionSchema.parse(req.body);
      const { recommendationId, action } = body;
      
      req.log.info({
        requestId,
        userId,
        tenantId,
        recommendationId,
        action,
      }, 'AI action received');
      
      return {
        success: true,
        recommendationId,
        action,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      req.log.error({
        requestId,
        userId,
        tenantId,
        err: error,
      }, 'Error processing AI action');
      
      // Em produção, não retornar detalhes do erro
      const isProduction = process.env.NODE_ENV === 'production';
      const errorMessage = isProduction 
        ? 'Invalid request' 
        : createSafeErrorMessage(error);
      
      reply.code(400).send({
        error: 'Invalid request',
        message: errorMessage,
      });
    }
  });
  
  done();
};

import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';

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
    
    try {
      const body = AIActionSchema.parse(req.body);
      const { recommendationId, action } = body;
      
      app.log.info({
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
      app.log.error({
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Error processing AI action');
      
      reply.code(400).send({
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
  
  done();
};

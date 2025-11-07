import { FastifyPluginCallback, FastifyRequest } from 'fastify';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

export const tenantPlugin: FastifyPluginCallback = (app, _, done) => {
app.addHook('preHandler', async (req) => {
// TODO: extrair tenantId do JWT (Cognito) ou header x-tenant-id em dev
(req as RequestWithTenant).tenantId = (req.headers['x-tenant-id'] as string) || 'demo-tenant';
});
done();
};
import { FastifyPluginCallback } from 'fastify';


export const tenantPlugin: FastifyPluginCallback = (app, _, done) => {
app.addHook('preHandler', async (req) => {
// TODO: extrair tenantId do JWT (Cognito) ou header x-tenant-id em dev
(req as any).tenantId = (req.headers['x-tenant-id'] as string) || 'demo-tenant';
});
done();
};
import { FastifyPluginCallback } from 'fastify';


export const actionsRoutes: FastifyPluginCallback = (app, _, done) => {
app.get('/actions/recommendations', async (req) => {
const tenantId = (req as any).tenantId as string;
// TODO: motor de recomendações — retornar top 10
return { tenantId, items: [] };
});


app.post('/actions/:id/approve', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as any).tenantId as string;
// TODO: mudar status da ação para approved
return { ok: true, id, tenantId };
});


app.post('/actions/:id/apply', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as any).tenantId as string;
// TODO: acionar conector (Shopee/ML) e registrar histórico
return { ok: true, id, tenantId };
});


done();
};
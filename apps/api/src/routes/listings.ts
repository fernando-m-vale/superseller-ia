import { FastifyPluginCallback } from 'fastify';
import { ListingFilterSchema } from '../schemas';


export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
app.get('/listings', { schema: { querystring: ListingFilterSchema } }, async (req) => {
const q = ListingFilterSchema.parse(req.query);
const tenantId = (req as any).tenantId as string;
// TODO: buscar no Postgres por tenantId + filtros q
return { items: [], total: 0, page: q.page, pageSize: q.pageSize, tenantId };
});


app.get('/listings/:id/metrics', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as any).tenantId as string;
// TODO: retornar série temporal do listing
return { listingId: id, tenantId, series: [] };
});


done();
};
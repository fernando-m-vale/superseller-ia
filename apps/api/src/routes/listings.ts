import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { ListingFilterSchema } from '../schemas';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
app.get('/listings', async (req) => {
const q = ListingFilterSchema.parse(req.query);
const tenantId = (req as RequestWithTenant).tenantId;
// TODO: buscar no Postgres por tenantId + filtros q
return { items: [], total: 0, page: q.page, pageSize: q.pageSize, tenantId };
});


app.get('/listings/:id/metrics', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as RequestWithTenant).tenantId;
// TODO: retornar série temporal do listing
return { listingId: id, tenantId, series: [] };
});


done();
};

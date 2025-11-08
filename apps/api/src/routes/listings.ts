import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { ListingFilterSchema } from '../schemas';

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

// Mock data para demonstração
const mockListings = [
  {
    id: '1',
    title: 'iPhone 15 Pro Max 256GB',
    marketplace: 'shopee' as const,
    price: 8999.99,
    stock: 5,
    status: 'active',
    category: 'Eletrônicos'
  },
  {
    id: '2',
    title: 'Notebook Gamer RTX 4060',
    marketplace: 'mercadolivre' as const,
    price: 4599.00,
    stock: 12,
    status: 'active',
    category: 'Informática'
  },
  {
    id: '3',
    title: 'Tênis Nike Air Max',
    marketplace: 'shopee' as const,
    price: 299.90,
    stock: 0,
    status: 'inactive',
    category: 'Calçados'
  },
  {
    id: '4',
    title: 'Smart TV 55" 4K Samsung',
    marketplace: 'mercadolivre' as const,
    price: 2199.99,
    stock: 8,
    status: 'active',
    category: 'Eletrônicos'
  },
  {
    id: '5',
    title: 'Fone Bluetooth JBL',
    marketplace: 'shopee' as const,
    price: 149.99,
    stock: 25,
    status: 'active',
    category: 'Áudio'
  }
];

export const listingsRoutes: FastifyPluginCallback = (app, _, done) => {
app.get('/listings', async (req) => {
const q = ListingFilterSchema.parse(req.query);
const tenantId = (req as RequestWithTenant).tenantId;

// Filtrar dados mockados
let filteredListings = [...mockListings];

// Filtro por texto
if (q.q) {
  const searchTerm = q.q.toLowerCase();
  filteredListings = filteredListings.filter(listing =>
    listing.title.toLowerCase().includes(searchTerm) ||
    listing.category.toLowerCase().includes(searchTerm)
  );
}

// Filtro por marketplace
if (q.marketplace) {
  filteredListings = filteredListings.filter(listing =>
    listing.marketplace === q.marketplace
  );
}

// Paginação
const total = filteredListings.length;
const startIndex = (q.page - 1) * q.pageSize;
const endIndex = startIndex + q.pageSize;
const paginatedItems = filteredListings.slice(startIndex, endIndex);

return {
  items: paginatedItems,
  total,
  page: q.page,
  pageSize: q.pageSize,
  tenantId
};
});


app.get('/listings/:id/metrics', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as RequestWithTenant).tenantId;
// TODO: retornar série temporal do listing
return { listingId: id, tenantId, series: [] };
});


done();
};

import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { healthScore } from '@superseller/core';
import { RecommendationFilterSchema } from '../schemas';
import { randomUUID } from 'crypto';

type ListingDailyMetric = any;

interface RequestWithTenant extends FastifyRequest {
  tenantId: string;
}

type Marketplace = 'shopee' | 'mercadolivre';
type ActionType = 'increase_ad_spend' | 'optimize_photos' | 'improve_title' | 'adjust_price' | 'restock';
type ImpactLevel = 'high' | 'medium' | 'low';

interface MockListing {
  id: string;
  title: string;
  marketplace: Marketplace;
  price: number;
  stock: number;
  metrics: ListingDailyMetric[];
}

interface ActionRecommendation {
  id: string;
  listingId: string;
  listingTitle: string;
  marketplace: Marketplace;
  action: ActionType;
  reason: string;
  impact: ImpactLevel;
  effort: ImpactLevel;
  healthScore: number;
  estimatedImpact: string;
  createdAt: string;
}

function generateMockListings(): MockListing[] {
  const today = new Date();
  const generateMetrics = (baseImpressions: number, baseVisits: number, baseOrders: number, baseRevenue: number): ListingDailyMetric[] => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      const variance = 0.8 + Math.random() * 0.4;
      return {
        date: date.toISOString().split('T')[0],
        impressions: Math.floor(baseImpressions * variance),
        visits: Math.floor(baseVisits * variance),
        orders: Math.floor(baseOrders * variance),
        revenue: baseRevenue * variance
      };
    });
  };

  return [
    {
      id: '1',
      title: 'iPhone 15 Pro Max 256GB',
      marketplace: 'shopee',
      price: 8999.99,
      stock: 5,
      metrics: generateMetrics(5000, 80, 2, 17999.98)
    },
    {
      id: '2',
      title: 'Notebook Gamer RTX 4060',
      marketplace: 'mercadolivre',
      price: 4599.00,
      stock: 12,
      metrics: generateMetrics(3000, 120, 8, 36792.00)
    },
    {
      id: '3',
      title: 'Tênis Nike Air Max',
      marketplace: 'shopee',
      price: 299.90,
      stock: 0,
      metrics: generateMetrics(2000, 30, 0, 0)
    },
    {
      id: '4',
      title: 'Smart TV 55" 4K Samsung',
      marketplace: 'mercadolivre',
      price: 2199.99,
      stock: 8,
      metrics: generateMetrics(4000, 200, 12, 26399.88)
    },
    {
      id: '5',
      title: 'Fone Bluetooth JBL',
      marketplace: 'shopee',
      price: 149.99,
      stock: 25,
      metrics: generateMetrics(8000, 400, 30, 4499.70)
    },
    {
      id: '6',
      title: 'Cadeira Gamer RGB',
      marketplace: 'mercadolivre',
      price: 899.90,
      stock: 3,
      metrics: generateMetrics(1500, 20, 1, 899.90)
    },
    {
      id: '7',
      title: 'Mouse Logitech MX Master 3',
      marketplace: 'shopee',
      price: 549.90,
      stock: 15,
      metrics: generateMetrics(3500, 180, 15, 8248.50)
    },
    {
      id: '8',
      title: 'Teclado Mecânico Keychron',
      marketplace: 'mercadolivre',
      price: 799.00,
      stock: 20,
      metrics: generateMetrics(2500, 100, 8, 6392.00)
    },
    {
      id: '9',
      title: 'Monitor LG 27" 4K',
      marketplace: 'shopee',
      price: 1899.99,
      stock: 6,
      metrics: generateMetrics(2000, 80, 4, 7599.96)
    },
    {
      id: '10',
      title: 'Webcam Logitech C920',
      marketplace: 'mercadolivre',
      price: 449.90,
      stock: 10,
      metrics: generateMetrics(4500, 90, 3, 1349.70)
    },
    {
      id: '11',
      title: 'SSD NVMe 1TB Samsung',
      marketplace: 'shopee',
      price: 599.90,
      stock: 30,
      metrics: generateMetrics(6000, 300, 25, 14997.50)
    },
    {
      id: '12',
      title: 'Placa de Vídeo RTX 4070',
      marketplace: 'mercadolivre',
      price: 3999.00,
      stock: 2,
      metrics: generateMetrics(1000, 40, 2, 7998.00)
    }
  ];
}

function calculateCTR(metrics: ListingDailyMetric[]): number {
  const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
  const totalVisits = metrics.reduce((sum, m) => sum + m.visits, 0);
  return totalImpressions > 0 ? (totalVisits / totalImpressions) * 100 : 0;
}

function calculateCVR(metrics: ListingDailyMetric[]): number {
  const totalVisits = metrics.reduce((sum, m) => sum + m.visits, 0);
  const totalOrders = metrics.reduce((sum, m) => sum + m.orders, 0);
  return totalVisits > 0 ? (totalOrders / totalVisits) * 100 : 0;
}

function generateRecommendations(listings: MockListing[]): ActionRecommendation[] {
  const recommendations: ActionRecommendation[] = [];
  const now = new Date().toISOString();

  for (const listing of listings) {
    const score = healthScore(listing.metrics) || 0;
    const ctr = calculateCTR(listing.metrics);
    const cvr = calculateCVR(listing.metrics);
    const hasStock = listing.stock > 0;

    if (!hasStock) {
      recommendations.push({
        id: randomUUID(),
        listingId: listing.id,
        listingTitle: listing.title,
        marketplace: listing.marketplace,
        action: 'restock',
        reason: 'Product unavailable, losing potential sales',
        impact: 'high',
        effort: 'medium',
        healthScore: score,
        estimatedImpact: 'Prevent R$1000/week loss',
        createdAt: now
      });
    } else if (ctr < 2) {
      recommendations.push({
        id: randomUUID(),
        listingId: listing.id,
        listingTitle: listing.title,
        marketplace: listing.marketplace,
        action: ctr < 1 ? 'improve_title' : 'optimize_photos',
        reason: 'Low click-through rate indicates poor listing visibility',
        impact: 'high',
        effort: 'medium',
        healthScore: score,
        estimatedImpact: '+15% CTR',
        createdAt: now
      });
    } else if (cvr < 1) {
      recommendations.push({
        id: randomUUID(),
        listingId: listing.id,
        listingTitle: listing.title,
        marketplace: listing.marketplace,
        action: 'adjust_price',
        reason: 'Low conversion rate suggests pricing or presentation issues',
        impact: 'high',
        effort: 'low',
        healthScore: score,
        estimatedImpact: '+10% conversion',
        createdAt: now
      });
    } else if (score < 50) {
      recommendations.push({
        id: randomUUID(),
        listingId: listing.id,
        listingTitle: listing.title,
        marketplace: listing.marketplace,
        action: 'increase_ad_spend',
        reason: 'Overall listing health is poor, needs visibility boost',
        impact: 'medium',
        effort: 'high',
        healthScore: score,
        estimatedImpact: '+R$500/month',
        createdAt: now
      });
    } else if (score > 70) {
      recommendations.push({
        id: randomUUID(),
        listingId: listing.id,
        listingTitle: listing.title,
        marketplace: listing.marketplace,
        action: 'increase_ad_spend',
        reason: 'High-performing listing, scale up investment',
        impact: 'high',
        effort: 'low',
        healthScore: score,
        estimatedImpact: '+R$2000/month',
        createdAt: now
      });
    }
  }

  return recommendations;
}

function sortRecommendations(recommendations: ActionRecommendation[]): ActionRecommendation[] {
  const impactOrder = { high: 3, medium: 2, low: 1 };
  const effortOrder = { low: 3, medium: 2, high: 1 };

  return recommendations.sort((a, b) => {
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[b.impact] - impactOrder[a.impact];
    }
    if (effortOrder[a.effort] !== effortOrder[b.effort]) {
      return effortOrder[b.effort] - effortOrder[a.effort];
    }
    return a.healthScore - b.healthScore;
  });
}

export const actionsRoutes: FastifyPluginCallback = (app, _, done) => {
app.get('/actions/recommendations', async (req) => {
const tenantId = (req as RequestWithTenant).tenantId;
const filters = RecommendationFilterSchema.parse(req.query);

const mockListings = generateMockListings();
let allRecommendations = generateRecommendations(mockListings);

if (filters.marketplace) {
  allRecommendations = allRecommendations.filter(r => r.marketplace === filters.marketplace);
}

if (filters.q) {
  const searchTerm = filters.q.toLowerCase();
  allRecommendations = allRecommendations.filter(r =>
    r.listingTitle.toLowerCase().includes(searchTerm)
  );
}

const sortedRecommendations = sortRecommendations(allRecommendations);

const total = sortedRecommendations.length;
const startIndex = (filters.page - 1) * filters.pageSize;
const endIndex = startIndex + filters.pageSize;
const paginatedItems = sortedRecommendations.slice(startIndex, endIndex);

return {
  items: paginatedItems,
  total,
  page: filters.page,
  pageSize: filters.pageSize,
  tenantId
};
});


app.post('/actions/:id/approve', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as RequestWithTenant).tenantId;
// TODO: mudar status da ação para approved
return { ok: true, id, tenantId };
});


app.post('/actions/:id/apply', async (req) => {
const { id } = req.params as { id: string };
const tenantId = (req as RequestWithTenant).tenantId;
// TODO: acionar conector (Shopee/ML) e registrar histórico
return { ok: true, id, tenantId };
});


done();
};

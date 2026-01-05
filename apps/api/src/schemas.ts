import { z } from 'zod';


export const ListingFilterSchema = z.object({
marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
scoreMin: z.coerce.number().min(0).max(100).optional(),
scoreMax: z.coerce.number().min(0).max(100).optional(),
q: z.string().optional(),
page: z.coerce.number().min(1).default(1),
pageSize: z.coerce.number().min(1).max(200).default(20)
});


export const RecommendationFilterSchema = z.object({
marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
q: z.string().optional(),
page: z.coerce.number().min(1).default(1),
pageSize: z.coerce.number().min(1).max(200).default(20)
});

export const ActionApproveSchema = z.object({ id: z.string().uuid() });
export const DateRangeSchema = z.object({ from: z.string().optional(), to: z.string().optional() });

export const MetricsSummaryQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(7),
  marketplace: z.enum(['shopee', 'mercadolivre']).optional(),
});

export const MetricsSummaryResponseSchema = z.object({
  tenantId: z.string(),
  periodDays: z.number(),
  totalImpressions: z.number(),
  totalVisits: z.number(),
  totalOrders: z.number(),
  totalRevenue: z.number(),
  avgCTR: z.number().nullable(), // Null quando impressions/clicks não disponíveis
  avgCVR: z.number(),
  bestListing: z.object({
    id: z.string(),
    title: z.string(),
    healthScore: z.number(),
  }).nullable(),
  updatedAt: z.string(),
});

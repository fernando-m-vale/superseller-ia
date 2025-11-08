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

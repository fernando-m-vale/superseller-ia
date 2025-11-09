export type Marketplace = 'shopee' | 'mercadolivre'

export type ActionType = 
  | 'increase_ad_spend'
  | 'optimize_photos'
  | 'improve_title'
  | 'adjust_price'
  | 'restock'

export type Impact = 'high' | 'medium' | 'low'
export type Effort = 'high' | 'medium' | 'low'

export interface ActionRecommendation {
  id: string
  listingId: string
  listingTitle: string
  marketplace: Marketplace
  action: ActionType
  reason: string
  impact: Impact
  effort: Effort
  healthScore: number
  estimatedImpact: string
  createdAt: string
}

export interface RecommendationsResponse {
  items: ActionRecommendation[]
  total: number
  page: number
  pageSize: number
  tenantId: string
}

export interface RecommendationsFilters {
  marketplace?: Marketplace
  q?: string
  page?: number
  pageSize?: number
}

export interface ListingDailyMetric {
  listingId: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  visits: number;
  conversion: number;
  orders: number;
  gmv: number;
}

export type ActionType = 'title' | 'price' | 'stock' | 'attributes' | 'image';

export interface RecommendedAction {
  listingId: string;
  type: ActionType;
  priority: number;
  score: number;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  rationale: string;
  payload: Record<string, unknown>;
}

export interface RecommendationScore {
  listingId: string;
  overallScore: number;
  ctrScore: number;
  conversionScore: number;
  revenueScore: number;
  ordersScore: number;
}

export interface RecommendationInput {
  metrics: ListingDailyMetric[];
  windowDays?: number;
  minDays?: number;
}

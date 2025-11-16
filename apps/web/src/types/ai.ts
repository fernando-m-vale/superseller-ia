export type ActionType = 'title' | 'price' | 'stock' | 'attributes' | 'image';

export type ActionImpact = 'high' | 'medium' | 'low';
export type ActionEffort = 'high' | 'medium' | 'low';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export interface RecommendedAction {
  listingId: string;
  type: ActionType;
  priority: number;
  score: number;
  impact: ActionImpact;
  effort: ActionEffort;
  rationale: string;
  payload: Record<string, unknown>;
}

export interface AIRecommendation extends RecommendedAction {
  id: string;
  status: ActionStatus;
  createdAt: string;
}

export interface AIRecommendationsResponse {
  tenantId: string;
  generatedAt: string;
  items: RecommendedAction[];
  modelVersion: string;
  inferenceTime: number;
}

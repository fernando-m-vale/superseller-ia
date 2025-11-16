export type ChecklistState = {
  version: 1;
  completed: {
    connectMarketplace: boolean;
    createFirstListing: boolean;
    validateInitialMetrics: boolean;
    enableAutoRecommendations: boolean;
  };
  updatedAt: string;
}

export const INITIAL_CHECKLIST_STATE: ChecklistState = {
  version: 1,
  completed: {
    connectMarketplace: false,
    createFirstListing: false,
    validateInitialMetrics: false,
    enableAutoRecommendations: false,
  },
  updatedAt: new Date().toISOString(),
}

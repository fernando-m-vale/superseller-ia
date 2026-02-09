// Declarações mínimas para os pacotes internos do monorepo
// Só para o TypeScript parar de reclamar no build da API.

declare module '@superseller/core' {
  export function healthScore(...args: any[]): any;
  export function sanitizeMlText(text: string): string;
  export function buildPromotionPlacementSuggestions(pricing: any): any[];
  export interface PromotionPlacementSuggestion {
    id: string;
    title: string;
    where: string;
    how: string;
    constraints: string[];
    exampleText: string;
  }
  export interface PricingInput {
    hasPromotion: boolean;
    originalPrice: number;
    finalPrice: number;
    discountPercent: number | null;
  }
}

declare module '@superseller/ai' {
  // Mesma ideia aqui: só precisamos chamar recommendActions.
  export function recommendActions(...args: any[]): any;
}

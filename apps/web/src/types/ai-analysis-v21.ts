/**
 * AI Analysis Result V2.1
 * 
 * Estrutura JSON estruturada retornada pela IA V2.1.
 * Compatível com o tipo do backend.
 */

export interface AIAnalysisResultV21 {
  verdict: {
    headline: string;
    summary?: string;
  };
  actions: Array<{
    priority: number; // 1 = mais importante, 2 = médio, 3 = menos importante
    instruction: string;
    before?: string;
    after?: string;
    expectedImpact?: string;
  }>;
  title: {
    suggested: string;
    keywords?: string[];
    rationale?: string;
  };
  description: {
    bullets: string[];
    fullText?: string;
  };
  images: {
    plan: Array<{
      slot: number;
      description: string;
      purpose?: string;
      goal?: string;
      whatToShow?: string;
    }>;
  };
  promo?: {
    priceBase?: number;
    priceFinal?: number;
    discount?: number;
    recommendation?: string;
  };
}

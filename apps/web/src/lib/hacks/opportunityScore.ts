/**
 * Opportunity Score Helper - HOTFIX 09.6
 * 
 * Calcula Opportunity Score (0-100) determinístico para ordenar e priorizar hacks.
 * Fórmula: 0.45 * ImpactScore + 0.35 * Confidence + 0.20 * GapScore
 */

export interface GapScoreInput {
  visits?: number | null;
  orders?: number | null;
  conversionRate?: number | null;
}

export interface OpportunityScoreInput {
  impact: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  visits?: number | null;
  orders?: number | null;
  conversionRate?: number | null;
}

/**
 * Calcula score de impacto (0-100)
 */
export function computeImpactScore(impact: 'low' | 'medium' | 'high'): number {
  switch (impact) {
    case 'high':
      return 90;
    case 'medium':
      return 65;
    case 'low':
      return 35;
  }
}

/**
 * Calcula Gap Score baseado em métricas de performance
 * Indica o "gap" entre performance atual e potencial
 */
export function computeGapScore(input: GapScoreInput): number {
  const visits = input.visits ?? 0;
  const orders = input.orders ?? 0;
  const conversionRate = input.conversionRate ?? null;

  // Visits Score: mais visitas = mais oportunidade
  let visitsScore = 5; // default baixo
  if (visits >= 300) {
    visitsScore = 40;
  } else if (visits >= 200) {
    visitsScore = 30;
  } else if (visits >= 100) {
    visitsScore = 15;
  }

  // CR Penalty Score: conversão baixa = mais oportunidade de melhoria
  let crPenaltyScore = 5; // default baixo
  if (conversionRate !== null && conversionRate !== undefined) {
    if (conversionRate < 0.01) {
      // < 1% = muito ruim
      crPenaltyScore = 40;
    } else if (conversionRate < 0.02) {
      // < 2% = ruim
      crPenaltyScore = 25;
    } else if (conversionRate < 0.03) {
      // < 3% = abaixo do ideal
      crPenaltyScore = 10;
    }
  }

  // Orders Score: poucos pedidos = mais oportunidade
  let ordersScore = 2; // default baixo (já tem pedidos)
  if (orders === 0) {
    ordersScore = 20; // nenhum pedido = alta oportunidade
  } else if (orders <= 2) {
    ordersScore = 12; // muito poucos pedidos
  } else if (orders <= 10) {
    ordersScore = 6; // poucos pedidos
  }

  // Soma e clamp
  const gapScore = visitsScore + crPenaltyScore + ordersScore;
  return Math.max(0, Math.min(100, gapScore));
}

/**
 * Calcula Opportunity Score final (0-100)
 * 
 * Fórmula: 0.45 * ImpactScore + 0.35 * Confidence + 0.20 * GapScore
 */
export function computeOpportunityScore(input: OpportunityScoreInput): number {
  const { impact, confidence, visits, orders, conversionRate } = input;

  const impactScore = computeImpactScore(impact);
  const gapScore = computeGapScore({ visits, orders, conversionRate });

  // Fórmula ponderada
  const opportunityScore = 0.45 * impactScore + 0.35 * confidence + 0.20 * gapScore;

  // Arredondar e clamp
  return Math.max(0, Math.min(100, Math.round(opportunityScore)));
}

/**
 * Retorna label de oportunidade baseado no score
 */
export function getOpportunityLabel(score: number): string {
  if (score >= 75) {
    return '🔥 Alta oportunidade';
  } else if (score >= 50) {
    return 'Boa oportunidade';
  } else {
    return 'Oportunidade baixa (revisar contexto)';
  }
}

/**
 * Retorna cor/variante do badge baseado no score
 */
export function getOpportunityBadgeVariant(score: number): 'default' | 'secondary' | 'outline' {
  if (score >= 75) {
    return 'default'; // Destaque forte
  } else if (score >= 50) {
    return 'secondary'; // Destaque médio
  } else {
    return 'outline'; // Discreto
  }
}

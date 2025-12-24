/**
 * IA Score Service
 * 
 * Calcula o IA Score Model V1 baseado em dados reais do listing.
 * Score explicável, determinístico, sem alucinação.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Breakdown do score por dimensão
 */
export interface IAScoreBreakdown {
  cadastro: number;        // 0-20
  midia: number;          // 0-20
  performance: number;     // 0-30
  seo: number;            // 0-20
  competitividade: number; // 0-10
}

/**
 * Potencial de ganho por dimensão
 */
export interface IAScorePotentialGain {
  cadastro?: string;
  midia?: string;
  performance?: string;
  seo?: string;
  competitividade?: string;
}

/**
 * Resultado completo do score
 */
export interface IAScoreResult {
  score: {
    final: number;
    breakdown: IAScoreBreakdown;
    potential_gain: IAScorePotentialGain;
  };
  metrics_30d: {
    visits: number;
    orders: number;
    revenue: number | null;
    conversionRate: number | null;
    ctr: number | null;
  };
  dataQuality: {
    completenessScore: number;
    sources: {
      performance: 'listing_metrics_daily' | 'listing_aggregates';
    };
  };
}

export class IAScoreService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Calcula o IA Score completo para um listing
   * 
   * @param listingId ID do listing
   * @param periodDays Período em dias para agregar métricas (padrão: 30)
   * @returns Resultado completo do score
   */
  async calculateScore(
    listingId: string,
    periodDays: number = 30
  ): Promise<IAScoreResult> {
    // Buscar listing
    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        tenant_id: this.tenantId,
      },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found for tenant ${this.tenantId}`);
    }

    // Calcular data range para métricas
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    // Buscar métricas diárias
    const dailyMetrics = await prisma.listingMetricsDaily.findMany({
      where: {
        tenant_id: this.tenantId,
        listing_id: listingId,
        date: {
          gte: since,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Agregar métricas
    let visits = 0;
    let orders = 0;
    let revenue: number | null = null;
    let impressions = 0;
    let clicks = 0;
    let totalCtr = 0;
    const hasDailyMetrics = dailyMetrics.length > 0;

    if (hasDailyMetrics) {
      for (const metric of dailyMetrics) {
        visits += metric.visits;
        orders += metric.orders;
        impressions += metric.impressions;
        clicks += metric.clicks;
        const gmv = Number(metric.gmv);
        if (revenue === null) {
          revenue = gmv;
        } else {
          revenue += gmv;
        }
        const ctr = Number(metric.ctr);
        totalCtr += ctr;
      }
    } else {
      // Fallback para agregados do listing
      visits = listing.visits_last_7d ?? 0;
      orders = listing.sales_last_7d ?? 0;
      revenue = null;
    }

    const conversionRate = visits > 0 ? orders / visits : null;
    const avgCtr = dailyMetrics.length > 0 && totalCtr > 0 ? totalCtr / dailyMetrics.length : null;

    // Calcular dimensões
    const breakdown: IAScoreBreakdown = {
      cadastro: this.calculateCadastroScore(listing),
      midia: this.calculateMidiaScore(listing),
      performance: this.calculatePerformanceScore(visits, orders, conversionRate),
      seo: this.calculateSEOScore(avgCtr),
      competitividade: 50, // Placeholder V1 (fixo)
    };

    // Calcular score final (soma ponderada)
    const final = 
      breakdown.cadastro +
      breakdown.midia +
      breakdown.performance +
      breakdown.seo +
      breakdown.competitividade;

    // Calcular potencial de ganho
    const potentialGain = this.calculatePotentialGain(breakdown, listing);

    // Calcular qualidade dos dados
    const completenessScore = this.calculateCompletenessScore(
      listing,
      hasDailyMetrics,
      visits,
      orders
    );

    return {
      score: {
        final: Math.round(final),
        breakdown,
        potential_gain: potentialGain,
      },
      metrics_30d: {
        visits,
        orders,
        revenue,
        conversionRate,
        ctr: avgCtr,
      },
      dataQuality: {
        completenessScore,
        sources: {
          performance: hasDailyMetrics ? 'listing_metrics_daily' : 'listing_aggregates',
        },
      },
    };
  }

  /**
   * Calcula score de Cadastro (0-20)
   * 
   * Regras:
   * - title length > 10: 5 pontos
   * - description length > 200: 5 pontos
   * - category preenchida: 5 pontos
   * - status = active: 5 pontos
   */
  private calculateCadastroScore(listing: {
    title: string;
    description: string | null;
    category: string | null;
    status: string;
  }): number {
    let score = 0;

    // Título
    if (listing.title && listing.title.trim().length > 10) {
      score += 5;
    }

    // Descrição
    if (listing.description && listing.description.trim().length > 200) {
      score += 5;
    }

    // Categoria
    if (listing.category && listing.category.trim().length > 0) {
      score += 5;
    }

    // Status ativo
    if (listing.status === 'active') {
      score += 5;
    }

    return score;
  }

  /**
   * Calcula score de Mídia (0-20)
   * 
   * Regras:
   * - pictures_count >= 3: 10 pontos (parcial)
   * - pictures_count >= 6: 10 pontos (ideal)
   * - has_video = true: 10 pontos
   */
  private calculateMidiaScore(listing: {
    pictures_count: number | null;
    has_video: boolean | null;
  }): number {
    let score = 0;

    const picturesCount = listing.pictures_count ?? 0;

    // Fotos
    if (picturesCount >= 6) {
      score += 10; // Ideal
    } else if (picturesCount >= 3) {
      score += 5; // Parcial
    }

    // Vídeo
    if (listing.has_video === true) {
      score += 10;
    }

    return score;
  }

  /**
   * Calcula score de Performance (0-30)
   * 
   * Regras:
   * - visits > 0: 10 pontos
   * - orders > 0: 10 pontos
   * - conversion_rate vs baseline: 10 pontos
   *   - baseline fixo: 2% (0.02)
   *   - Se conversionRate >= 0.02: 10 pontos
   *   - Se conversionRate >= 0.01: 5 pontos
   *   - Se conversionRate > 0: 2 pontos
   */
  private calculatePerformanceScore(
    visits: number,
    orders: number,
    conversionRate: number | null
  ): number {
    let score = 0;

    // Visitas
    if (visits > 0) {
      score += 10;
    }

    // Pedidos
    if (orders > 0) {
      score += 10;
    }

    // Taxa de conversão
    if (conversionRate !== null && conversionRate > 0) {
      const baseline = 0.02; // 2%
      if (conversionRate >= baseline) {
        score += 10;
      } else if (conversionRate >= baseline / 2) {
        score += 5;
      } else {
        score += 2;
      }
    }

    return score;
  }

  /**
   * Calcula score de SEO (0-20)
   * 
   * Regras:
   * - CTR relativo: 10 pontos (se existir)
   *   - CTR >= 2%: 10 pontos
   *   - CTR >= 1%: 5 pontos
   *   - CTR > 0: 2 pontos
   * - semantic_score (input da IA, default 50 se ausente): 10 pontos
   *   - Por enquanto, usar 50 fixo (placeholder)
   */
  private calculateSEOScore(ctr: number | null): number {
    let score = 0;

    // CTR
    if (ctr !== null && ctr > 0) {
      const ctrPercent = ctr * 100;
      if (ctrPercent >= 2) {
        score += 10;
      } else if (ctrPercent >= 1) {
        score += 5;
      } else {
        score += 2;
      }
    }

    // Semantic score (placeholder V1: 50% = 10 pontos)
    score += 10;

    return score;
  }

  /**
   * Calcula potencial de ganho por dimensão
   */
  private calculatePotentialGain(
    breakdown: IAScoreBreakdown,
    listing: {
      pictures_count: number | null;
      has_video: boolean | null;
    }
  ): IAScorePotentialGain {
    const gain: IAScorePotentialGain = {};

    // Mídia
    const picturesCount = listing.pictures_count ?? 0;
    if (picturesCount < 6) {
      const missing = 6 - picturesCount;
      if (missing >= 3) {
        gain.midia = '+20';
      } else {
        gain.midia = '+10';
      }
    }
    if (listing.has_video !== true) {
      gain.midia = gain.midia ? `${gain.midia} (+10 vídeo)` : '+10';
    }

    // Performance
    if (breakdown.performance < 20) {
      const missing = 20 - breakdown.performance;
      if (missing >= 15) {
        gain.performance = '+15';
      } else if (missing >= 10) {
        gain.performance = '+10';
      } else {
        gain.performance = '+5';
      }
    }

    // Cadastro
    if (breakdown.cadastro < 20) {
      const missing = 20 - breakdown.cadastro;
      if (missing >= 10) {
        gain.cadastro = '+10';
      } else {
        gain.cadastro = '+5';
      }
    }

    // SEO
    if (breakdown.seo < 20) {
      const missing = 20 - breakdown.seo;
      if (missing >= 10) {
        gain.seo = '+10';
      } else {
        gain.seo = '+5';
      }
    }

    return gain;
  }

  /**
   * Calcula score de completude dos dados (0-100)
   */
  private calculateCompletenessScore(
    listing: {
      description: string | null;
      pictures_count: number | null;
    },
    hasDailyMetrics: boolean,
    visits: number,
    orders: number
  ): number {
    let score = 0;

    // Descrição
    if (listing.description && listing.description.trim().length > 0) {
      score += 30;
    }

    // Fotos
    const picturesCount = listing.pictures_count ?? 0;
    if (picturesCount > 0) {
      score += 30;
    }

    // Métricas
    if (hasDailyMetrics) {
      score += 40;
    } else if (visits > 0 || orders > 0) {
      score += 20; // Crédito parcial para agregados
    }

    return score;
  }
}


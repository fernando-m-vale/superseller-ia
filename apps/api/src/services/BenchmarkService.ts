/**
 * Benchmark Service
 * 
 * Calcula benchmark mínimo viável por categoria comparando listing atual com concorrentes.
 * Sem inventar números; se não houver dado, declara como "indisponível".
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const ML_API_BASE = 'https://api.mercadolibre.com';

// Constantes de confiança mínima
const MIN_VISITS_FOR_CR_CONFIDENCE = 150; // Reutilizar padrão do Dia 03
const MIN_BASELINE_SAMPLE_SIZE = 30; // Mínimo de listings para baseline confiável
const MIN_BASELINE_VISITS = 1000; // Mínimo de visitas agregadas para baseline confiável
const COMPETITORS_SAMPLE_SIZE = 20; // Número de concorrentes para buscar

export interface CompetitorItem {
  id: string;
  title: string;
  price: number;
  pictures_count: number;
  has_video: boolean | null; // null = não detectável
  category_id: string;
  listing_type_id?: string;
}

export interface BenchmarkStats {
  medianPicturesCount: number;
  percentageWithVideo: number; // % com vídeo detectável (exclui null)
  medianPrice: number;
  medianTitleLength: number;
  sampleSize: number;
}

export interface BaselineConversion {
  conversionRate: number | null; // null se não houver dados suficientes
  sampleSize: number; // Número de listings usados
  totalVisits: number; // Total de visitas agregadas
  confidence: 'high' | 'medium' | 'low' | 'unavailable';
}

export interface BenchmarkSummary {
  categoryId: string;
  sampleSize: number;
  computedAt: string;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  stats: BenchmarkStats;
  baselineConversion: BaselineConversion;
}

export interface BenchmarkResult {
  benchmarkSummary: BenchmarkSummary;
  youWinHere: string[];
  youLoseHere: string[];
  tradeoffs: string;
  recommendations: string[];
  _debug?: {
    stage: string;
    error: string;
  };
}

export class BenchmarkService {
  private tenantId: string;
  private prismaInstance: PrismaClient;

  constructor(tenantId: string, prismaInstance?: PrismaClient) {
    this.tenantId = tenantId;
    this.prismaInstance = prismaInstance || prisma;
  }

  /**
   * Busca concorrentes na mesma categoria via ML Search API
   */
  private async fetchCompetitors(categoryId: string, excludeItemId?: string): Promise<CompetitorItem[]> {
    try {
      // Buscar via /sites/MLB/search com category_id
      const url = `${ML_API_BASE}/sites/MLB/search`;
      const response = await axios.get(url, {
        params: {
          category: categoryId,
          limit: COMPETITORS_SAMPLE_SIZE,
          sort: 'relevance', // Ordenar por relevância
        },
      });

      const { results } = response.data;
      
      // Filtrar item atual se fornecido
      const competitors = results
        .filter((item: any) => !excludeItemId || item.id !== excludeItemId)
        .slice(0, COMPETITORS_SAMPLE_SIZE)
        .map((item: any): CompetitorItem => ({
          id: item.id,
          title: item.title || '',
          price: item.price || 0,
          pictures_count: item.pictures?.length || 0,
          has_video: item.video_id ? true : (item.videos && item.videos.length > 0 ? true : null),
          category_id: item.category_id || categoryId,
          listing_type_id: item.listing_type_id,
        }));

      return competitors;
    } catch (error) {
      console.warn(`[BENCHMARK] Erro ao buscar concorrentes para categoryId=${categoryId}:`, error instanceof Error ? error.message : 'Erro desconhecido');
      return []; // Retornar array vazio em caso de erro
    }
  }

  /**
   * Calcula estatísticas agregadas dos concorrentes
   */
  private calculateBenchmarkStats(competitors: CompetitorItem[]): BenchmarkStats {
    if (competitors.length === 0) {
      return {
        medianPicturesCount: 0,
        percentageWithVideo: 0,
        medianPrice: 0,
        medianTitleLength: 0,
        sampleSize: 0,
      };
    }

    // Mediana de pictures_count
    const picturesCounts = competitors.map(c => c.pictures_count).sort((a, b) => a - b);
    const medianPicturesCount = this.median(picturesCounts);

    // % com vídeo (exclui null)
    const withVideo = competitors.filter(c => c.has_video === true).length;
    const detectable = competitors.filter(c => c.has_video !== null).length;
    const percentageWithVideo = detectable > 0 ? (withVideo / detectable) * 100 : 0;

    // Mediana de preço
    const prices = competitors.map(c => c.price).filter(p => p > 0).sort((a, b) => a - b);
    const medianPrice = prices.length > 0 ? this.median(prices) : 0;

    // Mediana de tamanho do título
    const titleLengths = competitors.map(c => c.title.length).sort((a, b) => a - b);
    const medianTitleLength = this.median(titleLengths);

    return {
      medianPicturesCount,
      percentageWithVideo,
      medianPrice,
      medianTitleLength,
      sampleSize: competitors.length,
    };
  }

  /**
   * Calcula baseline de conversão interna por categoria
   */
  private async calculateBaselineConversion(categoryId: string): Promise<BaselineConversion> {
    try {
      // Buscar todos os listings da mesma categoria do tenant (últimos 30 dias)
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const listings = await this.prismaInstance.listing.findMany({
        where: {
          tenant_id: this.tenantId,
          category: categoryId,
          status: 'active',
        },
        select: {
          id: true,
        },
      });

      if (listings.length < MIN_BASELINE_SAMPLE_SIZE) {
        return {
          conversionRate: null,
          sampleSize: listings.length,
          totalVisits: 0,
          confidence: 'unavailable',
        };
      }

      const listingIds = listings.map(l => l.id);

      // Agregar métricas dos últimos 30 dias
      const metrics = await this.prismaInstance.listingMetricsDaily.findMany({
        where: {
          tenant_id: this.tenantId,
          listing_id: { in: listingIds },
          date: { gte: since },
        },
        select: {
          visits: true,
          orders: true,
        },
      });

      const totalVisits = metrics.reduce((sum, m) => sum + (m.visits ?? 0), 0);
      const totalOrders = metrics.reduce((sum, m) => sum + m.orders, 0);

      if (totalVisits < MIN_BASELINE_VISITS) {
        return {
          conversionRate: null,
          sampleSize: listings.length,
          totalVisits,
          confidence: 'unavailable',
        };
      }

      const conversionRate = totalVisits > 0 ? totalOrders / totalVisits : 0;

      // Determinar confiança
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (listings.length >= 50 && totalVisits >= 5000) {
        confidence = 'high';
      } else if (listings.length >= MIN_BASELINE_SAMPLE_SIZE && totalVisits >= MIN_BASELINE_VISITS) {
        confidence = 'medium';
      }

      return {
        conversionRate,
        sampleSize: listings.length,
        totalVisits,
        confidence,
      };
    } catch (error) {
      console.warn(`[BENCHMARK] Erro ao calcular baseline de conversão para categoryId=${categoryId}:`, error instanceof Error ? error.message : 'Erro desconhecido');
      return {
        conversionRate: null,
        sampleSize: 0,
        totalVisits: 0,
        confidence: 'unavailable',
      };
    }
  }

  /**
   * Gera "youWinHere" e "youLoseHere" baseado em gaps reais
   */
  private generateWinLose(
    listing: {
      picturesCount: number;
      hasClips: boolean | null;
      titleLength: number;
      price: number;
      hasPromotion: boolean;
      discountPercent: number | null;
    },
    stats: BenchmarkStats,
    baselineConversion: BaselineConversion,
    metrics30d: {
      visits: number;
      orders: number;
      conversionRate: number | null;
    }
  ): { youWinHere: string[]; youLoseHere: string[]; tradeoffs: string; recommendations: string[] } {
    const youWinHere: string[] = [];
    const youLoseHere: string[] = [];
    const recommendations: string[] = [];

    // 1. Riqueza visual (pictures)
    if (listing.picturesCount >= stats.medianPicturesCount) {
      youWinHere.push(`Você tem ${listing.picturesCount} imagens, acima da média de ${stats.medianPicturesCount} da categoria`);
    } else if (listing.picturesCount < stats.medianPicturesCount) {
      const gap = stats.medianPicturesCount - listing.picturesCount;
      youLoseHere.push(`Você tem ${listing.picturesCount} imagens, ${gap} abaixo da média de ${stats.medianPicturesCount} da categoria`);
      recommendations.push(`Adicionar ${gap} imagens para alcançar a média da categoria`);
    }

    // 2. Vídeo/Clips
    if (stats.percentageWithVideo > 50) {
      // Maioria dos concorrentes tem vídeo
      if (listing.hasClips === true) {
        youWinHere.push(`Você tem vídeo, como ${Math.round(stats.percentageWithVideo)}% dos concorrentes`);
      } else if (listing.hasClips === false) {
        youLoseHere.push(`${Math.round(stats.percentageWithVideo)}% dos concorrentes têm vídeo, você não`);
        recommendations.push('Adicionar vídeo para aumentar confiança e engajamento');
      } else {
        // null = não detectável
        youLoseHere.push(`${Math.round(stats.percentageWithVideo)}% dos concorrentes têm vídeo detectável`);
        recommendations.push('Verificar se há vídeo no anúncio; se não houver, considere adicionar');
      }
    }

    // 3. Título
    if (listing.titleLength >= stats.medianTitleLength) {
      youWinHere.push(`Seu título tem ${listing.titleLength} caracteres, acima da média de ${Math.round(stats.medianTitleLength)}`);
    } else if (listing.titleLength < stats.medianTitleLength) {
      const gap = Math.round(stats.medianTitleLength - listing.titleLength);
      youLoseHere.push(`Seu título tem ${listing.titleLength} caracteres, ${gap} abaixo da média de ${Math.round(stats.medianTitleLength)}`);
      recommendations.push(`Expandir título em ${gap} caracteres para alcançar a média da categoria`);
    }

    // 4. Competitividade de preço (apenas se não houver promo agressiva)
    if (stats.medianPrice > 0) {
      const priceDiff = ((listing.price - stats.medianPrice) / stats.medianPrice) * 100;
      if (priceDiff > 20 && !listing.hasPromotion) {
        // Preço 20% acima da mediana e sem promo
        youLoseHere.push(`Seu preço está ${Math.round(priceDiff)}% acima da mediana da categoria (R$ ${listing.price.toFixed(2)} vs R$ ${stats.medianPrice.toFixed(2)})`);
        if (metrics30d.conversionRate && metrics30d.conversionRate < 0.01) {
          recommendations.push('Revisar preço: acima da mediana e conversão baixa');
        }
      } else if (priceDiff < -10) {
        // Preço 10% abaixo da mediana
        youWinHere.push(`Seu preço está ${Math.round(Math.abs(priceDiff))}% abaixo da mediana da categoria`);
      }
    }

    // 5. Expected vs Actual Orders (se baseline disponível)
    if (baselineConversion.conversionRate !== null && baselineConversion.confidence !== 'unavailable') {
      if (metrics30d.visits >= MIN_VISITS_FOR_CR_CONFIDENCE) {
        const expectedOrders = metrics30d.visits * baselineConversion.conversionRate;
        const gapOrders = expectedOrders - metrics30d.orders;
        const gapPercent = expectedOrders > 0 ? (gapOrders / expectedOrders) * 100 : 0;

        if (gapOrders >= 1 && gapPercent >= 20) {
          youLoseHere.push(`Você está ${Math.round(gapPercent)}% abaixo do esperado em pedidos (${metrics30d.orders} vs ${Math.round(expectedOrders)} esperados)`);
          recommendations.push('Otimizar título e imagens para aumentar CTR e conversão');
        } else if (gapOrders <= -1) {
          youWinHere.push(`Você está acima do esperado em pedidos (${metrics30d.orders} vs ${Math.round(expectedOrders)} esperados)`);
        }
      }
    }

    // 6. Regra do Dia 03: promo agressiva + baixa conversão
    if (listing.hasPromotion && listing.discountPercent && listing.discountPercent >= 30) {
      if (metrics30d.conversionRate && metrics30d.conversionRate <= 0.006 && metrics30d.visits >= 150) {
        youLoseHere.push(`Promoção forte (${listing.discountPercent}% OFF) mas conversão ainda baixa (${(metrics30d.conversionRate * 100).toFixed(2)}%)`);
        recommendations.push('Priorizar otimização de título, imagens e descrição (gargalo em CTR/qualificação)');
      }
    }

    // Garantir pelo menos 2 itens em cada lista
    if (youWinHere.length === 0) {
      youWinHere.push('Seus dados estão alinhados com a média da categoria');
    }
    if (youLoseHere.length === 0) {
      youLoseHere.push('Nenhum gap significativo identificado vs concorrentes');
    }

    // Tradeoffs
    const tradeoffs = this.generateTradeoffs(youWinHere, youLoseHere, listing, stats);

    return {
      youWinHere: youWinHere.slice(0, 4), // Limitar a 4 itens
      youLoseHere: youLoseHere.slice(0, 4), // Limitar a 4 itens
      tradeoffs,
      recommendations: recommendations.slice(0, 5), // Limitar a 5 recomendações
    };
  }

  /**
   * Gera texto de tradeoffs
   */
  private generateTradeoffs(
    youWinHere: string[],
    youLoseHere: string[],
    listing: { hasPromotion: boolean; discountPercent: number | null },
    stats: BenchmarkStats
  ): string {
    if (youLoseHere.length === 0) {
      return 'Seu anúncio está competitivo em relação aos concorrentes da categoria.';
    }

    if (youWinHere.length === 0) {
      return 'Seu anúncio está abaixo da média da categoria em vários aspectos. Foque em melhorar os gaps identificados.';
    }

    // Caso comum: ganha em alguns, perde em outros
    const winCount = youWinHere.length;
    const loseCount = youLoseHere.length;

    if (loseCount > winCount) {
      return `Você perde em ${loseCount} aspectos principais vs concorrentes, mas tem ${winCount} ponto(s) forte(s). Priorize corrigir os gaps para aumentar competitividade.`;
    } else {
      return `Você está competitivo em ${winCount} aspectos, mas ainda perde em ${loseCount}. Foque nos gaps restantes para maximizar resultados.`;
    }
  }

  /**
   * Calcula mediana de um array
   */
  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calcula benchmark completo para um listing
   */
  async calculateBenchmark(
    listing: {
      id: string;
      listingIdExt: string;
      categoryId: string;
      picturesCount: number;
      hasClips: boolean | null;
      title: string;
      price: number;
      hasPromotion: boolean;
      discountPercent: number | null;
    },
    metrics30d: {
      visits: number;
      orders: number;
      conversionRate: number | null;
    }
  ): Promise<BenchmarkResult | null> {
    try {
      // 1. Buscar concorrentes
      const competitors = await this.fetchCompetitors(listing.categoryId, listing.listingIdExt);

      if (competitors.length === 0) {
        // Se não houver concorrentes, retornar null (dados indisponíveis)
        return null;
      }

      // 2. Calcular estatísticas
      const stats = this.calculateBenchmarkStats(competitors);

      // 3. Calcular baseline de conversão
      const baselineConversion = await this.calculateBaselineConversion(listing.categoryId);

      // 4. Determinar confiança geral
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (stats.sampleSize >= 15 && baselineConversion.confidence === 'high') {
        confidence = 'high';
      } else if (stats.sampleSize >= 10 && baselineConversion.confidence !== 'unavailable') {
        confidence = 'medium';
      }

      // 5. Gerar win/lose
      const { youWinHere, youLoseHere, tradeoffs, recommendations } = this.generateWinLose(
        {
          picturesCount: listing.picturesCount,
          hasClips: listing.hasClips,
          titleLength: listing.title.length,
          price: listing.price,
          hasPromotion: listing.hasPromotion,
          discountPercent: listing.discountPercent,
        },
        stats,
        baselineConversion,
        metrics30d
      );

      // 6. Montar benchmark summary
      const benchmarkSummary: BenchmarkSummary = {
        categoryId: listing.categoryId,
        sampleSize: stats.sampleSize,
        computedAt: new Date().toISOString(),
        confidence,
        notes: baselineConversion.confidence === 'unavailable' 
          ? 'Baseline de conversão indisponível (dados insuficientes). Comparação baseada apenas em features estruturais.'
          : undefined,
        stats,
        baselineConversion,
      };

      return {
        benchmarkSummary,
        youWinHere,
        youLoseHere,
        tradeoffs,
        recommendations,
      };
    } catch (error) {
      console.error(`[BENCHMARK] Erro ao calcular benchmark para listingId=${listing.id}:`, error);
      
      // NUNCA retornar null - sempre retornar objeto com confidence="unavailable"
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const errorStage = errorMessage.includes('search') ? 'ml-search' 
        : errorMessage.includes('aggregate') ? 'aggregate'
        : errorMessage.includes('baseline') ? 'baseline'
        : 'unknown';

      return {
        benchmarkSummary: {
          categoryId: listing.categoryId,
          sampleSize: 0,
          computedAt: new Date().toISOString(),
          confidence: 'unavailable',
          notes: `Benchmark indisponível: ${errorMessage}`,
          stats: {
            medianPicturesCount: 0,
            percentageWithVideo: 0,
            medianPrice: 0,
            medianTitleLength: 0,
            sampleSize: 0,
          },
          baselineConversion: {
            conversionRate: null,
            sampleSize: 0,
            totalVisits: 0,
            confidence: 'unavailable',
          },
        },
        youWinHere: [],
        youLoseHere: [],
        tradeoffs: 'Comparação com concorrentes indisponível no momento.',
        recommendations: [],
        _debug: process.env.NODE_ENV === 'development' ? {
          stage: errorStage,
          error: errorMessage,
        } : undefined,
      };
    }
  }
}

/**
 * Recommendation Service
 * 
 * Motor de recomendações baseado em regras.
 * Analisa o score_breakdown de cada anúncio e gera dicas práticas.
 */

import { PrismaClient, RecommendationType, RecommendationStatus, Listing } from '@prisma/client';
import { ScoreBreakdown } from './ScoreCalculator';

const prisma = new PrismaClient();

export interface RecommendationInput {
  listingId: string;
  tenantId: string;
  title: string;
  description: string | null;
  titleLength: number;
  picturesCount: number;
  hasVideo: boolean | null; // null = não detectável via API
  price: number;
  stock: number;
  status: string;
  visitsLast7d: number;
  salesLast7d: number;
  scoreBreakdown: ScoreBreakdown | null;
}

interface GeneratedRecommendation {
  type: RecommendationType;
  priority: number;
  title: string;
  description: string;
  impactEstimate: string;
  ruleTrigger: string;
  scoreImpact: number;
}

export class RecommendationService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Gera recomendações para um anúncio específico
   */
  generateRecommendationsForListing(input: RecommendationInput): GeneratedRecommendation[] {
    const recommendations: GeneratedRecommendation[] = [];
    // ================================================
    // 1. ANÁLISE DE CADASTRO (SEO, Imagens, Conteúdo)
    // ================================================

    // Título curto
    if (input.titleLength < 40) {
      recommendations.push({
        type: RecommendationType.seo,
        priority: 75,
        title: '📝 Expanda o título do anúncio',
        description: `Seu título tem apenas ${input.titleLength} caracteres. Títulos curtos dificultam a busca. Aproveite os 60 caracteres permitidos para incluir palavras-chave relevantes como marca, modelo, cor e tamanho.`,
        impactEstimate: '+20% visibilidade na busca',
        ruleTrigger: `title_length < 40 (atual: ${input.titleLength})`,
        scoreImpact: 10,
      });
    }

    // Função auxiliar para remover tags HTML e contar apenas texto
    const stripHtml = (html: string): string => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').trim();
    };

    // Sem descrição ou descrição muito curta
    // Validação: verificar se description é null, undefined ou string vazia
    // Limpar tags HTML antes de contar caracteres
    const description = input.description || '';
    const cleanDescription = stripHtml(description);
    const hasDescription = typeof cleanDescription === 'string' && cleanDescription.length > 0;
    const descriptionLength = hasDescription ? cleanDescription.length : 0;
    
    // Reduzir limiar: se tiver mais de 50 caracteres, considerar como existente
    if (!hasDescription || descriptionLength < 50) {
      const priority = descriptionLength === 0 ? 70 : 50; // Menor prioridade se já tem algo
      recommendations.push({
        type: RecommendationType.content,
        priority,
        title: descriptionLength === 0 
          ? '📄 Adicione uma descrição ao anúncio'
          : '📄 Melhore a descrição do anúncio',
        description: hasDescription 
          ? `Sua descrição tem apenas ${descriptionLength} caracteres. Uma descrição detalhada (com mais de 100 caracteres) ajuda os compradores a entender melhor o produto e aumenta a confiança na compra. Inclua especificações técnicas, benefícios e diferenciais.`
          : 'Adicione uma descrição detalhada ao seu anúncio. Descrições completas ajudam os compradores a entender melhor o produto e aumentam a confiança na compra.',
        impactEstimate: '+15% taxa de conversão',
        ruleTrigger: `description_length < 50 (atual: ${descriptionLength})`,
        scoreImpact: 10,
      });
    }

    // Poucas fotos
    // Validação: garantir que picturesCount é um número válido
    // Reduzir exigência: se tiver pelo menos 1 foto, não gerar recomendação crítica
    const validPicturesCount = typeof input.picturesCount === 'number' && input.picturesCount >= 0 ? input.picturesCount : 0;
    
    if (validPicturesCount === 0) {
      // Crítico: sem fotos
      recommendations.push({
        type: RecommendationType.image,
        priority: 90,
        title: '📸 Adicione fotos ao anúncio',
        description: 'Seu anúncio não possui fotos. Use pelo menos 5 imagens de alta resolução (1200x1200px) com fundo branco, mostrando diferentes ângulos, detalhes e o produto em uso.',
        impactEstimate: '+25% cliques',
        ruleTrigger: `pictures_count = 0`,
        scoreImpact: 10,
      });
    } else if (validPicturesCount < 3) {
      // Melhoria: poucas fotos (mas já tem pelo menos 1)
      recommendations.push({
        type: RecommendationType.image,
        priority: 50,
        title: '📸 Adicione mais fotos',
        description: `Seu anúncio tem apenas ${validPicturesCount} foto(s). Use pelo menos 5 imagens de alta resolução (1200x1200px) com fundo branco, mostrando diferentes ângulos, detalhes e o produto em uso para aumentar a conversão.`,
        impactEstimate: '+15% cliques',
        ruleTrigger: `pictures_count < 3 (atual: ${validPicturesCount})`,
        scoreImpact: 5,
      });
    }

    // ================================================
    // 2. ANÁLISE DE TRÁFEGO (Conversão)
    // ================================================

    // Muitas visitas, poucas vendas (baixa conversão)
    if (input.visitsLast7d > 50 && input.salesLast7d === 0) {
      recommendations.push({
        type: RecommendationType.conversion,
        priority: 90,
        title: '⚠️ Baixa conversão detectada',
        description: `Seu anúncio recebeu ${input.visitsLast7d} visitas nos últimos 7 dias mas não gerou vendas. Isso indica problemas com preço, descrição ou fotos. Verifique se seu preço está competitivo e se as informações estão completas.`,
        impactEstimate: 'Crítico - potencial de receita perdida',
        ruleTrigger: `visits > 50 AND sales = 0 (visitas: ${input.visitsLast7d})`,
        scoreImpact: 15,
      });
    }

    // Conversão baixa (< 1%)
    if (input.visitsLast7d > 20 && input.salesLast7d > 0) {
      const conversionRate = (input.salesLast7d / input.visitsLast7d) * 100;
      if (conversionRate < 1) {
        recommendations.push({
          type: RecommendationType.conversion,
          priority: 75,
          title: '📉 Taxa de conversão abaixo da média',
          description: `Sua taxa de conversão é de ${conversionRate.toFixed(2)}% (${input.salesLast7d} vendas / ${input.visitsLast7d} visitas). O ideal é acima de 2%. Revise preço, fotos e descrição para melhorar.`,
          impactEstimate: '+50% vendas potenciais',
          ruleTrigger: `conversion_rate < 1% (atual: ${conversionRate.toFixed(2)}%)`,
          scoreImpact: 15,
        });
      }
    }

    // Sem visitas recentes
    if (input.visitsLast7d === 0 && input.status === 'active') {
      recommendations.push({
        type: RecommendationType.seo,
        priority: 85,
        title: '🔍 Anúncio sem visitas',
        description: 'Seu anúncio não recebeu visitas nos últimos 7 dias. Isso pode indicar problemas de posicionamento na busca. Revise o título com palavras-chave mais relevantes ou considere usar Mercado Ads.',
        impactEstimate: 'Urgente - sem visibilidade',
        ruleTrigger: 'visits_last_7d = 0',
        scoreImpact: 15,
      });
    }

    // ================================================
    // 3. ANÁLISE DE DISPONIBILIDADE (Estoque, Status)
    // ================================================

    // Anúncio pausado
    if (input.status === 'paused') {
      recommendations.push({
        type: RecommendationType.stock,
        priority: 95,
        title: '⏸️ Anúncio pausado',
        description: 'Este anúncio está pausado e não está gerando vendas. Se o produto ainda está disponível, reative-o para voltar a vender. Anúncios pausados por muito tempo perdem posicionamento.',
        impactEstimate: 'Crítico - sem vendas',
        ruleTrigger: 'status = paused',
        scoreImpact: 20,
      });
    }

    // Estoque zerado
    if (input.stock === 0 && input.status === 'active') {
      recommendations.push({
        type: RecommendationType.stock,
        priority: 100,
        title: '📦 Estoque zerado',
        description: 'Seu anúncio está ativo mas sem estoque. Reponha o estoque urgentemente para não perder vendas. Considere ativar alertas de estoque baixo.',
        impactEstimate: 'Crítico - perdendo vendas agora',
        ruleTrigger: 'stock = 0',
        scoreImpact: 20,
      });
    }

    // Estoque baixo
    if (input.stock > 0 && input.stock < 5 && input.salesLast7d > 2) {
      recommendations.push({
        type: RecommendationType.stock,
        priority: 60,
        title: '📦 Estoque baixo',
        description: `Você tem apenas ${input.stock} unidades em estoque e vendeu ${input.salesLast7d} nos últimos 7 dias. Considere repor o estoque para evitar ruptura.`,
        impactEstimate: 'Prevenção de ruptura',
        ruleTrigger: `stock < 5 AND sales > 2 (estoque: ${input.stock})`,
        scoreImpact: 5,
      });
    }

    // ================================================
    // 4. ANÁLISE DE PREÇO
    // ================================================

    // Preço zerado ou muito baixo
    if (input.price <= 0) {
      recommendations.push({
        type: RecommendationType.price,
        priority: 100,
        title: '💰 Preço não definido',
        description: 'Este anúncio está sem preço definido. Defina um preço competitivo para começar a vender.',
        impactEstimate: 'Crítico - anúncio inválido',
        ruleTrigger: 'price <= 0',
        scoreImpact: 5,
      });
    }

    // Ordenar por prioridade (maior primeiro)
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Gera e salva recomendações para um anúncio no banco
   */
  async generateAndSaveForListing(listing: Listing): Promise<number> {
    const scoreBreakdown = listing.score_breakdown as ScoreBreakdown | null;
    
    // Validação robusta dos campos
    const description = listing.description || null;
    const descriptionLength = description ? description.length : 0;
    const picturesCount = listing.pictures_count ?? 0;
    
    // Log para debug de falsos positivos
    console.log(`[RECOMMENDATIONS] Gerando para listing ${listing.id}:`, {
      titleLength: listing.title.length,
      descriptionLength,
      picturesCount,
      hasVideo: listing.has_video,
      stock: listing.stock,
      status: listing.status,
    });
    
    const input: RecommendationInput = {
      listingId: listing.id,
      tenantId: listing.tenant_id,
      title: listing.title,
      description,
      titleLength: listing.title.length,
      picturesCount,
      hasVideo: listing.has_video, // Preservar null (não detectável via API)
      price: Number(listing.price),
      stock: listing.stock,
      status: listing.status,
      visitsLast7d: listing.visits_last_7d || 0,
      salesLast7d: listing.sales_last_7d || 0,
      scoreBreakdown,
    };

    const recommendations = this.generateRecommendationsForListing(input);
    
    // Log das recomendações geradas
    console.log(`[RECOMMENDATIONS] ${recommendations.length} recomendações geradas para ${listing.id}`);
    
    // Marcar recomendações antigas como expiradas
    await prisma.recommendation.updateMany({
      where: {
        tenant_id: this.tenantId,
        listing_id: listing.id,
        status: RecommendationStatus.pending,
      },
      data: {
        status: RecommendationStatus.expired,
      },
    });

    // Salvar novas recomendações
    let saved = 0;
    for (const rec of recommendations) {
      try {
        await prisma.recommendation.upsert({
          where: {
            tenant_id_listing_id_type_rule_trigger: {
              tenant_id: this.tenantId,
              listing_id: listing.id,
              type: rec.type,
              rule_trigger: rec.ruleTrigger,
            },
          },
          update: {
            status: RecommendationStatus.pending,
            priority: rec.priority,
            title: rec.title,
            description: rec.description,
            impact_estimate: rec.impactEstimate,
            score_impact: rec.scoreImpact,
            updated_at: new Date(),
          },
          create: {
            tenant_id: this.tenantId,
            listing_id: listing.id,
            type: rec.type,
            status: RecommendationStatus.pending,
            priority: rec.priority,
            title: rec.title,
            description: rec.description,
            impact_estimate: rec.impactEstimate,
            rule_trigger: rec.ruleTrigger,
            score_impact: rec.scoreImpact,
          },
        });
        saved++;
      } catch (error) {
        console.error(`[RECOMMENDATIONS] Erro ao salvar recomendação para listing ${listing.id}:`, error);
      }
    }

    return saved;
  }

  /**
   * Gera recomendações para todos os anúncios do tenant
   */
  async generateForAllListings(): Promise<{ totalListings: number; totalRecommendations: number }> {
    console.log(`[RECOMMENDATIONS] Gerando recomendações para tenant: ${this.tenantId}`);

    const listings = await prisma.listing.findMany({
      where: { tenant_id: this.tenantId },
    });

    console.log(`[RECOMMENDATIONS] Encontrados ${listings.length} anúncios`);

    let totalRecommendations = 0;
    for (const listing of listings) {
      const saved = await this.generateAndSaveForListing(listing);
      totalRecommendations += saved;
    }

    console.log(`[RECOMMENDATIONS] Total de ${totalRecommendations} recomendações geradas`);

    return {
      totalListings: listings.length,
      totalRecommendations,
    };
  }

  /**
   * Busca recomendações de um anúncio
   */
  async getRecommendationsForListing(listingId: string) {
    return prisma.recommendation.findMany({
      where: {
        tenant_id: this.tenantId,
        listing_id: listingId,
        status: RecommendationStatus.pending,
      },
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * Busca resumo de recomendações do tenant
   */
  async getSummary() {
    const [total, byType, byPriority] = await Promise.all([
      prisma.recommendation.count({
        where: { tenant_id: this.tenantId, status: RecommendationStatus.pending },
      }),
      prisma.recommendation.groupBy({
        by: ['type'],
        where: { tenant_id: this.tenantId, status: RecommendationStatus.pending },
        _count: { id: true },
      }),
      prisma.recommendation.groupBy({
        by: ['priority'],
        where: { tenant_id: this.tenantId, status: RecommendationStatus.pending },
        _count: { id: true },
        orderBy: { priority: 'desc' },
      }),
    ]);

    // Contar críticas (priority >= 90)
    const critical = byPriority
      .filter(p => p.priority >= 90)
      .reduce((sum, p) => sum + p._count.id, 0);

    return {
      total,
      critical,
      byType: byType.map(t => ({ type: t.type, count: t._count.id })),
    };
  }

  /**
   * Marca uma recomendação como aplicada
   */
  async markAsApplied(recommendationId: string) {
    return prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: RecommendationStatus.applied,
        applied_at: new Date(),
      },
    });
  }

  /**
   * Marca uma recomendação como ignorada
   */
  async markAsDismissed(recommendationId: string) {
    return prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: RecommendationStatus.dismissed,
        dismissed_at: new Date(),
      },
    });
  }
}

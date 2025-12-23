/**
 * OpenAI Service
 * 
 * Provides AI-powered analysis for e-commerce listings using GPT-4o.
 * Generates actionable "Growth Hacks" and SEO suggestions for Mercado Livre sellers.
 */

import OpenAI from 'openai';
import { PrismaClient, Listing, RecommendationType, RecommendationStatus } from '@prisma/client';
import { AIAnalyzeInputV1 } from '../types/ai-analyze-input';

const prisma = new PrismaClient();

export interface ListingAnalysisInput {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  status: string;
  category: string | null;
  picturesCount: number;
  hasVideo: boolean;
  visitsLast7d: number;
  salesLast7d: number;
  superSellerScore: number | null;
}

export interface GrowthHack {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

export interface SEOSuggestion {
  suggestedTitle: string;
  titleRationale: string;
  suggestedDescriptionPoints: string[];
  keywords: string[];
}

export interface AIAnalysisResult {
  score: number;
  critique: string;
  growthHacks: GrowthHack[];
  seoSuggestions: SEOSuggestion;
  analyzedAt: string;
  model: string;
}

const SYSTEM_PROMPT = `Você é um ESPECIALISTA EM SEO, CONVERSÃO E PERFORMANCE no Mercado Livre Brasil, com profundo conhecimento do algoritmo, comportamento do consumidor brasileiro e melhores práticas de e-commerce.

Sua missão é analisar dados reais de anúncios e fornecer insights acionáveis, específicos e baseados em evidências para aumentar visibilidade, conversão e vendas.

Você receberá um objeto JSON (AIAnalyzeInputV1) com dados completos do anúncio:
- Detalhes do listing (title, description, price, stock, status, category)
- Informações de mídia (imageCount, hasImages, hasVideo)
- Métricas de performance reais (visits, orders, revenue, conversionRate, ctr, impressions, clicks) dos últimos N dias
- Indicadores de qualidade de dados (missing, warnings, completenessScore, sources)

REGRAS CRÍTICAS - NUNCA VIOLAR:
1. NUNCA diga que faltam fotos se media.imageCount > 0 ou media.hasImages === true
2. NUNCA diga que falta descrição se listing.description não estiver vazio (trim().length > 0)
3. Base sua análise APENAS nos dados fornecidos no JSON - não invente ou assuma ausências
4. Se dataQuality.missing contém "images" ou "description", aí sim pode mencionar a ausência
5. Considere a categoria do produto para entender intenção de compra (transacional vs informacional)
6. Analise performance real: se conversionRate é alto mas visits baixo → problema de tráfego; se visits alto mas conversionRate baixo → problema de conversão

AVALIAÇÃO DE TÍTULO (Mercado Livre):
- Limite de 60 caracteres (otimizar para máximo impacto)
- Palavras-chave transacionais no início (ex: "Compre", "Kit", "Promoção")
- Ordem de termos: [Palavra-chave principal] + [Benefício/Diferencial] + [Especificação]
- Evitar palavras genéricas ("Produto", "Item")
- Considerar busca por voz (linguagem natural)
- SEO: palavras-chave que o comprador realmente busca
- Conversão: foco em benefício emocional ou urgência
- Promoção: destacar oferta, desconto, frete grátis

AVALIAÇÃO DE DESCRIÇÃO:
- Clareza: fácil de entender, sem jargões técnicos desnecessários
- Benefícios: o que o produto resolve/faz pelo comprador
- Quebra de objeções: garantia, qualidade, entrega rápida, suporte
- SEO sem keyword stuffing: palavras-chave naturais no texto
- Estrutura: parágrafos curtos, bullets, hierarquia visual
- Linguagem adequada ao Mercado Livre Brasil: formal mas acessível

SUGESTÕES DE TÍTULO:
- suggestedTitle: melhor opção focada em SEO (palavras-chave + benefício, até 60 chars)
- titleRationale: explique POR QUE este título é melhor e inclua 2 variações alternativas:
  * Variação 1 (SEO): [título focado em palavras-chave]
  * Variação 2 (Conversão): [título focado em benefício emocional/urgência]
  * Variação 3 (Promoção): [título destacando oferta/desconto]
  Explique quando usar cada uma baseado no perfil do produto e público-alvo

SUGESTÕES DE DESCRIÇÃO:
- suggestedDescriptionPoints: array com estrutura completa de descrição:
  * [0] Headline/gancho (1 linha impactante)
  * [1-3] Bullet points de benefícios principais (3-5 bullets)
  * [4] Especificações técnicas resumidas
  * [5] Uso/ocasião (quando/como usar)
  * [6] Garantia/confiança (política de devolução, qualidade, suporte)
- keywords: array com palavras-chave transacionais e informacionais relevantes

HACKS DE CRESCIMENTO (exatamente 3, priorizados por impacto):
- Baseados NOS DADOS REAIS fornecidos:
  * Se conversionRate alto mas visits baixo → "Investir em Ads/Anúncios Patrocinados"
  * Se visits alto mas conversionRate baixo → "Otimizar título/descrição para conversão"
  * Se price alto vs categoria → "Revisar preço competitivo"
  * Se media.hasVideo === false → "Adicionar vídeo aumenta conversão em até 30%"
  * Se ctr baixo → "Melhorar título com palavras-chave mais relevantes"
  * Se stock baixo → "Aumentar estoque para evitar perda de vendas"
- Cada hack deve ter:
  * title: ação específica e acionável
  * description: explicação detalhada do problema identificado nos dados + solução
  * priority: "high" (impacto imediato), "medium" (impacto médio prazo), "low" (otimização)
  * estimatedImpact: impacto estimado baseado em dados similares (ex: "+15% conversão", "+30% tráfego")

SCORE (0-100):
- Critique deve explicar CLARAMENTE:
  * Por que não é 100 (o que está faltando ou pode melhorar)
  * O que falta para subir 5, 10 ou 15 pontos (ações específicas)
  * Pontos fortes do anúncio (o que está funcionando bem)
- Considere:
  * Título otimizado: 20 pontos
  * Descrição completa e persuasiva: 20 pontos
  * Mídia (fotos + vídeo): 20 pontos
  * Performance (conversão, tráfego): 20 pontos
  * Preço competitivo: 10 pontos
  * Estoque disponível: 10 pontos

FORMATO DE RESPOSTA (JSON válido):
{
  "score": <number 0-100>,
  "critique": "<análise em português, 200-300 chars, explicando score e próximos passos>",
  "growthHacks": [
    {
      "title": "<ação específica em português>",
      "description": "<explicação detalhada do problema identificado nos dados + solução, 100-200 chars>",
      "priority": "high" | "medium" | "low",
      "estimatedImpact": "<impacto estimado, ex: '+15% conversão', '+30% tráfego'>"
    }
  ],
  "seoSuggestions": {
    "suggestedTitle": "<melhor título SEO, até 60 chars>",
    "titleRationale": "<explicação do título + 3 variações (SEO, Conversão, Promoção), 300-400 chars>",
    "suggestedDescriptionPoints": [
      "<headline/gancho>",
      "<bullet benefício 1>",
      "<bullet benefício 2>",
      "<bullet benefício 3>",
      "<especificações resumidas>",
      "<uso/ocasião>",
      "<garantia/confiança>"
    ],
    "keywords": ["<palavra-chave 1>", "<palavra-chave 2>", ...]
  }
}

IMPORTANTE:
- Todo texto em Português Brasileiro
- Seja específico e baseado nos dados fornecidos
- Não invente métricas ou informações não presentes no JSON
- Considere o contexto do Mercado Livre Brasil (frete, parcelamento, confiança)`;

export class OpenAIService {
  private client: OpenAI | null = null;
  private tenantId: string;
  private isReady: boolean = false;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey && apiKey.trim().length > 0) {
        this.client = new OpenAI({ apiKey });
        this.isReady = true;
      } else {
        // API key não configurada, mas não lançar erro
        this.isReady = false;
        console.warn('[OPENAI-SERVICE] OpenAI API key not configured for tenant:', tenantId);
      }
    } catch (error) {
      // Erro ao inicializar cliente OpenAI, mas não quebrar o serviço
      console.error('[OPENAI-SERVICE] Erro ao inicializar cliente OpenAI:', error);
      this.isReady = false;
      this.client = null;
    }
  }

  /**
   * Check if OpenAI is configured and available
   */
  isAvailable(): boolean {
    return this.isReady && this.client !== null;
  }

  /**
   * Build canonical AI Analyze Input V1 from listing data
   * 
   * Fetches listing and metrics from the last periodDays (default 30),
   * aggregates performance data, and calculates data quality.
   */
  async buildAIAnalyzeInput(
    listingId: string,
    userId?: string,
    requestId?: string,
    periodDays: number = 30
  ): Promise<AIAnalyzeInputV1> {
    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        tenant_id: this.tenantId,
      },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found for tenant ${this.tenantId}`);
    }

    // Calculate date range for metrics
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    // Fetch daily metrics for the period
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

    // Aggregate performance metrics
    let visits = 0;
    let orders = 0;
    let revenue: number | null = null;
    let impressions = 0;
    let clicks = 0;
    let totalCtr = 0;
    let hasDailyMetrics = dailyMetrics.length > 0;

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
      // Fallback to listing aggregates
      visits = listing.visits_last_7d ?? 0;
      orders = listing.sales_last_7d ?? 0;
      revenue = null;
    }

    const conversionRate = visits > 0 ? orders / visits : null;
    const avgCtr = dailyMetrics.length > 0 && totalCtr > 0 ? totalCtr / dailyMetrics.length : null;

    // Determine media information
    const imageCount = listing.pictures_count ?? 0;
    const hasImages = imageCount > 0 || listing.thumbnail_url !== null;
    const hasVideo = listing.has_video ?? false;
    const videoCount = hasVideo ? 1 : 0;

    // Build data quality assessment
    const missing: string[] = [];
    const warnings: string[] = [];

    if (!listing.description || listing.description.trim().length === 0) {
      missing.push('description');
    }

    if (!hasImages) {
      missing.push('images');
    }

    if (!hasDailyMetrics) {
      warnings.push(`No daily metrics found for the last ${periodDays} days. Using listing aggregates.`);
    }

    // Calculate completeness score (0-100)
    let completenessScore = 0;
    if (listing.description && listing.description.trim().length > 0) completenessScore += 30;
    if (hasImages) completenessScore += 30;
    if (hasDailyMetrics) completenessScore += 40;
    else if (visits > 0 || orders > 0) completenessScore += 20; // Partial credit for aggregates

    const analyzedAt = new Date().toISOString();

    return {
      meta: {
        requestId,
        tenantId: this.tenantId,
        userId,
        marketplace: listing.marketplace,
        listingId: listing.id,
        externalId: listing.listing_id_ext,
        analyzedAt,
        periodDays,
      },
      listing: {
        title: listing.title,
        description: listing.description ?? '',
        category: listing.category,
        price: Number(listing.price),
        currency: 'BRL',
        stock: listing.stock,
        status: listing.status,
        createdAt: listing.created_at.toISOString(),
        updatedAt: listing.updated_at.toISOString(),
      },
      media: {
        imageCount,
        hasImages,
        hasVideo,
        videoCount,
      },
      performance: {
        periodDays,
        visits,
        orders,
        revenue,
        conversionRate,
        ...(hasDailyMetrics && {
          impressions,
          clicks,
          ctr: avgCtr,
        }),
      },
      dataQuality: {
        missing,
        warnings,
        completenessScore,
        sources: {
          performance: hasDailyMetrics ? 'listing_metrics_daily' : 'listing_aggregates',
        },
      },
    };
  }

  /**
   * Analyze a listing using GPT-4o and return actionable insights
   * 
   * Now accepts AIAnalyzeInputV1 (canonical payload) instead of legacy ListingAnalysisInput
   */
  async analyzeListing(input: AIAnalyzeInputV1): Promise<AIAnalysisResult> {
    if (!this.isReady || !this.client) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Build user prompt with JSON payload and context
    const userPrompt = `Analise este anúncio do Mercado Livre usando os dados JSON fornecidos:

${JSON.stringify(input, null, 2)}

CONTEXTO PARA ANÁLISE:
- Categoria: ${input.listing.category || 'Não especificada'} - considere a intenção de compra típica desta categoria
- Período analisado: ${input.meta.periodDays} dias
- Fonte de performance: ${input.dataQuality.sources.performance} ${input.dataQuality.sources.performance === 'listing_aggregates' ? '(dados agregados, podem ser incompletos)' : '(métricas diárias confiáveis)'}
- Qualidade dos dados: ${input.dataQuality.completenessScore}/100
${input.dataQuality.missing.length > 0 ? `- Campos ausentes: ${input.dataQuality.missing.join(', ')}` : ''}
${input.dataQuality.warnings.length > 0 ? `- Avisos: ${input.dataQuality.warnings.join('; ')}` : ''}

DADOS DE PERFORMANCE:
- Visitas: ${input.performance.visits} (últimos ${input.performance.periodDays} dias)
- Pedidos: ${input.performance.orders}
- Taxa de conversão: ${input.performance.conversionRate ? (input.performance.conversionRate * 100).toFixed(2) + '%' : 'N/A'}
${input.performance.ctr !== undefined && input.performance.ctr !== null ? `- CTR: ${(input.performance.ctr * 100).toFixed(2)}%` : ''}
${input.performance.revenue !== null ? `- Receita: R$ ${input.performance.revenue.toFixed(2)}` : ''}

MÍDIA:
- Fotos: ${input.media.imageCount} ${input.media.hasImages ? '(presente)' : '(AUSENTE - mencionar na análise)'}
- Vídeo: ${input.media.hasVideo ? 'Sim' : 'Não (oportunidade de melhoria)'}

INSTRUÇÕES ESPECÍFICAS:
1. Se media.imageCount > 0, NÃO diga que faltam fotos
2. Se listing.description não estiver vazio, NÃO diga que falta descrição
3. Analise a performance real: se conversão alta mas tráfego baixo → foco em tráfego; se tráfego alto mas conversão baixa → foco em otimização
4. Considere o preço (R$ ${input.listing.price.toFixed(2)}) em relação à categoria e performance
5. Gere hacks baseados nos dados: ${input.performance.conversionRate && input.performance.conversionRate > 0.05 ? 'conversão boa' : 'conversão pode melhorar'}, ${input.performance.visits > 100 ? 'tráfego razoável' : 'tráfego baixo'}, ${input.media.hasVideo ? 'tem vídeo' : 'sem vídeo (oportunidade)'}

Forneça sua análise no formato JSON especificado. Base sua análise APENAS nos dados fornecidos acima.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2500, // Aumentado para permitir análises mais detalhadas
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const analysis = JSON.parse(content) as AIAnalysisResult;
    
    return {
      ...analysis,
      analyzedAt: new Date().toISOString(),
      model: 'gpt-4o',
    };
  }

  /**
   * Analyze a listing and save the results as recommendations in the database
   * 
   * Uses the canonical AIAnalyzeInputV1 payload with 30-day metrics by default.
   */
  async analyzeAndSaveRecommendations(
    listingId: string,
    userId?: string,
    requestId?: string,
    periodDays: number = 30
  ): Promise<{
    analysis: AIAnalysisResult;
    savedRecommendations: number;
    dataQuality: AIAnalyzeInputV1['dataQuality'];
  }> {
    // Build canonical input with real data
    const input = await this.buildAIAnalyzeInput(listingId, userId, requestId, periodDays);

    // Get listing for score update
    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        tenant_id: this.tenantId,
      },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found for tenant ${this.tenantId}`);
    }

    const analysis = await this.analyzeListing(input);

    // Save growth hacks as recommendations
    let savedCount = 0;
    
    for (const hack of analysis.growthHacks) {
      const priorityMap: Record<string, number> = {
        high: 90,
        medium: 70,
        low: 50,
      };

      try {
        await prisma.recommendation.upsert({
          where: {
            tenant_id_listing_id_type_rule_trigger: {
              tenant_id: this.tenantId,
              listing_id: listingId,
              type: RecommendationType.content,
              rule_trigger: `ai_growth_hack:${hack.title.substring(0, 50)}`,
            },
          },
          update: {
            status: RecommendationStatus.pending,
            priority: priorityMap[hack.priority] || 70,
            title: hack.title,
            description: hack.description,
            impact_estimate: hack.estimatedImpact,
            metadata: { source: 'openai', model: analysis.model },
            updated_at: new Date(),
          },
          create: {
            tenant_id: this.tenantId,
            listing_id: listingId,
            type: RecommendationType.content,
            status: RecommendationStatus.pending,
            priority: priorityMap[hack.priority] || 70,
            title: hack.title,
            description: hack.description,
            impact_estimate: hack.estimatedImpact,
            rule_trigger: `ai_growth_hack:${hack.title.substring(0, 50)}`,
            metadata: { source: 'openai', model: analysis.model },
          },
        });
        savedCount++;
      } catch (error) {
        console.error(`[OPENAI-SERVICE] Error saving growth hack recommendation:`, error);
      }
    }

    // Save SEO suggestion as a recommendation
    if (analysis.seoSuggestions?.suggestedTitle) {
      try {
        await prisma.recommendation.upsert({
          where: {
            tenant_id_listing_id_type_rule_trigger: {
              tenant_id: this.tenantId,
              listing_id: listingId,
              type: RecommendationType.seo,
              rule_trigger: 'ai_seo_title_optimization',
            },
          },
          update: {
            status: RecommendationStatus.pending,
            priority: 85,
            title: 'Otimização de Título (IA)',
            description: `Título sugerido: "${analysis.seoSuggestions.suggestedTitle}"\n\nMotivo: ${analysis.seoSuggestions.titleRationale}\n\nPalavras-chave: ${analysis.seoSuggestions.keywords.join(', ')}`,
            impact_estimate: '+15-25% visibilidade na busca',
            metadata: {
              source: 'openai',
              model: analysis.model,
              suggestedTitle: analysis.seoSuggestions.suggestedTitle,
              keywords: analysis.seoSuggestions.keywords,
              descriptionPoints: analysis.seoSuggestions.suggestedDescriptionPoints,
            },
            updated_at: new Date(),
          },
          create: {
            tenant_id: this.tenantId,
            listing_id: listingId,
            type: RecommendationType.seo,
            status: RecommendationStatus.pending,
            priority: 85,
            title: 'Otimização de Título (IA)',
            description: `Título sugerido: "${analysis.seoSuggestions.suggestedTitle}"\n\nMotivo: ${analysis.seoSuggestions.titleRationale}\n\nPalavras-chave: ${analysis.seoSuggestions.keywords.join(', ')}`,
            impact_estimate: '+15-25% visibilidade na busca',
            rule_trigger: 'ai_seo_title_optimization',
            metadata: {
              source: 'openai',
              model: analysis.model,
              suggestedTitle: analysis.seoSuggestions.suggestedTitle,
              keywords: analysis.seoSuggestions.keywords,
              descriptionPoints: analysis.seoSuggestions.suggestedDescriptionPoints,
            },
          },
        });
        savedCount++;
      } catch (error) {
        console.error(`[OPENAI-SERVICE] Error saving SEO recommendation:`, error);
      }
    }

    // Update listing with AI score if different from current
    if (analysis.score !== listing.super_seller_score) {
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          score_breakdown: {
            ...(listing.score_breakdown as object || {}),
            aiAnalysis: {
              score: analysis.score,
              critique: analysis.critique,
              analyzedAt: analysis.analyzedAt,
            },
          },
        },
      });
    }

    return {
      analysis,
      savedRecommendations: savedCount,
      dataQuality: input.dataQuality,
    };
  }
}

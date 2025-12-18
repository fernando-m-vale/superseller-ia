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

const SYSTEM_PROMPT = `You are an elite E-commerce Strategist specialized in Mercado Livre (Brazil's largest marketplace).

Your task is to analyze product listing data and provide actionable insights to help sellers increase visibility and sales.

You will receive a JSON object (AIAnalyzeInputV1) with complete listing data including:
- Listing details (title, description, price, stock, status, category)
- Media information (image count, video presence)
- Performance metrics (visits, orders, revenue, conversion rate) for the analysis period
- Data quality indicators (missing fields, warnings, completeness score)

CRITICAL INSTRUCTIONS:
- Base your analysis ONLY on the data provided in the JSON
- DO NOT assume absence of photos/description/sales if the JSON indicates otherwise
- If dataQuality indicates missing fields or warnings, mention them in your critique
- Pay attention to the performance.periodDays to understand the time window
- If performance.revenue is null or dataQuality.sources.performance is 'listing_aggregates', note that metrics may be incomplete

You must respond in valid JSON format with the following structure:
{
  "score": <number 0-100>,
  "critique": "<short critique in Portuguese, max 200 chars>",
  "growthHacks": [
    {
      "title": "<action title in Portuguese>",
      "description": "<detailed description in Portuguese>",
      "priority": "high" | "medium" | "low",
      "estimatedImpact": "<expected impact in Portuguese>"
    }
  ],
  "seoSuggestions": {
    "suggestedTitle": "<optimized title for Mercado Livre SEO>",
    "titleRationale": "<explanation of why this title is better>",
    "suggestedDescriptionPoints": ["<key point 1>", "<key point 2>", ...],
    "keywords": ["<keyword1>", "<keyword2>", ...]
  }
}

Guidelines:
- Score should reflect listing quality (0-100): consider title optimization, description quality, images, price competitiveness, and stock availability
- Provide exactly 3 growth hacks, prioritized by potential impact
- Growth hacks should be specific, actionable, and relevant to Mercado Livre's algorithm
- SEO suggestions should follow Mercado Livre's best practices (60 char titles, relevant keywords)
- All text should be in Brazilian Portuguese
- Be concise but specific in your recommendations`;

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

    // Build user prompt with JSON payload
    const userPrompt = `Analyze this Mercado Livre listing using the provided JSON data:

${JSON.stringify(input, null, 2)}

Provide your analysis in the JSON format specified. Base your analysis ONLY on the data provided above.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
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

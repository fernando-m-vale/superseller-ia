/**
 * OpenAI Service
 * 
 * Provides AI-powered analysis for e-commerce listings using GPT-4o.
 * Generates actionable "Growth Hacks" and SEO suggestions for Mercado Livre sellers.
 */

import OpenAI from 'openai';
import { PrismaClient, Listing, RecommendationType, RecommendationStatus } from '@prisma/client';

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
   * Analyze a listing using GPT-4o and return actionable insights
   */
  async analyzeListing(listing: ListingAnalysisInput): Promise<AIAnalysisResult> {
    if (!this.isReady || !this.client) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const userPrompt = `Analyze this Mercado Livre listing:

Title: ${listing.title}
Description: ${listing.description || 'No description provided'}
Price: R$ ${listing.price.toFixed(2)}
Stock: ${listing.stock} units
Status: ${listing.status}
Category: ${listing.category || 'Not specified'}
Number of Photos: ${listing.picturesCount}
Has Video: ${listing.hasVideo ? 'Yes' : 'No'}
Visits (last 7 days): ${listing.visitsLast7d}
Sales (last 7 days): ${listing.salesLast7d}
Current Super Seller Score: ${listing.superSellerScore ?? 'Not calculated'}

Provide your analysis in the JSON format specified.`;

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
   */
  async analyzeAndSaveRecommendations(listingId: string): Promise<{
    analysis: AIAnalysisResult;
    savedRecommendations: number;
  }> {
    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        tenant_id: this.tenantId,
      },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found for tenant ${this.tenantId}`);
    }

    const input: ListingAnalysisInput = {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      stock: listing.stock,
      status: listing.status,
      category: listing.category,
      picturesCount: listing.pictures_count ?? 0,
      hasVideo: listing.has_video ?? false,
      visitsLast7d: listing.visits_last_7d ?? 0,
      salesLast7d: listing.sales_last_7d ?? 0,
      superSellerScore: listing.super_seller_score,
    };

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
    };
  }
}

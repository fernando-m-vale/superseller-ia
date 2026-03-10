import OpenAI from 'openai';
import type { Prisma } from '@prisma/client';
import {
  createFallbackVisualAnalysis,
  parseVisualAnalysisResponse,
  type ListingVisualAnalysis,
} from '../types/visual-analysis';

const SYSTEM_PROMPT = `Voce e um especialista em criativos de marketplace.
Analise somente a imagem principal do anuncio.
Nao gere imagens.
Nao invente contexto fora do que aparece na imagem.

Avalie obrigatoriamente:
1. Clareza do produto
2. Contraste entre produto e fundo
3. Poluicao visual
4. Texto excessivo
5. Diferenciacao

Retorne APENAS JSON valido no formato:
{
  "visual_score": 0,
  "summary": "Resumo curto em portugues",
  "clarity": { "score": 0, "assessment": "..." },
  "contrast": { "score": 0, "assessment": "..." },
  "visual_pollution": { "score": 0, "assessment": "..." },
  "excessive_text": { "score": 0, "assessment": "..." },
  "differentiation": { "score": 0, "assessment": "..." },
  "main_improvements": ["...", "..."]
}`;

type ListingImageSource = {
  thumbnail_url?: string | null;
  pictures_json?: Prisma.JsonValue | null;
};

type OpenAIClientLike = {
  chat: {
    completions: {
      create: (params: Record<string, unknown>) => Promise<{
        choices?: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
};

export class VisualAnalysisService {
  private client: OpenAIClientLike | null;

  constructor(client?: OpenAIClientLike | null) {
    if (client) {
      this.client = client;
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey && apiKey.trim().length > 0
      ? new OpenAI({ apiKey }) as unknown as OpenAIClientLike
      : null;
  }

  resolveMainImageUrl(listing: ListingImageSource): string | null {
    const pictureUrl = this.extractPictureUrl(listing.pictures_json);
    return pictureUrl || listing.thumbnail_url || null;
  }

  async analyzeMainImage(input: {
    title: string;
    category?: string | null;
    mainImageUrl: string | null;
  }): Promise<ListingVisualAnalysis> {
    if (!input.mainImageUrl) {
      return createFallbackVisualAnalysis({
        mainImageUrl: null,
        reason: 'imagem principal ausente',
      });
    }

    try {
      new URL(input.mainImageUrl);
    } catch {
      return createFallbackVisualAnalysis({
        mainImageUrl: input.mainImageUrl,
        reason: 'URL da imagem principal invalida',
      });
    }

    if (!this.client) {
      return createFallbackVisualAnalysis({
        mainImageUrl: input.mainImageUrl,
        reason: 'OpenAI nao configurado',
      });
    }

    const userPrompt =
      `Titulo do anuncio: ${input.title}\n` +
      `Categoria: ${input.category || 'nao informada'}\n` +
      'Avalie somente a imagem principal anexada e gere score visual de 0 a 100 com melhorias acionaveis.';

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: input.mainImageUrl,
                detail: 'low',
              },
            },
          ],
        },
      ],
    } as Record<string, unknown>);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return createFallbackVisualAnalysis({
        mainImageUrl: input.mainImageUrl,
        reason: 'resposta vazia da IA',
      });
    }

    try {
      return parseVisualAnalysisResponse(JSON.parse(content), input.mainImageUrl);
    } catch (error) {
      return createFallbackVisualAnalysis({
        mainImageUrl: input.mainImageUrl,
        reason: error instanceof Error ? error.message : 'falha ao interpretar resposta visual',
      });
    }
  }

  private extractPictureUrl(pictures: Prisma.JsonValue | null | undefined): string | null {
    if (!Array.isArray(pictures)) {
      return null;
    }

    for (const picture of pictures) {
      if (!picture || typeof picture !== 'object') {
        continue;
      }

      const candidate = picture as Record<string, unknown>;
      const url = candidate.secure_url || candidate.url;
      if (typeof url === 'string' && url.trim().length > 0) {
        return url;
      }
    }

    return null;
  }
}

import OpenAI from 'openai';
import {
  VISUAL_ANALYSIS_MODEL,
  VISUAL_ANALYSIS_PROMPT_VERSION,
} from './visual-analysis.constants';

const SYSTEM_PROMPT = `Voce e um especialista em imagem principal de marketplace.
Analise apenas a imagem principal do anuncio.
Nao gere imagens.
Nao descreva detalhes irrelevantes.
Julgue a imagem pelo potencial de gerar clique qualificado em um marketplace.

Responda APENAS com JSON valido e estrito no formato:
{
  "visualScore": 0,
  "visualSummary": "Resumo curto e objetivo em portugues",
  "clarity": { "score": 0, "verdict": "forte|medio|fraco", "reason": "..." },
  "contrast": { "score": 0, "verdict": "forte|medio|fraco", "reason": "..." },
  "visualPollution": { "score": 0, "verdict": "forte|medio|fraco", "reason": "..." },
  "excessiveText": { "score": 0, "verdict": "forte|medio|fraco", "reason": "..." },
  "differentiation": { "score": 0, "verdict": "forte|medio|fraco", "reason": "..." },
  "clickability": { "score": 0, "verdict": "forte|medio|fraco", "reason": "..." },
  "mainImprovements": ["...", "..."]
}`;

export type OpenAIClientLike = {
  chat: {
    completions: {
      create: (params: Record<string, unknown>) => Promise<{
        choices?: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
};

export class VisualAnalysisLLMService {
  private client: OpenAIClientLike | null;

  constructor(client?: OpenAIClientLike | null) {
    if (client !== undefined) {
      this.client = client;
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey && apiKey.trim().length > 0
      ? (new OpenAI({ apiKey }) as unknown as OpenAIClientLike)
      : null;
  }

  async analyze(input: {
    title: string;
    category?: string | null;
    mainImageUrl: string;
  }): Promise<unknown> {
    if (!this.client) {
      throw new Error('OpenAI nao configurado');
    }

    const userPrompt =
      `Versao do prompt: ${VISUAL_ANALYSIS_PROMPT_VERSION}\n` +
      `Titulo do anuncio: ${input.title}\n` +
      `Categoria: ${input.category || 'nao informada'}\n` +
      'Avalie somente a imagem principal anexada e gere uma resposta orientada a clique.';

    const response = await this.client.chat.completions.create({
      model: VISUAL_ANALYSIS_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
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
      throw new Error('resposta vazia da IA visual');
    }

    return JSON.parse(content);
  }
}

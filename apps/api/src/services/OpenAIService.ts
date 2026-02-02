/**
 * OpenAI Service
 * 
 * Provides AI-powered analysis for e-commerce listings using GPT-4o.
 * Generates actionable "Growth Hacks" and SEO suggestions for Mercado Livre sellers.
 * 
 * V2.1: Modo agressivo + ações concretas + análise de descrição + saída JSON estruturada.
 */

import OpenAI from 'openai';
import { PrismaClient, Listing, RecommendationType, RecommendationStatus } from '@prisma/client';
import { AIAnalyzeInputV1, AIAnalyzeInputV21 } from '../types/ai-analyze-input';
import { 
  type AIAnalysisResultV21, 
  AIAnalysisResultV21Schema,
  parseAIResponseV21, 
  createFallbackAnalysisV21,
  type V1CompatibleResult,
  convertV21ToV1
} from '../types/ai-analysis-v21';
import {
  type AIAnalysisResultExpert,
  parseAIResponseExpert,
  createFallbackAnalysisExpert
} from '../types/ai-analysis-expert';
import { IAScoreService, IAScoreResult } from './IAScoreService';
import { getMediaVerdict } from '../utils/media-verdict';

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
  hasVideo: boolean | null; // null = indisponível via API
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

IMPORTANTE: O SCORE JÁ FOI CALCULADO baseado em dados reais. Você NÃO deve calcular um novo score.

Sua missão é:
1. EXPLICAR os gaps identificados no score calculado
2. SUGERIR ações específicas para melhorar cada dimensão
3. PRIORIZAR dimensões com menor score no breakdown
4. FOCAR em impacto mensurável (quantos pontos cada ação pode ganhar)

Você receberá um objeto JSON (AIAnalyzeInputV1) com dados completos do anúncio:
- Detalhes do listing (title, description, price, stock, status, category)
- Informações de mídia (imageCount, hasImages, hasVideo, hasClips)
- Métricas de performance reais (visits, orders, revenue, conversionRate, ctr, impressions, clicks) dos últimos N dias
- Indicadores de qualidade de dados (missing, warnings, completenessScore, sources)

REGRAS CRÍTICAS - NUNCA VIOLAR:
1. NUNCA diga que faltam fotos se media.imageCount > 0 ou media.hasImages === true
2. NUNCA diga que falta descrição se listing.description não estiver vazio (trim().length > 0)
3. Base sua análise APENAS nos dados fornecidos no JSON - não invente ou assuma ausências
4. Se dataQuality.missing contém "images" ou "description", aí sim pode mencionar a ausência
5. Considere a categoria do produto para entender intenção de compra (transacional vs informacional)
6. Analise performance real: se conversionRate é alto mas visits baixo → problema de tráfego; se visits alto mas conversionRate baixo → problema de conversão
7. SOBRE QUANTIDADE DE IMAGENS (CRÍTICO - NUNCA VIOLAR):
   - Se media.imageCount >= 8 → NUNCA diga "poucas imagens" ou "adicionar mais imagens"
   - Se media.imageCount >= 12 → use texto tipo "imagens suficientes" ou "forte em imagens"
   - Só sugerir "adicionar mais imagens" se media.imageCount <= 5 (realmente baixo)
   - NUNCA invente "limite máximo do ML" no texto
   - Se media.imageCount é alto mas score de mídia baixo, focar em vídeo/clips, não em imagens
8. SOBRE CLIP (VÍDEO) - CRÍTICO - NUNCA VIOLAR - USAR media.mediaVerdict:
   - IMPORTANTE: No Mercado Livre, sellers só têm "CLIP" (vídeo). Não há distinção entre vídeo e clip.
   - O payload inclui media.mediaVerdict que é a FONTE ÚNICA DE VERDADE sobre clip (vídeo)
   - media.mediaVerdict.canSuggestClip:
     * Se false → PROIBIDO sugerir "Adicionar clip" (já tem clip OU não detectável)
     * Se true → PODE sugerir "Adicionar clip (vídeo)" (certeza de ausência)
   - media.mediaVerdict.hasClipDetected:
     * true → Anúncio TEM clip detectado via API (NUNCA sugerir adicionar)
     * false → Anúncio NÃO tem clip (certeza, pode sugerir)
     * null → Não detectável via API (NUNCA afirmar ausência, usar linguagem condicional)
   - media.mediaVerdict.message:
     * Use esta mensagem como referência para explicar o status do clip
     * NUNCA contradiga esta mensagem
   - REGRAS OBRIGATÓRIAS:
     * Se media.mediaVerdict.canSuggestClip === false → NUNCA criar hack "Adicionar clip"
     * Se media.mediaVerdict.hasClipDetected === null → SEMPRE usar linguagem condicional
     * Se media.mediaVerdict.hasClipDetected === true → SEMPRE afirmar presença, nunca sugerir adicionar
   - TERMINOLOGIA:
     * Use sempre "clip (vídeo)" ou "clip/vídeo" para deixar claro que são a mesma coisa
     * NUNCA mencione "vídeo" separadamente de "clip"
     * media.hasVideo é LEGADO e não deve ser usado na decisão
     * media.hasClips é a FONTE DE VERDADE
9. SOBRE VISITAS (visits_unknown_via_api):
   - Se dataQuality.warnings contém "visits_unknown_via_api" → NUNCA diga "zero visitas" ou "sem visitas"
   - Use: "Visitas não disponíveis via API; valide no painel do Mercado Livre"
   - Não conclua ausência de tráfego se visits estiver unknown
   - Orders podem estar disponíveis mesmo se visits estiver unknown (fonte: Orders API)
   - EXEMPLOS PROIBIDOS (quando hasClips=null):
     * ❌ "Você não tem clips" (afirmação absoluta)
     * ❌ "Adicione clips" (como se fosse certeza)
     * ❌ "Falta clips" (assumindo ausência)
   - EXEMPLOS PERMITIDOS (quando hasClips=null):
     * ✅ "Clips não detectável via API; valide no painel do Mercado Livre. Se você ainda não tiver clips, inclua..."
     * ✅ "Verifique clips no painel; API não detecta automaticamente"
10. SOBRE PERFORMANCE INDISPONÍVEL (CRÍTICO - NUNCA VIOLAR):
   - Se dataQuality.performanceAvailable === false:
     * NUNCA chamar Performance de "gargalo" ou "maior problema"
     * NUNCA afirmar "tráfego baixo", "sem visitas", "conversão baixa"
     * NUNCA penalizar o anúncio por falta de dados de performance
     * Mostrar Performance como "Indisponível via API" ou "Sem dados suficientes"
     * Usar linguagem CONDICIONAL para hacks de performance:
       - ✅ "Se você quiser aumentar tráfego, considere..."
       - ✅ "Para melhorar conversão (quando dados estiverem disponíveis)..."
       - ❌ "Seu tráfego está baixo" (afirmação sem dados)
       - ❌ "Conversão precisa melhorar" (conclusão sem dados)
   - Se dataQuality.visitsCoverage.filledDays === 0:
     * Significa que NENHUM dia do período tem dados de visitas
     * Tratar como "dados indisponíveis", não como "zero visitas"
     * O score de Performance já foi ajustado para não penalizar (15/30 = neutro)

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
  * REGRAS PARA IMAGENS (OBRIGATÓRIAS):
    - Se media.imageCount >= 8 → NÃO criar hack "Adicionar mais imagens" (já tem muitas)
    - Se media.imageCount >= 12 → NÃO mencionar quantidade de imagens, focar em qualidade/variação se necessário
    - Só sugerir "adicionar mais imagens" se media.imageCount <= 5
  * REGRAS PARA VÍDEO/CLIPS (OBRIGATÓRIAS - USAR media.mediaVerdict):
    - Se media.mediaVerdict.canSuggestClip === false → NÃO criar hack "Adicionar clip" (já tem OU não detectável)
    - Se media.mediaVerdict.canSuggestClip === true → PODE criar hack "Adicionar clip (vídeo)" (certeza de ausência)
    - Se media.mediaVerdict.hasClipDetected === null → Hack deve usar linguagem condicional baseada em media.mediaVerdict.message
    - Se media.mediaVerdict.hasClipDetected === true → NUNCA criar hack sobre clip (já tem)
    - Se media.hasClips === null → Hack deve dizer: "Verifique clips no painel do Mercado Livre; API não detecta automaticamente. Se você ainda não tiver clips, inclua..." (NUNCA afirmar ausência)
    - Se media.hasClips === false → Hack pode dizer "Publicar clips pode aumentar engajamento" (certeza de ausência)
    - Se media.hasClips === true → Hack pode dizer "Melhorar clips (thumb, roteiro, benefícios)"
  * Se ctr baixo → "Melhorar título com palavras-chave mais relevantes"
  * Se stock baixo → "Aumentar estoque para evitar perda de vendas"
- Cada hack deve ter:
  * title: ação específica e acionável
  * description: explicação detalhada do problema identificado nos dados + solução (respeitando regras de vídeo/clips acima)
  * priority: "high" (impacto imediato), "medium" (impacto médio prazo), "low" (otimização)
  * estimatedImpact: impacto estimado baseado em dados similares (ex: "+15% conversão", "+30% tráfego")

SCORE (0-100):
- O score JÁ FOI CALCULADO e será fornecido no contexto
- Critique deve explicar CLARAMENTE:
  * Por que o score não é 100 (baseado no breakdown fornecido)
  * O que falta para subir 5, 10 ou 15 pontos (ações específicas)
  * Pontos fortes do anúncio (dimensões com maior score)
- Use o breakdown fornecido para identificar gargalos:
  * Cadastro (0-20): título, descrição, categoria, status
  * Mídia (0-20): fotos, vídeo
  * Performance (0-30): visitas, pedidos, conversão
  * SEO (0-20): CTR, palavras-chave
  * Competitividade (0-10): placeholder V1

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

/**
 * SYSTEM_PROMPT - Mercado Livre Expert (ml-expert-v1)
 * 
 * Consultor sênior especialista em Mercado Livre.
 * Focado em aumentar rankeamento, conversão e sinais algorítmicos reais.
 */
const SYSTEM_PROMPT_EXPERT = `Você é um consultor sênior especialista em Mercado Livre.

Seu objetivo é aumentar:
- rankeamento
- conversão
- sinais algorítmicos reais do Mercado Livre

Você NÃO deve:
- explicar teoria
- suavizar problemas
- dar sugestões vagas
- usar linguagem genérica
- entregar conteúdo raso ou genérico

Você DEVE:
- ser direto
- ser crítico
- ser orientado à execução
- entregar ações prontas para aplicar
- entregar conteúdo PROFUNDO e ESPECIALISTA (nível consultor pago)

Sempre considere que o vendedor quer saber exatamente:
"O que eu faço agora para vender mais?"

Se algum dado não puder ser analisado por limitação de API ou dados ausentes, diga isso claramente.
Nunca invente informações.
Nunca assuma dados não fornecidos.

REGRAS OBRIGATÓRIAS DE QUALIDADE (HARD CONSTRAINTS):

1. description_fix.optimized_copy:
   - DEVE ser um texto completo pronto para colar no Mercado Livre
   - Estrutura MÍNIMA obrigatória:
     * Linha inicial SEO (1-2 linhas com keyword principal)
     * Seção "⭐ Destaques" (3-6 bullets)
     * Seção "📏 Tamanhos / Medidas" ou "📌 Especificações" (conforme categoria)
     * Seção "📦 O que você recebe"
     * Seção "🧼 Cuidados" (quando fizer sentido)
     * Seção "🚀 Dica de compra" (1 dica prática)
     * CTA final ("👉 Garanta já..." ou similar)
   - Tamanho mínimo: >= 600 caracteres (ou >= 8 linhas com bullets)
   - NÃO pode ser 1 parágrafo genérico

2. title_fix.after:
   - DEVE começar com o termo de busca principal
   - DEVE incluir 2-4 atributos relevantes (ex: "USB", "Infantil", "Recarregável", "3D", "Unissex", "Kit")
   - PROIBIDO ser genérico ("Produto incrível...", "Melhor produto...")
   - Tamanho mínimo: >= 45 caracteres
   - DEVE conter keyword principal derivada do título atual

3. image_plan:
   - Se pictures_count >= 4, retornar 4 itens (imagem 1..4)
   - Se pictures_count >= 6, retornar 5 ou 6 itens
   - Cada item deve ser específico e acionável

4. final_action_plan:
   - Mínimo 5 ações
   - Ordenadas por impacto (do mais rápido e forte para o mais trabalhoso)
   - Cada ação deve ser concreta e executável

5. Promoção:
   - Se has_promotion=true, OBRIGATÓRIO citar "promoção ativa" e usar price_base e price_final no texto
   - Se has_promotion=false, usar linguagem condicional ("Se você não tiver promoção ativa...")
   - NUNCA inventar valores de promoção

6. Clip (vídeo):
   - Se hasClips for null / "não detectável", NÃO afirmar que não tem
   - DEVE dizer: "Não foi possível confirmar via API"
   - NÃO sugerir adicionar clip se canSuggestClip=false

IMPORTANTE: Você DEVE retornar APENAS JSON válido, sem markdown, sem texto antes ou depois.
O JSON deve começar com { e terminar com }.
NÃO use \`\`\`json ou qualquer formatação markdown.
NÃO adicione explicações ou comentários fora do JSON.`;

/**
 * SYSTEM_PROMPT V2.1 - Modo Agressivo + Ações Concretas + Análise de Descrição
 * 
 * Gera saída JSON estruturada conforme AIAnalysisResultV21Schema.
 * 
 * @deprecated Substituído por SYSTEM_PROMPT_EXPERT (ml-expert-v1)
 */
const SYSTEM_PROMPT_V21 = `Você é um CONSULTOR AGRESSIVO DE E-COMMERCE especializado em Mercado Livre Brasil.

IMPORTANTE: O SCORE JÁ FOI CALCULADO baseado em dados reais. Você NÃO deve calcular um novo score.

Sua missão é gerar uma análise estruturada em JSON com:
1. VERDICT: headline e summary explicando o score
2. ACTIONS: lista de ações priorizadas (priority 1-3, onde 1 = mais importante)
3. TITLE: título sugerido com keywords e rationale
4. DESCRIPTION: bullets e texto completo sugerido
5. IMAGES: plano de imagens por slot (1..N)
6. PROMO: análise de preço/promoção (se aplicável)

Você receberá um objeto JSON (AIAnalyzeInputV1) com dados completos do anúncio.

REGRAS CRÍTICAS - NUNCA VIOLAR:
1. Base sua análise APENAS nos dados fornecidos no JSON
2. Se media.imageCount >= 8 → NUNCA diga "poucas imagens"
3. Se listing.description não estiver vazio → NUNCA diga que falta descrição
4. Se dataQuality.performanceAvailable === false → usar linguagem condicional
5. Se media.mediaVerdict.canSuggestClip === false → NUNCA sugerir "Adicionar clip"

FORMATO DE RESPOSTA (JSON válido):
{
  "verdict": {
    "headline": "<resumo em 1 linha do problema principal>",
    "summary": "<explicação detalhada do score e gaps, 200-300 chars>"
  },
  "actions": [
    {
      "priority": 1, // 1 = mais importante, 2 = médio, 3 = menos importante
      "instruction": "<ação específica e acionável>",
      "before": "<estado atual (opcional)>",
      "after": "<estado desejado (opcional)>",
      "expectedImpact": "<impacto estimado, ex: '+15% conversão'>"
    }
  ],
  "title": {
    "suggested": "<melhor título SEO, até 60 chars>",
    "keywords": ["palavra1", "palavra2"],
    "rationale": "<explicação do título>"
  },
  "description": {
    "bullets": ["bullet 1", "bullet 2", ...],
    "fullText": "<texto completo opcional>"
  },
  "images": {
    "plan": [
      {
        "slot": 1,
        "description": "<o que deve aparecer nesta imagem>",
        "purpose": "<propósito: produto, benefício, uso, etc>"
      }
    ]
  },
  "promo": {
    "priceBase": <preço original>,
    "priceFinal": <preço com desconto>,
    "discount": <percentual de desconto>,
    "recommendation": "<recomendação sobre promoção>"
Seu objetivo é MAXIMIZAR vendas através de ações CONCRETAS e IMEDIATAS.

MODO DE OPERAÇÃO: AGRESSIVO
- Seja DIRETO e ESPECÍFICO nas recomendações
- Priorize AÇÕES que geram RESULTADO IMEDIATO
- Não seja genérico - cada ação deve ser IMPLEMENTÁVEL AGORA
- Foque em CONVERSÃO e TRÁFEGO acima de tudo

DADOS QUE VOCÊ RECEBERÁ:
1. Dados do anúncio (título, descrição, preço base/final, promoção, desconto)
2. Mídia (fotos, vídeo/clips com MediaVerdict)
3. Performance (visitas, pedidos, conversão, CTR) - pode estar indisponível
4. Score calculado (NÃO recalcule - apenas explique)
5. Qualidade dos dados (visits_status: ok/partial/unavailable)

REGRAS CRÍTICAS - NUNCA VIOLAR:
1. FOTOS: Se pictures_count >= 6, NÃO diga "poucas fotos". Se >= 10, elogie.
2. DESCRIÇÃO: Se description_length > 0, NÃO diga "sem descrição". Analise QUALIDADE.
3. VÍDEO/CLIPS: Use APENAS media_analysis.video do input:
   - Se can_suggest=false → PROIBIDO sugerir adicionar vídeo
   - Se has_video=null → Usar linguagem condicional ("verifique no painel")
   - Se has_video=true → NUNCA sugerir adicionar
4. PERFORMANCE: Se visits_status="unavailable":
   - NUNCA diga "tráfego baixo" ou "sem visitas"
   - Use linguagem condicional: "Se você quiser aumentar tráfego..."
5. PREÇO: Analise price_base vs price_final:
   - SEMPRE use price_final como preço real do anúncio
   - Se has_promotion=true, mencione o desconto como ponto positivo
   - Se discount_percent > 20%, destaque a promoção agressiva
   - NUNCA sugira "considerar promoção" se has_promotion=true (já existe promoção ativa)

ANÁLISE DE TÍTULO (OBRIGATÓRIO):
- Avalie: comprimento, palavras-chave, clareza, apelo emocional
- Identifique: palavras genéricas, oportunidades de SEO
- Sugira: 3 variações (SEO, Conversão, Promoção)
- Score: 0-100 baseado em critérios objetivos

ANÁLISE DE DESCRIÇÃO (OBRIGATÓRIO):
- Avalie estrutura: headline, benefícios, specs, confiança
- Identifique gaps: o que está faltando para converter
- Sugira estrutura completa se description_length < 500
- Score: 0-100 baseado em completude e persuasão

AÇÕES (3-5, priorizadas por impacto):
Cada ação DEVE ter:
- id: identificador único (ex: "add_video", "improve_title")
- type: title | description | media | price | stock | seo | promotion
- priority: critical | high | medium | low
- title: ação específica em português
- description: problema + solução detalhada
- impact: { metric, estimated_gain, confidence }
- how_to: array de passos concretos
- ml_deeplink: link para edição no ML (se aplicável)

DIAGNÓSTICO:
- overall_health: critical | needs_attention | good | excellent
- main_bottleneck: O MAIOR problema do anúncio
- quick_wins: Ações de alto impacto e baixo esforço
- long_term: Melhorias estratégicas

FORMATO DE RESPOSTA (JSON VÁLIDO - AIAnalysisResultV21):
{
  "meta": {
    "version": "2.1",
    "model": "gpt-4o",
    "analyzed_at": "<ISO 8601>",
    "prompt_version": "ai-v2.1"
  },
  "score": {
    "final": <0-100>,
    "breakdown": {
      "cadastro": <0-20>,
      "midia": <0-20>,
      "performance": <0-30>,
      "seo": <0-20>,
      "competitividade": <0-10>
    },
    "potential_gain": <pontos que podem ser ganhos>
  },
  "diagnostic": {
    "overall_health": "critical" | "needs_attention" | "good" | "excellent",
    "main_bottleneck": "<principal gargalo>",
    "quick_wins": ["<ação rápida 1>", "<ação rápida 2>"],
    "long_term": ["<melhoria longo prazo 1>"]
  },
  "title_analysis": {
    "current": "<título atual>",
    "score": <0-100>,
    "issues": ["<problema 1>", "<problema 2>"],
    "suggestions": [
      { "text": "<título sugerido>", "focus": "seo" | "conversion" | "promotion", "rationale": "<por quê>" }
    ],
    "keywords": {
      "present": ["<palavra presente>"],
      "missing": ["<palavra ausente importante>"],
      "recommended": ["<palavra recomendada>"]
    }
  },
  "description_analysis": {
    "current_length": <número de caracteres>,
    "score": <0-100>,
    "has_description": true | false,
    "issues": ["<problema 1>"],
    "structure": {
      "has_headline": true | false,
      "has_benefits": true | false,
      "has_specs": true | false,
      "has_trust_elements": true | false
    },
    "suggested_structure": [
      { "section": "Headline", "content": "<conteúdo sugerido>" },
      { "section": "Benefícios", "content": "<bullet points>" },
      { "section": "Especificações", "content": "<specs>" },
      { "section": "Garantia", "content": "<elementos de confiança>" }
    ]
  },
  "media_analysis": {
    "photos": {
      "count": <número>,
      "score": <0-100>,
      "is_sufficient": true | false,
      "issues": ["<problema>"],
      "recommendations": ["<recomendação>"]
    },
    "video": {
      "has_video": true | false | null,
      "can_suggest": true | false,
      "status_message": "<mensagem do MediaVerdict>",
      "recommendation": "<recomendação ou null>"
    }
  },
  "price_analysis": {
    "price_base": <preço base>,
    "price_final": <preço final>,
    "has_promotion": true | false,
    "discount_percent": <percentual ou null>,
    "score": <0-100>,
    "analysis": "<análise do preço>",
    "recommendation": "<recomendação ou null>"
  },
  "actions": [
    {
      "id": "<identificador>",
      "type": "title" | "description" | "media" | "price" | "stock" | "seo" | "promotion",
      "priority": "critical" | "high" | "medium" | "low",
      "title": "<título da ação>",
      "description": "<descrição detalhada>",
      "impact": {
        "metric": "<métrica impactada>",
        "estimated_gain": "<ganho estimado>",
        "confidence": "high" | "medium" | "low"
      },
      "how_to": ["<passo 1>", "<passo 2>"],
      "ml_deeplink": "<link ou omitir>"
    }
  ],
  "critique": "<crítica geral 200-400 chars>",
  "data_quality": {
    "visits_status": "ok" | "partial" | "unavailable",
    "performance_available": true | false,
    "warnings": ["<aviso>"]
  }
}

IMPORTANTE:
- Responda APENAS com JSON válido, sem texto adicional
- Use o score fornecido no input (NÃO recalcule)
- Todo texto em Português Brasileiro
- Seja AGRESSIVO nas recomendações - o vendedor quer VENDER MAIS`;

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
      let totalVisits: number | null = null;
      let hasKnownVisits = false;
      
      for (const metric of dailyMetrics) {
        // Visits pode ser null (unknown) - tratar separadamente
        if (metric.visits !== null) {
          if (totalVisits === null) {
            totalVisits = 0;
          }
          totalVisits += metric.visits;
          hasKnownVisits = true;
        }
        
        orders += metric.orders;
        impressions += metric.impressions ?? 0; // Tratar null como 0 para agregação
        clicks += metric.clicks ?? 0; // Tratar null como 0 para agregação
        const gmv = Number(metric.gmv);
        if (revenue === null) {
          revenue = gmv;
        } else {
          revenue += gmv;
        }
        // CTR: só somar se não for null
        if (metric.ctr !== null) {
          totalCtr += Number(metric.ctr);
        }
      }
      
      visits = totalVisits ?? 0; // Se null, usar 0 para cálculo, mas marcar como unknown
    } else {
      // Fallback to listing aggregates
      visits = listing.visits_last_7d ?? 0;
      orders = listing.sales_last_7d ?? 0;
      revenue = null;
    }

    // Verificar se visits é unknown (null em todas as métricas)
    const visitsUnknown = hasDailyMetrics && dailyMetrics.every(m => m.visits === null);
    
    // Calcular visitsCoverage: quantos dias têm visits não-null
    const visitsFilledDays = hasDailyMetrics 
      ? dailyMetrics.filter(m => m.visits !== null).length 
      : 0;
    const visitsTotalDays = hasDailyMetrics ? dailyMetrics.length : periodDays;
    const performanceAvailable = visitsFilledDays > 0;
    
    const conversionRate = visitsUnknown ? null : (visits > 0 ? orders / visits : null);
    
    // CTR: null se impressions ou clicks forem null, ou se impressions = 0
    const hasImpressions = hasDailyMetrics && dailyMetrics.some(m => m.impressions !== null && m.impressions > 0);
    const hasClicks = hasDailyMetrics && dailyMetrics.some(m => m.clicks !== null);
    const ctrCount = dailyMetrics.filter(m => m.ctr !== null).length;
    const avgCtr = (hasImpressions && hasClicks && ctrCount > 0) 
      ? totalCtr / ctrCount 
      : null;

    // Determine media information
    const imageCount = listing.pictures_count ?? 0;
    const hasImages = imageCount > 0 || listing.thumbnail_url !== null;
    const hasVideo = listing.has_video; // LEGADO: não usar na decisão (mantido para compatibilidade)
    const hasClips = listing.has_clips ?? null; // FONTE DE VERDADE: no ML, clip = vídeo. null = não detectável via API
    const videoCount = hasClips === true ? 1 : 0; // Usar hasClips para contar
    
    // Gerar MediaVerdict - Fonte única de verdade (usar apenas hasClips)
    const mediaVerdict = getMediaVerdict(hasClips, imageCount);

    // Build data quality assessment
    const missing: string[] = [];
    const warnings: string[] = [];

    if (!listing.description || listing.description.trim().length === 0) {
      missing.push('description');
    }

    if (!hasImages) {
      missing.push('images');
    }

    // Adicionar métricas indisponíveis (null) em missing
    if (hasDailyMetrics) {
      const hasAnyImpressions = dailyMetrics.some(m => m.impressions !== null);
      const hasAnyClicks = dailyMetrics.some(m => m.clicks !== null);
      const hasAnyCtr = dailyMetrics.some(m => m.ctr !== null);
      
      if (!hasAnyImpressions) {
        missing.push('impressions');
      }
      if (!hasAnyClicks) {
        missing.push('clicks');
      }
      if (!hasAnyCtr || avgCtr === null) {
        missing.push('ctr');
      }
    }

    if (!hasDailyMetrics) {
      warnings.push(`No daily metrics found for the last ${periodDays} days. Using listing aggregates.`);
    }

    // Adicionar warnings sobre qualidade dos dados
    if (visitsUnknown) {
      warnings.push('visits_unknown_via_api');
    } else if (hasDailyMetrics && visits === 0 && orders === 0) {
      warnings.push('visits_zero_but_metrics_exist');
    } else if (!hasDailyMetrics && visits === 0 && orders === 0) {
      warnings.push('no_metrics_available');
    }

    if (hasClips === null) {
      warnings.push('clips_not_detectable_via_items_api');
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
        hasClips,
        videoCount,
        mediaVerdict, // Fonte única de verdade para decisões sobre vídeo/clips
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
        visitsCoverage: {
          filledDays: visitsFilledDays,
          totalDays: visitsTotalDays,
        },
        performanceAvailable,
        sources: {
          performance: hasDailyMetrics ? 'listing_metrics_daily' : 'listing_aggregates',
        },
      },
    };
  }

  /**
   * Build canonical AI Analyze Input V2.1 from listing data
   * 
   * Extends V1 with:
   * - price_base / price_final / has_promotion / discount_percent
   * - description_length
   * - visits_status (ok/partial/unavailable)
   */
  async buildAIAnalyzeInputV21(
    listingId: string,
    userId?: string,
    requestId?: string,
    periodDays: number = 30
  ): Promise<AIAnalyzeInputV21> {
    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        tenant_id: this.tenantId,
      },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found for tenant ${this.tenantId}`);
    }

    // Get V1 input as base
    const v1Input = await this.buildAIAnalyzeInput(listingId, userId, requestId, periodDays);

    // Calculate price fields
    const priceBase = Number(listing.price);
    const priceFinal = listing.price_final ? Number(listing.price_final) : priceBase;
    const hasPromotion = listing.has_promotion ?? false;
    const discountPercent = listing.discount_percent ?? null;

    // Calculate description length
    const descriptionLength = (listing.description ?? '').trim().length;

    // Calculate visits_status based on dataQuality
    let visitsStatus: 'ok' | 'partial' | 'unavailable';
    const { visitsCoverage, performanceAvailable } = v1Input.dataQuality;
    
    if (!performanceAvailable || visitsCoverage.filledDays === 0) {
      visitsStatus = 'unavailable';
    } else if (visitsCoverage.filledDays < visitsCoverage.totalDays * 0.5) {
      visitsStatus = 'partial';
    } else {
      visitsStatus = 'ok';
    }

    return {
      meta: v1Input.meta,
      listing: {
        ...v1Input.listing,
        price_base: priceBase,
        price_final: priceFinal,
        has_promotion: hasPromotion,
        discount_percent: discountPercent,
        description_length: descriptionLength,
      },
      media: v1Input.media,
      performance: v1Input.performance,
      dataQuality: {
        ...v1Input.dataQuality,
        visits_status: visitsStatus,
      },
    };
  }

  /**
   * Analyze a listing using GPT-4o Expert Prompt (ml-expert-v1)
   * 
   * Uses SYSTEM_PROMPT_EXPERT for direct, actionable, execution-oriented analysis.
   * Returns AIAnalysisResultExpert with Zod validation and fallback.
   * 
   * This is the PRODUCTION prompt - no fallback to V1.
   */
  async analyzeListingV21(
    input: AIAnalyzeInputV21,
    scoreResult: IAScoreResult
  ): Promise<AIAnalysisResultExpert> {
    // Calculate total potential gain (100 - final score)
    const totalPotentialGain = 100 - scoreResult.score.final;

    if (!this.isReady || !this.client) {
      // Return fallback when OpenAI is not available
      return createFallbackAnalysisExpert(
        'OpenAI API key not configured',
        {
          title: input.listing.title,
          price_base: input.listing.price_base,
          price_final: input.listing.price_final,
          has_promotion: input.listing.has_promotion,
          discount_percent: input.listing.discount_percent,
          pictures_count: input.media.imageCount,
          description_length: input.listing.description_length,
        }
      );
    }

    const startTime = Date.now();
    const requestId = input.meta.requestId || 'unknown';

    // Build user prompt with Expert template
    const userPrompt = `Analise o anúncio do Mercado Livre com base nos dados fornecidos.

REGRAS OBRIGATÓRIAS (HARD CONSTRAINTS):
- Considere sempre o PREÇO FINAL (price_final), não apenas o preço base.
- Se houver promoção ativa, NÃO sugira criar promoção. Mencione a promoção existente e valores corretos.
- Seja específico para Mercado Livre.
- Sempre entregue ações aplicáveis imediatamente.
- description_fix.optimized_copy DEVE ter >= 600 caracteres com estrutura completa (Destaques, Especificações, O que você recebe, Cuidados, Dica, CTA).
- title_fix.after DEVE ter >= 45 caracteres, começar com keyword principal e incluir 2-4 atributos.
- final_action_plan DEVE ter mínimo 5 ações ordenadas por impacto.
- image_plan DEVE ter min(4, pictures_count) itens quando pictures_count >= 4.
- Se hasClips é null, diga "Não foi possível confirmar via API" (não afirme que não tem).

Siga OBRIGATORIAMENTE o formato de resposta definido.
Não adicione seções extras.

DADOS DO ANÚNCIO:
${JSON.stringify(input, null, 2)}

MÉTRICAS DE ${input.meta.periodDays} DIAS:
- Visitas: ${input.dataQuality.visits_status === 'unavailable' ? 'INDISPONÍVEL' : scoreResult.metrics_30d.visits}
- Pedidos: ${scoreResult.metrics_30d.orders}
- Conversão: ${scoreResult.metrics_30d.conversionRate ? (scoreResult.metrics_30d.conversionRate * 100).toFixed(2) + '%' : 'N/A'}
${scoreResult.metrics_30d.ctr !== null ? `- CTR: ${(scoreResult.metrics_30d.ctr * 100).toFixed(2)}%` : ''}
${scoreResult.metrics_30d.revenue !== null ? `- Receita: R$ ${scoreResult.metrics_30d.revenue.toFixed(2)}` : ''}

PREÇO:
- Preço Base: R$ ${input.listing.price_base.toFixed(2)}
- Preço Final: R$ ${input.listing.price_final.toFixed(2)}
- Promoção Ativa: ${input.listing.has_promotion ? 'SIM' : 'NÃO'}
${input.listing.discount_percent ? `- Desconto: ${input.listing.discount_percent}%` : ''}

MÍDIA:
- Fotos: ${input.media.imageCount}
- Vídeo/Clips: ${input.media.hasClips === true ? 'SIM' : input.media.hasClips === false ? 'NÃO' : 'Não detectável'}

QUALIDADE DOS DADOS:
- Status de Visitas: ${input.dataQuality.visits_status}
- Performance Disponível: ${input.dataQuality.performanceAvailable ? 'SIM' : 'NÃO'}
${input.dataQuality.warnings.length > 0 ? `- Avisos: ${input.dataQuality.warnings.join('; ')}` : ''}

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO - SEM TEXTO EXTRA):
{
  "verdict": "Frase curta, direta e incômoda sobre o anúncio",
  "title_fix": {
    "problem": "Onde o título atual falha para o algoritmo do Mercado Livre",
    "impact": "Qual sinal algorítmico está sendo perdido",
    "before": "Título atual exatamente como está no anúncio",
    "after": "Título otimizado pronto para copiar e colar"
  },
  "image_plan": [
    { "image": 1, "action": "O que essa imagem deve mostrar para converter melhor" },
    { "image": 2, "action": "O que essa imagem deve mostrar" },
    { "image": 3, "action": "O que essa imagem deve mostrar" }
  ],
  "description_fix": {
    "diagnostic": "Problema real da descrição atual",
    "optimized_copy": "Descrição completa pronta para colar no Mercado Livre"
  },
  "price_fix": {
    "diagnostic": "Avaliação do preço considerando preço final e promoções",
    "action": "O que fazer com preço/promoção"
  },
  "algorithm_hacks": [
    {
      "hack": "Nome curto do hack",
      "how_to_apply": "Como executar no Mercado Livre",
      "signal_impacted": "Sinal algorítmico impactado"
    }
  ],
  "final_action_plan": [
    "Ação concreta 1",
    "Ação concreta 2",
    "Ação concreta 3"
  ]
}

IMPORTANTE:
- Retorne APENAS o JSON acima, sem markdown, sem texto antes ou depois
- NÃO use \`\`\`json ou qualquer formatação markdown
- NÃO adicione explicações ou comentários
- O JSON deve começar com { e terminar com }
- Todos os campos são OBRIGATÓRIOS`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_EXPERT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4, // Reduzido para maior consistência e menos criatividade genérica
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error('[OPENAI-SERVICE-EXPERT] No content in response', {
          requestId,
          listingId: input.meta.listingId,
          model: response.model,
          usage: response.usage,
        });
        throw new Error('No response from OpenAI');
      }

      const processingTimeMs = Date.now() - startTime;

      // Log raw response (com redaction de dados sensíveis)
      const contentPreview = content.length > 1000 
        ? content.substring(0, 1000) + '... [truncated]'
        : content;
      console.log('[OPENAI-SERVICE-EXPERT] Raw response received', {
        requestId,
        listingId: input.meta.listingId,
        promptVersion: 'ml-expert-v1',
        model: response.model,
        contentLength: content.length,
        contentPreview: contentPreview.replace(/token|api[_-]?key|secret|password/gi, '[REDACTED]'),
        usage: response.usage,
      });

      // Parser robusto: extrair JSON mesmo se vier com markdown ou texto extra
      let rawResponse: unknown;
      try {
        // Tentar parse direto primeiro
        rawResponse = JSON.parse(content);
      } catch (parseError) {
        // Se falhar, tentar extrair JSON de markdown ou texto
        console.warn('[OPENAI-SERVICE-EXPERT] Direct JSON parse failed, attempting extraction', {
          requestId,
          listingId: input.meta.listingId,
          error: parseError instanceof Error ? parseError.message : 'Unknown',
        });

        // Extrair primeiro bloco JSON balanceado
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            rawResponse = JSON.parse(jsonMatch[0]);
            console.log('[OPENAI-SERVICE-EXPERT] Successfully extracted JSON from text', {
              requestId,
              listingId: input.meta.listingId,
            });
          } catch (extractError) {
            console.error('[OPENAI-SERVICE-EXPERT] Failed to parse extracted JSON', {
              requestId,
              listingId: input.meta.listingId,
              extractedLength: jsonMatch[0].length,
              error: extractError instanceof Error ? extractError.message : 'Unknown',
            });
            throw new Error(`Invalid JSON response from OpenAI: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
          }
        } else {
          console.error('[OPENAI-SERVICE-EXPERT] No JSON block found in response', {
            requestId,
            listingId: input.meta.listingId,
            contentPreview: content.substring(0, 200),
          });
          throw new Error('No valid JSON found in OpenAI response');
        }
      }

      // Validate with Zod
      const parseResult = parseAIResponseExpert(
        rawResponse,
        {
          title: input.listing.title,
          price_base: input.listing.price_base,
          price_final: input.listing.price_final,
          has_promotion: input.listing.has_promotion,
          discount_percent: input.listing.discount_percent,
          pictures_count: input.media.imageCount,
          description_length: input.listing.description_length,
        }
      );

      // Validar qualidade do conteúdo (hard constraints)
      let qualityIssues: string[] = [];
      if (parseResult.success) {
        const data = parseResult.data;
        
        // Validar description_fix.optimized_copy
        if (data.description_fix?.optimized_copy) {
          const descLength = data.description_fix.optimized_copy.length;
          if (descLength < 600) {
            qualityIssues.push(`description_fix.optimized_copy muito curto (${descLength} chars, mínimo 600)`);
          }
        }
        
        // Validar title_fix.after
        if (data.title_fix?.after) {
          const titleLength = data.title_fix.after.length;
          if (titleLength < 45) {
            qualityIssues.push(`title_fix.after muito curto (${titleLength} chars, mínimo 45)`);
          }
          // Verificar se contém keyword principal (primeiras 2 palavras do título original)
          const titleWords = input.listing.title.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
          if (!data.title_fix.after.toLowerCase().includes(titleWords.toLowerCase())) {
            qualityIssues.push(`title_fix.after não contém keyword principal do título original`);
          }
        }
        
        // Validar final_action_plan
        if (data.final_action_plan && data.final_action_plan.length < 5) {
          qualityIssues.push(`final_action_plan tem apenas ${data.final_action_plan.length} ações (mínimo 5)`);
        }
        
        // Validar image_plan
        if (data.image_plan && input.media.imageCount >= 4) {
          const expectedCount = Math.min(4, input.media.imageCount);
          if (data.image_plan.length < expectedCount) {
            qualityIssues.push(`image_plan tem apenas ${data.image_plan.length} itens (esperado ${expectedCount} para ${input.media.imageCount} imagens)`);
          }
        }
      }

      if (!parseResult.success || qualityIssues.length > 0) {
        // Retry automático: tentar novamente com prompt reforçado
        const validationErrors = !parseResult.success 
          ? parseResult.error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            }))
          : [];
        
        // Log detalhado do erro de validação
        if (!parseResult.success) {
          console.error('[OPENAI-SERVICE-EXPERT] Zod validation failed', {
            requestId,
            listingId: input.meta.listingId,
            errors: validationErrors,
            rawResponseKeys: Object.keys(rawResponse as Record<string, unknown> || {}),
            rawResponsePreview: JSON.stringify(rawResponse).substring(0, 500),
          });
        }
        
        if (qualityIssues.length > 0) {
          console.warn('[OPENAI-SERVICE-EXPERT] Quality issues detected', {
            requestId,
            listingId: input.meta.listingId,
            issues: qualityIssues,
          });
        }
        
        const retryReason = !parseResult.success 
          ? `ERRO DE VALIDAÇÃO:\n${validationErrors.map(e => `- ${e.path}: ${e.message}`).join('\n')}`
          : `PROBLEMAS DE QUALIDADE:\n${qualityIssues.map(q => `- ${q}`).join('\n')}`;
        
        console.log('[OPENAI-SERVICE-EXPERT] Attempting retry with reinforced prompt', {
          requestId,
          listingId: input.meta.listingId,
          reason: !parseResult.success ? 'validation_error' : 'quality_issues',
          issues: !parseResult.success ? validationErrors : qualityIssues,
        });

        try {
          const retryPrompt = `Sua resposta anterior veio ${!parseResult.success ? 'fora do formato esperado' : 'rasa/insuficiente'}.

${retryReason}

Você DEVE retornar APENAS JSON válido no formato abaixo, sem markdown, sem texto extra.

REGRAS OBRIGATÓRIAS DE QUALIDADE:
- description_fix.optimized_copy: >= 600 caracteres com estrutura completa (Destaques, Especificações, O que você recebe, Cuidados, Dica, CTA)
- title_fix.after: >= 45 caracteres, começar com keyword principal e incluir 2-4 atributos
- final_action_plan: mínimo 5 ações ordenadas por impacto
- image_plan: min(4, pictures_count) itens quando pictures_count >= 4

FORMATO:

{
  "verdict": "Frase curta, direta e incômoda sobre o anúncio",
  "title_fix": {
    "problem": "Onde o título atual falha para o algoritmo do Mercado Livre",
    "impact": "Qual sinal algorítmico está sendo perdido",
    "before": "Título atual exatamente como está no anúncio",
    "after": "Título otimizado pronto para copiar e colar"
  },
  "image_plan": [
    { "image": 1, "action": "O que essa imagem deve mostrar para converter melhor" },
    { "image": 2, "action": "O que essa imagem deve mostrar" },
    { "image": 3, "action": "O que essa imagem deve mostrar" }
  ],
  "description_fix": {
    "diagnostic": "Problema real da descrição atual",
    "optimized_copy": "Descrição completa pronta para colar no Mercado Livre"
  },
  "price_fix": {
    "diagnostic": "Avaliação do preço considerando preço final e promoções",
    "action": "O que fazer com preço/promoção"
  },
  "algorithm_hacks": [
    {
      "hack": "Nome curto do hack",
      "how_to_apply": "Como executar no Mercado Livre",
      "signal_impacted": "Sinal algorítmico impactado"
    }
  ],
  "final_action_plan": [
    "Ação concreta 1",
    "Ação concreta 2",
    "Ação concreta 3"
  ]
}

Retorne SOMENTE este JSON, sem nada antes ou depois.`;

          const retryResponse = await this.client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT_EXPERT },
              { role: 'user', content: userPrompt },
              { role: 'assistant', content: content }, // Contexto da resposta anterior
              { role: 'user', content: retryPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3, // Temperatura mais baixa no retry
            max_tokens: 4000,
          });

          const retryContent = retryResponse.choices[0]?.message?.content;
          if (!retryContent) {
            throw new Error('No response from OpenAI retry');
          }

          // Parser robusto para retry também
          let retryRawResponse: unknown;
          try {
            retryRawResponse = JSON.parse(retryContent);
          } catch {
            const retryJsonMatch = retryContent.match(/\{[\s\S]*\}/);
            if (retryJsonMatch) {
              retryRawResponse = JSON.parse(retryJsonMatch[0]);
            } else {
              throw new Error('No valid JSON in retry response');
            }
          }

          const retryParseResult = parseAIResponseExpert(
            retryRawResponse,
            {
              title: input.listing.title,
              price_base: input.listing.price_base,
              price_final: input.listing.price_final,
              has_promotion: input.listing.has_promotion,
              discount_percent: input.listing.discount_percent,
              pictures_count: input.media.imageCount,
              description_length: input.listing.description_length,
            }
          );

          // Validar qualidade do retry também
          let retryQualityIssues: string[] = [];
          if (retryParseResult.success) {
            const retryData = retryParseResult.data;
            
            if (retryData.description_fix?.optimized_copy && retryData.description_fix.optimized_copy.length < 600) {
              retryQualityIssues.push(`description_fix.optimized_copy ainda muito curto (${retryData.description_fix.optimized_copy.length} chars)`);
            }
            if (retryData.title_fix?.after && retryData.title_fix.after.length < 45) {
              retryQualityIssues.push(`title_fix.after ainda muito curto (${retryData.title_fix.after.length} chars)`);
            }
            if (retryData.final_action_plan && retryData.final_action_plan.length < 5) {
              retryQualityIssues.push(`final_action_plan ainda tem apenas ${retryData.final_action_plan.length} ações`);
            }
          }

          if (retryParseResult.success && retryQualityIssues.length === 0) {
            console.log('[OPENAI-SERVICE-EXPERT] Retry successful', {
              requestId,
              listingId: input.meta.listingId,
            });
            const result = retryParseResult.data;
            if (!result.meta.processing_time_ms) {
              result.meta.processing_time_ms = Date.now() - startTime;
            }
            return result;
          } else if (retryParseResult.success && retryQualityIssues.length > 0) {
            // Se retry ainda tem problemas de qualidade, logar mas aceitar (melhor que nada)
            console.warn('[OPENAI-SERVICE-EXPERT] Retry ainda tem problemas de qualidade, mas aceitando', {
              requestId,
              listingId: input.meta.listingId,
              issues: retryQualityIssues,
            });
            const result = retryParseResult.data;
            if (!result.meta.processing_time_ms) {
              result.meta.processing_time_ms = Date.now() - startTime;
            }
            return result;
          } else {
            const retryErrors = !retryParseResult.success
              ? retryParseResult.error.errors.map((e) => ({
                  path: e.path.map(String).join('.'),
                  message: e.message,
                }))
              : [];
            console.error('[OPENAI-SERVICE-EXPERT] Retry also failed validation', {
              requestId,
              listingId: input.meta.listingId,
              retryErrors,
            });
            // Lançar erro para ser tratado no catch
            const errorFields = !retryParseResult.success
              ? retryParseResult.error.errors.map((e) => e.path.map(String).join('.')).join(', ')
              : 'Unknown';
            throw new Error(`AI_OUTPUT_INVALID: Validation failed after retry. Missing fields: ${errorFields}`);
          }
        } catch (retryError) {
          console.error('[OPENAI-SERVICE-EXPERT] Retry failed', {
            requestId,
            listingId: input.meta.listingId,
            error: retryError instanceof Error ? retryError.message : 'Unknown',
          });
          // Lançar erro para ser tratado no catch
          throw new Error(`AI_OUTPUT_INVALID: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
        }
      }

      // Inject processing time if not present
      const result = parseResult.data;
      if (!result.meta.processing_time_ms) {
        result.meta.processing_time_ms = processingTimeMs;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OPENAI-SERVICE-EXPERT] Error analyzing listing', {
        requestId,
        listingId: input.meta.listingId,
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      
      // Se for erro de validação (AI_OUTPUT_INVALID), lançar para ser tratado na rota
      if (errorMessage.includes('AI_OUTPUT_INVALID')) {
        throw error; // Re-throw para ser tratado na rota com HTTP 502
      }
      
      // Para outros erros, também lançar para tratamento na rota
      throw error; // Re-throw todos os erros para tratamento na rota
    }
  }

  /**
   * Analyze a listing using GPT-4o and return actionable insights
   * 
   * Now accepts AIAnalyzeInputV1 (canonical payload) and IA Score as input.
   * The AI does NOT calculate the score - it only explains gaps and suggests actions.
   */
  async analyzeListing(input: AIAnalyzeInputV1, scoreResult: IAScoreResult): Promise<AIAnalysisResult> {
    if (!this.isReady || !this.client) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Build user prompt with JSON payload, score, and context
    const userPrompt = `Analise este anúncio do Mercado Livre usando os dados JSON fornecidos:

${JSON.stringify(input, null, 2)}

SCORE CALCULADO (baseado em dados reais):
- Score Final: ${scoreResult.score.final}/100
- Breakdown:
  * Cadastro: ${scoreResult.score.breakdown.cadastro}/20
  * Mídia: ${scoreResult.score.breakdown.midia}/20
  * Performance: ${scoreResult.score.breakdown.performance}/30
  * SEO: ${scoreResult.score.breakdown.seo}/20
  * Competitividade: ${scoreResult.score.breakdown.competitividade}/10
- Potencial de Ganho: ${JSON.stringify(scoreResult.score.potential_gain, null, 2)}

MÉTRICAS DE 30 DIAS:
- Visitas: ${scoreResult.metrics_30d.visits}
- Pedidos: ${scoreResult.metrics_30d.orders}
- Taxa de Conversão: ${scoreResult.metrics_30d.conversionRate ? (scoreResult.metrics_30d.conversionRate * 100).toFixed(2) + '%' : 'N/A'}
${scoreResult.metrics_30d.ctr !== null ? `- CTR: ${(scoreResult.metrics_30d.ctr * 100).toFixed(2)}%` : ''}
${scoreResult.metrics_30d.revenue !== null ? `- Receita: R$ ${scoreResult.metrics_30d.revenue.toFixed(2)}` : ''}

CONTEXTO PARA ANÁLISE:
- Categoria: ${input.listing.category || 'Não especificada'} - considere a intenção de compra típica desta categoria
- Período analisado: ${input.meta.periodDays} dias
- Fonte de performance: ${input.dataQuality.sources.performance} ${input.dataQuality.sources.performance === 'listing_aggregates' ? '(dados agregados, podem ser incompletos)' : '(métricas diárias confiáveis)'}
- Qualidade dos dados: ${input.dataQuality.completenessScore}/100
- Cobertura de visitas: ${input.dataQuality.visitsCoverage.filledDays}/${input.dataQuality.visitsCoverage.totalDays} dias com dados
- Performance disponível: ${input.dataQuality.performanceAvailable ? 'SIM' : 'NÃO (dados indisponíveis via API - NÃO chamar de gargalo)'}
${input.dataQuality.missing.length > 0 ? `- Campos ausentes: ${input.dataQuality.missing.join(', ')}` : ''}
${input.dataQuality.warnings.length > 0 ? `- Avisos: ${input.dataQuality.warnings.join('; ')}` : ''}

DADOS DE PERFORMANCE:
${!input.dataQuality.performanceAvailable ? `⚠️ ATENÇÃO: Performance INDISPONÍVEL (visitsCoverage.filledDays=0). NÃO chamar de gargalo, NÃO afirmar tráfego baixo/conversão baixa. Usar linguagem condicional.` : ''}
- Visitas: ${!input.dataQuality.performanceAvailable ? 'INDISPONÍVEL VIA API (não concluir "zero visitas")' : `${input.performance.visits} (últimos ${input.performance.periodDays} dias)`}
- Pedidos: ${input.performance.orders} ${input.dataQuality.sources.performance === 'listing_metrics_daily' ? '(fonte: Orders API do período)' : ''}
- Taxa de conversão: ${input.performance.conversionRate ? (input.performance.conversionRate * 100).toFixed(2) + '%' : 'N/A (visitas não disponíveis)'}
${input.performance.ctr !== undefined && input.performance.ctr !== null ? `- CTR: ${(input.performance.ctr * 100).toFixed(2)}%` : ''}
${input.performance.revenue !== null ? `- Receita: R$ ${input.performance.revenue.toFixed(2)}` : ''}

MÍDIA:
- Fotos: ${input.media.imageCount} ${input.media.hasImages ? '(presente)' : '(AUSENTE - mencionar na análise)'}
- Vídeo do anúncio: ${input.media.hasVideo === true ? 'Sim' : input.media.hasVideo === false ? 'Não (oportunidade de melhoria)' : 'Não detectável via API'}
- Clips: ${input.media.hasClips === true ? 'Sim' : input.media.hasClips === false ? 'Não' : 'Não detectável via API (valide no painel do Mercado Livre)'}

INSTRUÇÕES ESPECÍFICAS:
1. O SCORE JÁ FOI CALCULADO - você NÃO deve calcular um novo score
2. Seu papel é EXPLICAR os gaps identificados no score e SUGERIR ações para melhorar
3. Priorize as dimensões com MENOR score no breakdown
4. Foque em impacto mensurável: cada hack deve indicar quantos pontos pode ganhar
5. Se media.imageCount > 0, NÃO diga que faltam fotos
6. Se listing.description não estiver vazio, NÃO diga que falta descrição
7. Analise a performance real: se conversão alta mas tráfego baixo → foco em tráfego; se tráfego alto mas conversão baixa → foco em otimização
8. Considere o preço (R$ ${input.listing.price.toFixed(2)}) em relação à categoria e performance
9. Use o potencial de ganho fornecido para priorizar hacks
10. Se performanceAvailable=false: NÃO chamar Performance de gargalo, NÃO afirmar tráfego/conversão baixa. Usar linguagem condicional ("Se você quiser aumentar tráfego...")

IMPORTANTE:
- O score retornado deve ser o MESMO do score calculado (${scoreResult.score.final})
- Não invente um novo score
- Foque em explicar POR QUE o score não é 100 e COMO melhorar

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
    
    // Garantir que o score retornado pela IA seja o mesmo do calculado
    // (a IA não deve calcular um novo score, apenas explicar)
    return {
      ...analysis,
      score: scoreResult.score.final, // Usar score calculado, não o da IA (se a IA retornar diferente)
      analyzedAt: new Date().toISOString(),
      model: 'gpt-4o',
    };
  }

  /**
   * Analyze a listing and save the results as recommendations in the database
   * 
   * Uses the canonical AIAnalyzeInputV1 payload with 30-day metrics by default.
   * Now uses IA Score Model V1 as input for the AI.
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
    score: IAScoreResult;
  }> {
    // Build canonical input with real data
    const input = await this.buildAIAnalyzeInput(listingId, userId, requestId, periodDays);

    // Calculate IA Score first
    const scoreService = new IAScoreService(this.tenantId);
    const scoreResult = await scoreService.calculateScore(listingId, periodDays);

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

    const analysis = await this.analyzeListing(input, scoreResult);

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
      score: scoreResult,
    };
  }
}

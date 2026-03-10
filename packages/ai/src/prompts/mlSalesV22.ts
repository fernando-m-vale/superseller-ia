/**
 * Prompt V2.2 Sales - Foco em vendas e execução (sem score)
 * 
 * Versão: ml-sales-v22
 * Foco: Receita, execução imediata, plano 7 dias
 */

export const promptVersion = 'ml-sales-v22';

export const systemPrompt = `Você é um consultor sênior especialista em VENDAS no Mercado Livre.

Seu objetivo é AUMENTAR RECEITA através de ações executáveis imediatamente.

Você NÃO deve:
- explicar teoria
- suavizar problemas
- dar sugestões vagas
- usar linguagem genérica
- focar em score ou métricas abstratas

Você DEVE:
- ser direto e orientado a RECEITA
- entregar ações que geram VENDAS
- focar em EXECUÇÃO HOJE
- entregar conteúdo PROFUNDO e ESPECIALISTA

Sempre considere que o vendedor quer saber:
"O que eu faço HOJE para vender MAIS?"

Se algum dado não puder ser analisado por limitação de API ou dados ausentes, diga isso claramente.
Nunca invente informações.
Nunca assuma dados não fornecidos.

REGRAS OBRIGATÓRIAS DE QUALIDADE (HARD CONSTRAINTS):

1. description_fix.optimized_copy:
   - DEVE ser um texto completo pronto para colar no Mercado Livre
   - Tamanho mínimo: >= 900 caracteres
   - Estrutura MÍNIMA obrigatória:
     * Linha inicial SEO (1-2 linhas com keyword principal)
     * Seção "⭐ Destaques" (4-6 bullets)
     * Seção "📏 Tamanhos / Medidas" ou "📌 Especificações" (conforme categoria)
     * Seção "📦 O que você recebe"
     * Seção "🧼 Cuidados" (quando fizer sentido)
     * Seção "🚀 Dica de compra" (1 dica prática)
     * CTA final ("👉 Garanta já..." ou similar)
   - NÃO pode ser 1 parágrafo genérico

2. title_fix.after:
   - DEVE ter 55-60 caracteres
   - DEVE começar com o termo de busca principal
   - DEVE incluir 2-4 atributos relevantes
   - PROIBIDO ser genérico

3. image_plan:
   - Se pictures_count >= 6, gerar 6 ações
   - Se < 6, gerar até pictures_count
   - Cada ação deve ser executável

4. final_action_plan (vira "Plano 7 dias"):
   - DEVE ter exatamente 7 itens (D0, D1, D2, D3, D4, D5, D6)
   - Cada item deve ser: "D0: [ação específica para hoje]", "D1: [ação para amanhã]", etc.
   - Ordenadas por impacto e urgência
   - Linguagem imperativa, bem específica

5. algorithm_hacks:
   - 3-5 hacks
   - Cada um com: hack, how_to_apply, signal_impacted, effort (S/M/L), expected_impact (low/med/high)

6. Promoção:
   - Se has_promotion=true, OBRIGATÓRIO citar "promoção ativa" e usar price_base e price_final no texto
   - Se has_promotion=false, usar linguagem condicional
   - NUNCA inventar valores de promoção

7. Clip (vídeo):
   - Se hasClips for null / "não detectável", NÃO afirmar que não tem
   - DEVE dizer: "Não foi possível confirmar via API"

8. Cada seção DEVE incluir:
   - hypothesis: por que isso aumenta venda (1-2 frases)
   - how_to_execute_today: passo a passo curto (3-5 passos)

9. result_expected:
   - "o que medir" (CTR, conv, vendas)
   - "qual sinal de melhora" (ex: "CTR aumenta 15% em 7 dias")

10. Personalizacao obrigatoria:
   - Voce DEVE usar o bloco personalization do payload.
   - Analise o titulo atual considerando termos fortes, faltantes, repeticao e excesso de termos genericos.
   - title_fix.problem DEVE incluir exatamente 3 variacoes rotuladas SEO, Conversao e Oferta.
   - Essas 3 variacoes precisam parecer estrategias diferentes, nao apenas sinonimos.
   - title_fix.after deve escolher a melhor variacao para o contexto do produto.
   - description_fix.optimized_copy DEVE seguir a ordem: posicionamento, beneficios, diferenciais e informacoes praticas.
   - Evite frases genericas como "Este produto e ideal para...".
   - Produto infantil pede copy mais emocional.
   - Produto tecnico pede copy mais informativo.
   - Produto promocional pede destaque comercial sem colocar preco no titulo.

IMPORTANTE: Você DEVE retornar APENAS JSON válido, sem markdown, sem texto antes ou depois.
O JSON deve começar com { e terminar com }.
NÃO use \`\`\`json ou qualquer formatação markdown.
NÃO adicione explicações ou comentários fora do JSON.`;

export interface MLSalesV22BuildUserPromptInput {
  input: unknown; // AIAnalyzeInputV21
  scoreResult: {
    metrics_30d: {
      visits: number;
      orders: number;
      conversionRate: number | null;
      ctr: number | null;
      revenue: number | null;
    };
  };
  meta: {
    periodDays: number;
  };
}

export function buildMLSalesV22UserPrompt({ input, scoreResult, meta }: MLSalesV22BuildUserPromptInput): string {
  const inputData = input as {
    listing: {
      title: string;
      price_base: number;
      price_final: number;
      has_promotion: boolean;
      discount_percent: number | null;
      description_length: number;
    };
    media: {
      imageCount: number;
      hasClips: boolean | null;
    };
    dataQuality: {
      visits_status: string;
      performanceAvailable: boolean;
      warnings: string[];
    };
  };

  return `Analise o anúncio do Mercado Livre com FOCO EM VENDAS e RECEITA.

REGRAS OBRIGATÓRIAS (HARD CONSTRAINTS):
- Considere sempre o PREÇO FINAL (price_final), não apenas o preço base.
- Se houver promoção ativa, NÃO sugira criar promoção. Mencione a promoção existente e valores corretos.
- Seja específico para Mercado Livre.
- Sempre entregue ações aplicáveis HOJE.
- description_fix.optimized_copy DEVE ter >= 900 caracteres com estrutura completa.
- title_fix.after DEVE ter 55-60 caracteres, começar com keyword principal e incluir 2-4 atributos.
- final_action_plan DEVE ter exatamente 7 itens (D0, D1, D2, D3, D4, D5, D6).
- image_plan DEVE ter min(6, pictures_count) itens quando pictures_count >= 6.
- Se hasClips é null, diga "Não foi possível confirmar via API".
- Use personalization.currentTitleAnalysis, personalization.titleStrategies e personalization.descriptionGuidance.
- Faça os títulos parecerem realmente diferentes entre si.

Siga OBRIGATORIAMENTE o formato de resposta definido.
Não adicione seções extras.

DADOS DO ANÚNCIO:
${JSON.stringify(input, null, 2)}

MÉTRICAS DE ${meta.periodDays} DIAS:
- Visitas: ${inputData.dataQuality.visits_status === 'unavailable' ? 'INDISPONÍVEL' : scoreResult.metrics_30d.visits}
- Pedidos: ${scoreResult.metrics_30d.orders}
- Conversão: ${scoreResult.metrics_30d.conversionRate ? (scoreResult.metrics_30d.conversionRate * 100).toFixed(2) + '%' : 'N/A'}
${scoreResult.metrics_30d.ctr !== null ? `- CTR: ${(scoreResult.metrics_30d.ctr * 100).toFixed(2)}%` : ''}
${scoreResult.metrics_30d.revenue !== null ? `- Receita: R$ ${scoreResult.metrics_30d.revenue.toFixed(2)}` : ''}

PREÇO:
- Preço Base: R$ ${inputData.listing.price_base.toFixed(2)}
- Preço Final: R$ ${inputData.listing.price_final.toFixed(2)}
- Promoção Ativa: ${inputData.listing.has_promotion ? 'SIM' : 'NÃO'}
${inputData.listing.discount_percent ? `- Desconto: ${inputData.listing.discount_percent}%` : ''}

MÍDIA:
- Fotos: ${inputData.media.imageCount}
- Vídeo/Clips: ${inputData.media.hasClips === true ? 'SIM' : inputData.media.hasClips === false ? 'NÃO' : 'Não detectável'}

QUALIDADE DOS DADOS:
- Status de Visitas: ${inputData.dataQuality.visits_status}
- Performance Disponível: ${inputData.dataQuality.performanceAvailable ? 'SIM' : 'NÃO'}
${inputData.dataQuality.warnings.length > 0 ? `- Avisos: ${inputData.dataQuality.warnings.join('; ')}` : ''}

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO - SEM TEXTO EXTRA):
{
  "verdict": "Frase curta orientada a RECEITA (ex: 'alavanca principal é X, estimativa de ganho vem de Y')",
  "title_fix": {
    "problem": "Onde o título atual falha para o algoritmo do Mercado Livre, com termos fortes, faltantes, repetição/genericos e 3 variações rotuladas SEO, Conversao e Oferta",
    "impact": "Qual sinal algorítmico está sendo perdido",
    "before": "Título atual exatamente como está no anúncio",
    "after": "Título otimizado pronto para copiar e colar (55-60 chars)",
    "hypothesis": "Por que isso aumenta venda (1-2 frases)",
    "how_to_execute_today": ["Passo 1", "Passo 2", "Passo 3"]
  },
  "image_plan": [
    { "image": 1, "action": "O que essa imagem deve mostrar para converter melhor" }
  ],
  "description_fix": {
    "diagnostic": "Problema real da descrição atual",
    "optimized_copy": "Descrição completa pronta para colar (>=900 chars, com posicionamento, benefícios, diferenciais e informações práticas)",
    "hypothesis": "Por que isso aumenta venda",
    "how_to_execute_today": ["Passo 1", "Passo 2", "Passo 3"]
  },
  "price_fix": {
    "diagnostic": "Avaliação do preço considerando preço final e promoções",
    "action": "O que fazer com preço/promoção",
    "hypothesis": "Por que isso aumenta venda",
    "how_to_execute_today": ["Passo 1", "Passo 2", "Passo 3"]
  },
  "algorithm_hacks": [
    {
      "hack": "Nome curto do hack",
      "how_to_apply": "Como executar no Mercado Livre",
      "signal_impacted": "Sinal algorítmico impactado",
      "effort": "S" | "M" | "L",
      "expected_impact": "low" | "med" | "high"
    }
  ],
  "final_action_plan": [
    "D0: Ação para HOJE (imperativa, específica)",
    "D1: Ação para amanhã",
    "D2: Ação para depois de amanhã",
    "D3: Ação para dia 3",
    "D4: Ação para dia 4",
    "D5: Ação para dia 5",
    "D6: Ação para dia 6"
  ],
  "result_expected": {
    "what_to_measure": "O que medir (CTR, conv, vendas)",
    "improvement_signal": "Qual sinal de melhora (ex: 'CTR aumenta 15% em 7 dias')"
  }
}

IMPORTANTE:
- Retorne APENAS o JSON acima, sem markdown, sem texto antes ou depois
- NÃO use \`\`\`json ou qualquer formatação markdown
- NÃO adicione explicações ou comentários
- O JSON deve começar com { e terminar com }
- Todos os campos são OBRIGATÓRIOS`;
}

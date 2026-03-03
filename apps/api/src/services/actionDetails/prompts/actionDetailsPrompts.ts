import { BuildActionDetailsPromptInput } from '../../ActionDetailsPrompt';
import { ActionType, mapActionKeyToActionType } from '../actionTypeMapping';

export const ACTION_DETAILS_V2_PROMPT_VERSION = 'action-details-v2';

/**
 * Prompt base V2 (regras anti-template, coerência, citar fatos)
 */
const BASE_PROMPT_V2 = `Você é um especialista de growth para e-commerce no Mercado Livre Brasil.

OBJETIVO: Gerar um plano detalhado e acionável para executar uma ação específica em um anúncio.

REGRAS OBRIGATÓRIAS:
1) Responda APENAS JSON válido (sem markdown, sem comentários, sem código).
2) Use EXATAMENTE o formato ActionDetailsV2 abaixo.
3) NUNCA use templates genéricos. Sempre personalize baseado nos dados reais do anúncio.
4) SEMPRE cite pelo menos 2 fatos específicos do contexto (ex: "Seu anúncio tem ${'${visits}'} visitas e ${'${orders}'} pedidos", "Preço atual R$ ${'${price}'}", "Categoria: ${'${category}'}").
5) Se houver promoção (hasPromotion=true), SEMPRE mencione e considere no contexto. Se não houver, não invente.
6) Para benchmark: se available=false, explique como estimar via heurísticas (top sellers da categoria, faixa de preço, quantidade de fotos, presença de vídeo). NUNCA invente dados de benchmark.
7) Nunca invente atributos do produto. Se faltar informação crítica, inclua em "requiredInputs" com "howToConfirm" explicando como o usuário pode confirmar.
8) Idioma: Português do Brasil.
9) Seja específico e acionável. Evite frases genéricas como "melhore o título" → use "Inclua palavras-chave X e Y nas primeiras 40 letras".

FORMATO ActionDetailsV2:
{
  "version": "action_details_v2",
  "whyThisMatters": "string (explicação curta e específica)",
  "howToSteps": ["string"] (3-10 passos práticos),
  "doThisNow": ["string"] (3-8 itens de checklist),
  "artifacts": {
    "copy": { ... },
    "media": { ... },
    "pricing": { ... },
    "variations": [ ... ],
    "kits": [ ... ],
    "techSpecs": [ ... ],
    "trustGuarantees": [ ... ]
  },
  "benchmark": {
    "available": boolean,
    "notes": "string (quando available=false)",
    "data": { ... } (quando available=true)
  },
  "impact": "low" | "medium" | "high",
  "effort": "low" | "medium" | "high",
  "priority": "critical" | "high" | "medium" | "low",
  "confidence": "high" | "medium" | "low",
  "requiredInputs": [
    {
      "field": "string",
      "howToConfirm": "string"
    }
  ]
}`;

/**
 * Snippets de prompt por ActionType
 */
const ACTION_TYPE_PROMPT_SNIPPETS: Record<ActionType, string> = {
  SEO_TITLE_REWRITE: `
AÇÃO: Reescrever título do anúncio para SEO e conversão.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.copy.titleSuggestions: array com 3-5 títulos prontos para copiar (máximo 60 caracteres cada)
- artifacts.copy.keywordSuggestions: array com 3+ palavras-chave principais para incluir

DIRETRIZES:
- Títulos devem incluir: produto principal, marca/modelo (se relevante), principal diferencial
- Primeiras 40 letras são críticas (aparecem em busca)
- Use variações: uma focada em SEO (palavras-chave), outra em conversão (benefício), outra em promoção (se houver)
- Cada título deve ter "rationale" explicando por que funciona
- Keywords devem ser específicas da categoria e do produto (não genéricas)
`,

  DESCRIPTION_REWRITE_BLOCKS: `
AÇÃO: Reescrever descrição em blocos escaneáveis e otimizados.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.copy.descriptionTemplate: objeto com headline, blocks (mínimo 2), bullets (mínimo 3), cta opcional
- artifacts.copy.bulletSuggestions: array com 3+ bullets prontos para copiar
- artifacts.copy.keywordSuggestions: array com 3+ palavras-chave para incluir na descrição

DIRETRIZES:
- Headline: gancho emocional ou benefício principal (1 linha)
- Blocks: parágrafos curtos (2-3 linhas cada) cobrindo: benefícios, especificações, uso/ocasião, garantia/confiança
- Bullets: lista de vantagens/diferenciais (máximo 1 linha cada)
- CTA: chamada para ação clara (opcional)
- Keywords devem aparecer naturalmente no texto (não stuffing)
`,

  MEDIA_GALLERY_PLAN: `
AÇÃO: Planejar galeria de imagens com 8+ fotos contextualizadas.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.media.galleryPlan: array com 6-12 slots, cada um com:
  - slotNumber: posição (1-12)
  - objective: objetivo da foto ("mostrar uso real", "close técnico", "comparação", etc)
  - whatToShow: descrição específica do que mostrar
  - overlaySuggestion: texto de overlay se aplicável (opcional)

DIRETRIZES:
- Slot 1: sempre foto principal (produto isolado, fundo neutro)
- Slots 2-4: uso real, aplicação prática
- Slots 5-7: detalhes técnicos, close-ups
- Slots 8+: diferenciais, comparação, prova social
- Cada slot deve ter objetivo claro e específico
- Overlay apenas quando realmente agregar (ex: "Frete Grátis", "Garantia 1 ano")
`,

  MEDIA_ADD_VIDEO_CLIP: `
AÇÃO: Criar roteiro para vídeo/clip do anúncio.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.media.videoScript: objeto com hook (primeiros 3-5 segundos) e scenes (mínimo 2 cenas)

DIRETRIZES:
- Hook: deve capturar atenção imediata (problema, benefício, curiosidade)
- Scenes: cada cena deve ter order, description clara, durationSeconds opcional
- Cenas típicas: problema/resolução, demonstração de uso, benefícios principais, prova social, CTA
- Duração total sugerida: 15-30 segundos (máximo 60s)
- Foco em mostrar o produto em ação, não apenas estático
`,

  TECH_SPECS_FILL_ATTRIBUTES: `
AÇÃO: Preencher atributos técnicos faltantes do anúncio.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.techSpecs: array com atributos a preencher, cada um com:
  - attributeName: nome do atributo ("Cor", "Tamanho", "Material", etc)
  - suggestedValue: valor sugerido baseado no contexto
  - howToConfirm: como o usuário confirma este valor (ex: "Verificar etiqueta do produto", "Consultar catálogo do fabricante")

DIRETRIZES:
- NUNCA invente valores. Se não houver certeza, use "howToConfirm" para guiar o usuário
- Sugestões devem ser baseadas em: categoria, título atual, descrição existente, benchmark da categoria
- Priorize atributos que impactam busca e filtros do ML
`,

  VARIATIONS_ADD: `
AÇÃO: Adicionar variações ao anúncio (cor, tamanho, etc).

ARTIFACTS OBRIGATÓRIOS:
- artifacts.variations: array com variações sugeridas, cada uma com:
  - attributeName: nome do atributo ("Cor", "Tamanho", etc)
  - values: array com valores possíveis (mínimo 2)
  - rationale: por que adicionar esta variação

DIRETRIZES:
- Baseie-se em: categoria (quais variações são comuns), título/descrição (menciona variações?), benchmark (top sellers têm variações?)
- Valores devem ser específicos e acionáveis (ex: ["Preto", "Branco", "Cinza"] não ["Várias cores"])
- Rationale deve explicar impacto esperado (ex: "Aumenta alcance em busca por cor específica")
`,

  KITS_CREATE_COMBO: `
AÇÃO: Criar kit/combo com múltiplos produtos.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.kits: array com combos sugeridos, cada um com:
  - comboTitle: nome do combo ("Kit Completo", "Kit Iniciante", etc)
  - items: array com itens do combo (mínimo 2)
  - suggestedPrice: preço sugerido (opcional)
  - rationale: por que este combo funciona

DIRETRIZES:
- Combos devem fazer sentido comercial (itens complementares, não aleatórios)
- Preço sugerido deve ser atrativo (ex: 10-15% desconto vs soma individual)
- Rationale deve explicar valor percebido pelo comprador
- Máximo 3 combos por ação
`,

  PRICE_PSYCHOLOGICAL: `
AÇÃO: Ajustar preço usando psicologia de preços.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.pricing.suggestions: array com 1-3 sugestões de preço, cada uma com:
  - suggestedPrice: valor sugerido (número positivo)
  - rationale: explicação detalhada (por que este preço funciona)
  - expectedImpact: impacto esperado (opcional, ex: "+15% conversão")

DIRETRIZES:
- Considere: preço atual, benchmark da categoria, promoção ativa, posicionamento
- Técnicas: preço psicológico (R$ 99,90 vs R$ 100), arredondamento, múltiplos de 5
- Rationale deve citar dados específicos (ex: "Benchmark mostra média R$ 95, seu preço R$ 100 está 5% acima")
- Se houver promoção ativa, considere no cálculo
`,

  CATEGORY_VERIFY_BREADCRUMB: `
AÇÃO: Verificar e ajustar categoria/breadcrumb do anúncio.

ARTIFACTS OBRIGATÓRIOS:
- Nenhum artifact específico, mas "howToSteps" deve incluir verificação de categoria

DIRETRIZES:
- Verificar se categoria atual está correta (comparar com título, descrição, atributos)
- Se categoria incorreta: explicar impacto negativo e como corrigir
- Breadcrumb deve ser completo e específico (ex: "Eletrônicos > Celulares > Acessórios > Capas")
- Incluir em "requiredInputs" se precisar confirmar categoria manualmente
`,

  TRUST_GUARANTEES_HIGHLIGHT: `
AÇÃO: Destacar garantias, políticas e elementos de confiança.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.trustGuarantees: array com garantias a destacar, cada uma com:
  - type: tipo ("warranty", "return_policy", "shipping", "quality_seal", "social_proof")
  - text: texto pronto para usar
  - placement: onde destacar ("title", "description", "bullets", "badge")

DIRETRIZES:
- Textos devem ser específicos e acionáveis (ex: "Garantia de 1 ano do fabricante" não "Garantia disponível")
- Placement deve ser estratégico (garantia longa → description, badge curto → title)
- Máximo 3-4 garantias por ação (não poluir)
`,

  SEO_KEYWORDS_ENRICH: `
AÇÃO: Enriquecer anúncio com palavras-chave estratégicas.

ARTIFACTS OBRIGATÓRIOS:
- artifacts.copy.keywordSuggestions: array com 3+ palavras-chave, cada uma com:
  - keyword: palavra-chave
  - placement: onde usar ("title", "description", "bullets")
  - rationale: por que esta palavra-chave é importante

DIRETRIZES:
- Keywords devem ser específicas da categoria e do produto
- Evite palavras genéricas ("produto", "item")
- Placement deve ser estratégico (keywords principais → title, secundárias → description/bullets)
- Rationale deve explicar intenção de busca (ex: "Busca transacional alta volume")
`,

  UNKNOWN: `
AÇÃO: Ação genérica (não mapeada especificamente).

DIRETRIZES:
- Gerar "whyThisMatters", "howToSteps" e "doThisNow" genéricos mas específicos ao contexto
- Não gerar artifacts específicos (deixar opcional)
- Focar em instruções práticas e acionáveis
`,
};

/**
 * Constrói prompt V2 completo (base + snippet do ActionType)
 */
export function buildActionDetailsV2Prompt(
  input: BuildActionDetailsPromptInput,
  actionKey: string,
): string {
  const actionType = mapActionKeyToActionType(actionKey);
  const snippet = ACTION_TYPE_PROMPT_SNIPPETS[actionType] || ACTION_TYPE_PROMPT_SNIPPETS.UNKNOWN;

  return `${BASE_PROMPT_V2}

${snippet}

INPUT JSON (contexto do anúncio e ação):
${JSON.stringify(input, null, 2)}

IMPORTANTE:
- Gere artifacts obrigatórios para este tipo de ação (${actionType})
- Se faltar informação crítica, inclua em "requiredInputs" com "howToConfirm"
- Seja específico e cite fatos reais do contexto
- NUNCA use templates genéricos`;
}

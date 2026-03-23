import type { AIAnalyzeInputV21 } from '../types/ai-analyze-input';
import type { AIAnalysisResultExpert } from '../types/ai-analysis-expert';
import { createSeoRuleEngine, type ProductAttributes } from './SeoRuleEngine';

type CopyStyle = 'emocional' | 'informativo' | 'oferta';
type ProductPersona = 'infantil' | 'tecnico' | 'promocional' | 'geral';
type TitleStrategyName = 'SEO' | 'Conversao' | 'Oferta';

export interface PersonalizedTitleAnalysis {
  importantTerms: string[];
  repeatedTerms: string[];
  missingTerms: string[];
  genericTerms: string[];
  attributeTerms: string[];
}

export interface PersonalizedTitleStrategy {
  strategy: TitleStrategyName;
  title: string;
  rationale: string;
}

export interface PersonalizedDescriptionGuidance {
  openingAngle: string;
  benefits: string[];
  differentiators: string[];
  practicalInfo: string[];
  avoidPhrases: string[];
  preferredOpenings: string[];
}

export interface ListingPersonalizationContext {
  currentTitleAnalysis: PersonalizedTitleAnalysis;
  productContext: {
    categoryLabel: string | null;
    categoryPath: string[];
    attributes: ProductAttributes;
    persona: ProductPersona;
    copyStyle: CopyStyle;
    salesAngle: string;
    performanceAngle: string;
    selectedStrategy: TitleStrategyName;
  };
  titleStrategies: PersonalizedTitleStrategy[];
  descriptionGuidance: PersonalizedDescriptionGuidance;
}

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'do', 'da', 'dos', 'das', 'para', 'por', 'com', 'sem', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'ao', 'aos', 'ou', 'se', 'que', 'mais', 'cada', 'seu', 'sua', 'seus', 'suas',
  'ideal', 'produto', 'item', 'original', 'novo', 'nova', 'super',
]);

const GENERIC_TITLE_TERMS = new Set([
  'produto', 'item', 'qualidade', 'ideal', 'perfeito', 'incrivel', 'top', 'premium', 'oferta', 'promocao',
  'imperdivel', 'melhor', 'otimo', 'excelente',
]);

const COLOR_TERMS = ['preto', 'preta', 'branco', 'branca', 'azul', 'rosa', 'verde', 'vermelho', 'vermelha', 'cinza', 'bege', 'marrom', 'amarelo', 'amarela', 'roxo', 'roxa'];
const SIZE_TERMS = ['pp', 'p', 'm', 'g', 'gg', 'xg', 'xxg', 'baby', 'infantil', 'juvenil', 'adulto', 'unissex'];
const MATERIAL_TERMS = ['algodao', 'silicone', 'metal', 'plastico', 'poliester', 'couro', 'madeira', 'inox'];
const INFANTIL_CUES = ['infantil', 'crianca', 'criancas', 'bebe', 'bebes', 'menina', 'menino', 'baby', 'ludico', 'diversao'];
const TECNICO_CUES = ['usb', 'wifi', 'bluetooth', 'led', 'hd', 'ssd', 'gb', 'w', 'v', 'mm', 'cm', 'profissional', 'tecnico', 'industrial', 'recarregavel'];

const BANNED_OPENINGS = [
  'este produto e ideal para',
  'este produto e ideal',
  'ideal para',
  'perfeito para',
  'foi feito para',
];

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function trimTitle(value: string, max = 60): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sliced = clean.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 30 ? sliced.slice(0, lastSpace) : sliced).trim();
}

function inferAttributes(title: string, description: string | null, categoryPath: string[]): ProductAttributes {
  const combined = `${title} ${description || ''} ${categoryPath.join(' ')}`;
  const tokens = tokenize(combined);
  const attrs: ProductAttributes = {};

  const color = COLOR_TERMS.find((term) => tokens.includes(term));
  const size = SIZE_TERMS.find((term) => tokens.includes(term));
  const material = MATERIAL_TERMS.find((term) => tokens.includes(term));
  const modelMatch = combined.match(/\b[A-Z]{1,4}\d{2,}[A-Z0-9-]*\b/);

  if (color) attrs.color = titleCase(color);
  if (size) attrs.size = size.toUpperCase();
  if (material) attrs.material = titleCase(material);
  if (modelMatch) attrs.model = modelMatch[0];

  return attrs;
}

function inferPersona(title: string, categoryPath: string[], hasPromotion: boolean): ProductPersona {
  const haystack = normalizeText(`${title} ${categoryPath.join(' ')}`);
  if (INFANTIL_CUES.some((cue) => haystack.includes(cue))) return 'infantil';
  if (TECNICO_CUES.some((cue) => haystack.includes(cue))) return 'tecnico';
  if (hasPromotion) return 'promocional';
  return 'geral';
}

function inferCopyStyle(persona: ProductPersona, hasPromotion: boolean): CopyStyle {
  if (hasPromotion) return 'oferta';
  if (persona === 'infantil') return 'emocional';
  return 'informativo';
}

function buildImportantTerms(title: string, description: string | null, attrs: ProductAttributes): string[] {
  const titleTerms = tokenize(title);
  const descTerms = tokenize(description || '').slice(0, 24);
  const attrTerms = tokenize(Object.values(attrs).filter(Boolean).join(' '));
  const frequency = new Map<string, number>();

  [...titleTerms, ...descTerms, ...attrTerms].forEach((term) => {
    if (term.length < 2) return;
    frequency.set(term, (frequency.get(term) || 0) + 1);
  });

  return Array.from(frequency.entries())
    .filter(([term]) => !GENERIC_TITLE_TERMS.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => titleCase(term));
}

function buildRepeatedTerms(title: string): string[] {
  const frequency = new Map<string, number>();
  tokenize(title).forEach((term) => {
    frequency.set(term, (frequency.get(term) || 0) + 1);
  });
  return Array.from(frequency.entries())
    .filter(([, count]) => count > 1)
    .map(([term]) => titleCase(term));
}

function buildGenericTerms(title: string): string[] {
  return unique(tokenize(title).filter((term) => GENERIC_TITLE_TERMS.has(term))).map(titleCase);
}

function buildMissingTerms(title: string, categoryPath: string[], attrs: ProductAttributes): string[] {
  const normalizedTitle = normalizeText(title);
  const candidates = [
    ...categoryPath.slice(-2),
    ...Object.values(attrs).filter(Boolean) as string[],
  ];

  return unique(
    candidates
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
      .filter((item) => !normalizedTitle.includes(normalizeText(item)))
  ).slice(0, 5);
}

function buildMainProduct(importantTerms: string[], fallbackTitle: string): string {
  const primary = importantTerms.slice(0, 3).join(' ').trim();
  return trimTitle(primary || fallbackTitle, 36);
}

function buildAttributeTerms(attrs: ProductAttributes): string[] {
  return unique(
    Object.values(attrs)
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter(Boolean)
  ).slice(0, 4);
}

function buildTitleStrategies(
  title: string,
  persona: ProductPersona,
  copyStyle: CopyStyle,
  importantTerms: string[],
  attributeTerms: string[],
  discountPercent: number | null,
  hasPromotion: boolean
): PersonalizedTitleStrategy[] {
  const mainProduct = buildMainProduct(importantTerms, title);
  const attrChunk = attributeTerms.slice(0, 2).join(' ');
  const seoTitle = trimTitle([mainProduct, attrChunk, importantTerms[3]].filter(Boolean).join(' '));

  const conversionBenefit =
    persona === 'infantil'
      ? 'Conforto e Diversao'
      : persona === 'tecnico'
        ? 'Desempenho e Precisao'
        : copyStyle === 'oferta'
          ? 'Escolha Inteligente'
          : 'Uso Pratico no Dia';
  const conversionTitle = trimTitle([mainProduct, conversionBenefit, attributeTerms[0]].filter(Boolean).join(' '));

  const offerHook = hasPromotion
    ? discountPercent
      ? `${discountPercent}% Off Agora`
      : 'Promocao Ativa'
    : persona === 'tecnico'
      ? 'Custo Beneficio'
      : 'Compra Vantajosa';
  const offerTitle = trimTitle([mainProduct, attrChunk || importantTerms[3], offerHook].filter(Boolean).join(' '));

  const uniqueTitles = new Map<string, PersonalizedTitleStrategy>();
  [
    {
      strategy: 'SEO' as const,
      title: seoTitle,
      rationale: 'Prioriza termo principal, atributos relevantes e leitura mais buscavel.',
    },
    {
      strategy: 'Conversao' as const,
      title: conversionTitle,
      rationale: 'Muda o angulo para beneficio percebido e diferenciacao.',
    },
    {
      strategy: 'Oferta' as const,
      title: offerTitle,
      rationale: hasPromotion
        ? 'Explora vantagem comercial sem colocar preco no titulo.'
        : 'Destaca vantagem competitiva sem depender de desconto.',
    },
  ].forEach((item, index) => {
    const key = normalizeText(item.title);
    if (!key) return;
    if (!uniqueTitles.has(key)) {
      uniqueTitles.set(key, item);
      return;
    }
    const fallbackSuffix = index === 1 ? 'Compra Facil' : 'Mais Valor';
    uniqueTitles.set(`${key}-${index}`, {
      ...item,
      title: trimTitle(`${item.title} ${fallbackSuffix}`),
    });
  });

  return Array.from(uniqueTitles.values()).slice(0, 3);
}

function selectStrategyName(
  input: AIAnalyzeInputV21,
  persona: ProductPersona,
  hasPromotion: boolean
): TitleStrategyName {
  if (hasPromotion && (input.listing.discount_percent ?? 0) >= 10) return 'Oferta';
  if ((input.performance.conversionRate ?? 0) < 0.02 && (input.performance.visits ?? 0) >= 30) return 'Conversao';
  if (persona === 'infantil') return 'Conversao';
  return 'SEO';
}

function buildDescriptionGuidance(
  input: AIAnalyzeInputV21,
  titleAnalysis: PersonalizedTitleAnalysis,
  persona: ProductPersona,
  categoryLabel: string | null,
  selectedStrategy: TitleStrategyName
): PersonalizedDescriptionGuidance {
  const mainProduct = buildMainProduct(titleAnalysis.importantTerms, input.listing.title);
  const openingAngle =
    persona === 'infantil'
      ? 'Abrir com tom acolhedor e beneficio da rotina infantil.'
      : persona === 'tecnico'
        ? 'Abrir com clareza tecnica e funcao principal.'
        : selectedStrategy === 'Oferta'
          ? 'Abrir destacando valor percebido e condicao comercial.'
          : 'Abrir com posicionamento claro do produto e uso principal.';

  const benefits = unique([
    persona === 'infantil' ? 'conforto para rotina de criancas' : 'uso pratico no dia a dia',
    persona === 'tecnico' ? 'informacao clara para compra sem duvida' : 'beneficio principal logo nas primeiras linhas',
    titleAnalysis.attributeTerms[0] ? `atributo em destaque: ${titleAnalysis.attributeTerms[0]}` : '',
    titleAnalysis.importantTerms[1] ? `palavra-chave forte: ${titleAnalysis.importantTerms[1]}` : '',
  ].filter(Boolean)).slice(0, 4);

  const differentiators = unique([
    input.listing.has_promotion && input.listing.discount_percent
      ? `promocao ativa de ${input.listing.discount_percent}%`
      : 'posicionamento mais claro que anuncios genericos',
    categoryLabel ? `contexto de categoria: ${categoryLabel}` : '',
    titleAnalysis.missingTerms[0] ? `termo que precisa aparecer no texto: ${titleAnalysis.missingTerms[0]}` : '',
    (input.performance.conversionRate ?? 0) >= 0.03
      ? 'reforcar confianca para acelerar decisao'
      : 'reduzir duvida com texto mais especifico',
  ].filter(Boolean)).slice(0, 4);

  const practicalInfo = unique([
    `preco atual: ${formatCurrency(input.listing.price_final)}`,
    input.listing.has_promotion && input.listing.price_base !== input.listing.price_final
      ? `preco base: ${formatCurrency(input.listing.price_base)}`
      : '',
    `estoque atual: ${input.listing.stock} unidade(s)`,
    categoryLabel ? `categoria: ${categoryLabel}` : '',
  ].filter(Boolean)).slice(0, 4);

  const preferredOpenings = unique([
    persona === 'infantil'
      ? `${mainProduct} pensado para trazer conforto, leveza e uma experiencia mais gostosa no dia a dia das criancas.`
      : persona === 'tecnico'
        ? `${mainProduct} com foco em especificacoes claras, desempenho confiavel e uso sem surpresa.`
        : input.listing.has_promotion
          ? `${mainProduct} com condicao atual mais competitiva para quem quer comprar bem agora.`
          : `${mainProduct} com proposta clara para quem busca escolha pratica e bem explicada.`,
    `${mainProduct} com informacao objetiva, beneficios visiveis e detalhes que ajudam na decisao de compra.`,
  ]);

  return {
    openingAngle,
    benefits,
    differentiators,
    practicalInfo,
    avoidPhrases: BANNED_OPENINGS,
    preferredOpenings,
  };
}

export function buildListingPersonalizationContext(params: {
  title: string;
  description: string | null;
  categoryLabel?: string | null;
  categoryPath?: string[] | null;
  price: number;
  priceFinal: number;
  hasPromotion: boolean;
  discountPercent: number | null;
  visits: number;
  conversionRate: number | null;
  stock: number;
}): ListingPersonalizationContext {
  const categoryPath = (params.categoryPath || []).filter(Boolean);
  const categoryLabel = params.categoryLabel || categoryPath[categoryPath.length - 1] || null;
  const attributes = inferAttributes(params.title, params.description, categoryPath);
  const importantTerms = buildImportantTerms(params.title, params.description, attributes);
  const attributeTerms = buildAttributeTerms(attributes);
  const currentTitleAnalysis: PersonalizedTitleAnalysis = {
    importantTerms,
    repeatedTerms: buildRepeatedTerms(params.title),
    missingTerms: buildMissingTerms(params.title, categoryPath, attributes),
    genericTerms: buildGenericTerms(params.title),
    attributeTerms,
  };

  const persona = inferPersona(params.title, categoryPath, params.hasPromotion);
  const copyStyle = inferCopyStyle(persona, params.hasPromotion);
  const selectedStrategy = selectStrategyName(
    {
      listing: {
        title: params.title,
        description: params.description || '',
        category: categoryLabel,
        price: params.price,
        currency: 'BRL',
        stock: params.stock,
        status: 'active' as AIAnalyzeInputV21['listing']['status'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        price_base: params.price,
        price_final: params.priceFinal,
        has_promotion: params.hasPromotion,
        discount_percent: params.discountPercent,
        description_length: (params.description || '').length,
      },
      performance: {
        periodDays: 30,
        visits: params.visits,
        orders: 0,
        revenue: null,
        conversionRate: params.conversionRate,
      },
    } as AIAnalyzeInputV21,
    persona,
    params.hasPromotion
  );

  const titleStrategies = buildTitleStrategies(
    params.title,
    persona,
    copyStyle,
    importantTerms,
    attributeTerms,
    params.discountPercent,
    params.hasPromotion
  );

  return {
    currentTitleAnalysis,
    productContext: {
      categoryLabel,
      categoryPath,
      attributes,
      persona,
      copyStyle,
      salesAngle:
        persona === 'infantil'
          ? 'Usar tom emocional com conforto, rotina e bem-estar.'
          : persona === 'tecnico'
            ? 'Usar tom informativo com especificacoes, uso e confiabilidade.'
            : params.hasPromotion
              ? 'Destacar oferta ativa e vantagem competitiva.'
              : 'Equilibrar busca, clareza e beneficio pratico.',
      performanceAngle:
        params.conversionRate !== null && params.visits >= 30 && params.conversionRate < 0.02
          ? 'Ha trafego suficiente; o texto precisa reduzir objecao e aumentar conversao.'
          : params.conversionRate !== null && params.conversionRate >= 0.03
            ? 'Ha sinal de interesse; preserve termos fortes e melhore especificidade.'
            : 'Sem performance forte o suficiente; priorize clareza e descoberta.',
      selectedStrategy,
    },
    titleStrategies,
    descriptionGuidance: buildDescriptionGuidance(
      {
        listing: {
          title: params.title,
          description: params.description || '',
          category: categoryLabel,
          price: params.price,
          currency: 'BRL',
          stock: params.stock,
          status: 'active' as AIAnalyzeInputV21['listing']['status'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          price_base: params.price,
          price_final: params.priceFinal,
          has_promotion: params.hasPromotion,
          discount_percent: params.discountPercent,
          description_length: (params.description || '').length,
        },
        performance: {
          periodDays: 30,
          visits: params.visits,
          orders: 0,
          revenue: null,
          conversionRate: params.conversionRate,
        },
      } as AIAnalyzeInputV21,
      currentTitleAnalysis,
      persona,
      categoryLabel,
      selectedStrategy
    ),
  };
}

function scoreTitleCandidate(candidate: string, analysis: PersonalizedTitleAnalysis): number {
  const normalized = normalizeText(candidate);
  let score = 0;

  if (candidate.length >= 45 && candidate.length <= 60) score += 20;
  if (candidate.length >= 35) score += 5;
  score += analysis.importantTerms.slice(0, 3).filter((term) => normalized.includes(normalizeText(term))).length * 8;
  score += analysis.attributeTerms.slice(0, 2).filter((term) => normalized.includes(normalizeText(term))).length * 6;
  score -= analysis.genericTerms.filter((term) => normalized.includes(normalizeText(term))).length * 7;

  return score;
}

function pickBestTitle(existingTitle: string, context: ListingPersonalizationContext): string {
  const existing = existingTitle?.trim() || '';
  const candidates = [
    existing,
    ...context.titleStrategies.map((item) => item.title),
  ].filter(Boolean);

  return candidates
    .map((candidate) => ({ candidate, score: scoreTitleCandidate(candidate, context.currentTitleAnalysis) }))
    .sort((a, b) => b.score - a.score)[0]?.candidate || existing;
}

function buildTitleProblemSummary(
  originalProblem: string,
  context: ListingPersonalizationContext
): string {
  const termsLine = context.currentTitleAnalysis.importantTerms.length > 0
    ? `Termos fortes: ${context.currentTitleAnalysis.importantTerms.join(', ')}.`
    : 'Termos fortes: analisar palavra-chave principal do produto.';
  const missingLine = context.currentTitleAnalysis.missingTerms.length > 0
    ? `Termos faltantes: ${context.currentTitleAnalysis.missingTerms.join(', ')}.`
    : 'Termos faltantes: sem lacunas obvias de atributo no titulo atual.';
  const genericLine = context.currentTitleAnalysis.genericTerms.length > 0
    ? `Genericos em excesso: ${context.currentTitleAnalysis.genericTerms.join(', ')}.`
    : 'Genericos em excesso: sem excesso relevante.';
  const repeatedLine = context.currentTitleAnalysis.repeatedTerms.length > 0
    ? `Repeticoes: ${context.currentTitleAnalysis.repeatedTerms.join(', ')}.`
    : 'Repeticoes: sem repeticao critica.';
  const variationLines = context.titleStrategies
    .map((item) => `${item.strategy}: "${item.title}"`)
    .join(' ');

  return [originalProblem?.trim(), termsLine, missingLine, genericLine, repeatedLine, variationLines]
    .filter(Boolean)
    .join(' ');
}

function sanitizeExistingDescription(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isGenericDescription(value: string, context: ListingPersonalizationContext): boolean {
  const normalized = normalizeText(value);
  const containsBanned = context.descriptionGuidance.avoidPhrases.some((phrase) => normalized.includes(phrase));
  const mentionsTerms = context.currentTitleAnalysis.importantTerms
    .slice(0, 3)
    .filter((term) => normalized.includes(normalizeText(term))).length;

  return containsBanned || mentionsTerms < 2 || !normalized.includes('destaques');
}

function buildSpecificDescription(input: AIAnalyzeInputV21, context: ListingPersonalizationContext): string {
  const mainProduct = buildMainProduct(context.currentTitleAnalysis.importantTerms, input.listing.title);
  const opening = context.descriptionGuidance.preferredOpenings[0];
  const promoLine = input.listing.has_promotion
    ? `Promocao ativa no momento: de ${formatCurrency(input.listing.price_base)} por ${formatCurrency(input.listing.price_final)}.`
    : '';
  const specs = unique([
    context.currentTitleAnalysis.attributeTerms[0] ? `Atributo principal: ${context.currentTitleAnalysis.attributeTerms[0]}.` : '',
    context.currentTitleAnalysis.attributeTerms[1] ? `Complemento: ${context.currentTitleAnalysis.attributeTerms[1]}.` : '',
    context.productContext.categoryLabel ? `Categoria: ${context.productContext.categoryLabel}.` : '',
    `Faixa de preco atual: ${formatCurrency(input.listing.price_final)}.`,
  ].filter(Boolean));

  const text = [
    opening,
    promoLine,
    '',
    `${mainProduct} foi apresentado para responder com mais clareza ao que o comprador procura e para evitar um anuncio com texto generico ou repetitivo.`,
    '',
    'Destaques',
    ...context.descriptionGuidance.benefits.map((item) => `- ${titleCase(item)}.`),
    '',
    'Diferenciais',
    ...context.descriptionGuidance.differentiators.map((item) => `- ${titleCase(item)}.`),
    '',
    'Especificacoes',
    ...specs.map((item) => `- ${item}`),
    '',
    'Informacoes praticas',
    ...context.descriptionGuidance.practicalInfo.map((item) => `- ${titleCase(item)}.`),
    '- Descricao organizada para facilitar leitura, comparacao e decisao de compra.',
    '',
    `Se voce busca ${mainProduct.toLowerCase()} com explicacao objetiva, vantagem clara e contexto de uso bem definido, esta versao do anuncio entrega a informacao certa sem promessas vagas.`,
    `Garanta agora e aproveite uma apresentacao mais especifica para converter melhor no Mercado Livre.`,
  ]
    .filter(Boolean)
    .join('\n');

  return text.trim();
}

function personalizeDescription(
  input: AIAnalyzeInputV21,
  existing: string,
  context: ListingPersonalizationContext
): string {
  const sanitized = sanitizeExistingDescription(existing);
  if (!sanitized || isGenericDescription(sanitized, context)) {
    return buildSpecificDescription(input, context);
  }

  let next = sanitized;
  const opening = context.descriptionGuidance.preferredOpenings[0];
  if (context.descriptionGuidance.avoidPhrases.some((phrase) => normalizeText(next).startsWith(phrase))) {
    next = `${opening}\n\n${next.split(/\n+/).slice(1).join('\n').trim()}`.trim();
  }

  if (!/Informacoes praticas/i.test(next)) {
    next = `${next}\n\nInformacoes praticas\n${context.descriptionGuidance.practicalInfo.map((item) => `- ${titleCase(item)}.`).join('\n')}`;
  }

  return next.trim();
}

export function applyPersonalizationToExpertAnalysis(
  input: AIAnalyzeInputV21,
  analysis: AIAnalysisResultExpert
): AIAnalysisResultExpert {
  if (!analysis.title_fix || !analysis.description_fix) {
    return analysis;
  }

  const context = input.personalization || buildListingPersonalizationContext({
    title: input.listing.title,
    description: input.listing.description,
    categoryLabel: input.listing.category,
    categoryPath: [],
    price: input.listing.price_base,
    priceFinal: input.listing.price_final,
    hasPromotion: input.listing.has_promotion,
    discountPercent: input.listing.discount_percent,
    visits: input.performance.visits,
    conversionRate: input.performance.conversionRate,
    stock: input.listing.stock,
  });

  const optimizedTitle = pickBestTitle(analysis.title_fix.after, context);
  const enrichedProblem = buildTitleProblemSummary(analysis.title_fix.problem, context);
  const optimizedCopy = personalizeDescription(input, analysis.description_fix.optimized_copy, context);

  return {
    ...analysis,
    title_fix: {
      ...analysis.title_fix,
      after: optimizedTitle,
      problem: enrichedProblem,
    },
    description_fix: {
      ...analysis.description_fix,
      diagnostic: `${analysis.description_fix.diagnostic} Estrutura recomendada: posicionamento, beneficios, diferenciais e informacoes praticas.`,
      optimized_copy: optimizedCopy,
    },
  };
}

export function analyzeTitleWithSeoRules(params: {
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryPath: string[];
}): { context: ListingPersonalizationContext; seoSummary: string[] } {
  const context = buildListingPersonalizationContext({
    title: params.title,
    description: params.description,
    categoryLabel: params.categoryPath[params.categoryPath.length - 1] || params.categoryId,
    categoryPath: params.categoryPath,
    price: 0,
    priceFinal: 0,
    hasPromotion: false,
    discountPercent: null,
    visits: 0,
    conversionRate: null,
    stock: 0,
  });
  const engine = createSeoRuleEngine();
  const seo = engine.analyze({
    title: params.title,
    description: params.description,
    categoryId: params.categoryId,
    attributes: context.productContext.attributes,
  });

  return {
    context,
    seoSummary: seo.issues.slice(0, 4).map((issue) => issue.message),
  };
}

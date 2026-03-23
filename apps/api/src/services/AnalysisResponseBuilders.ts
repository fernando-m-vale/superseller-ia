import { formatConversionRatePercent } from '../utils/percentage-format';
import type { RootCauseDiagnosis } from './RootCauseEngine';

export type ActionPillar = 'seo' | 'midia' | 'cadastro' | 'competitividade' | 'performance' | 'ads';
export type ActionGroup = 'immediate' | 'support' | 'best_practice';

export interface MvpActionItem {
  id: string;
  actionKey: string;
  title: string;
  summary: string;
  description: string;
  executionPayload?: {
    diagnostic?: string;
    readyCopy?: string;
    copyableVersion?: string;
    practicalApplication?: string;
  };
  expectedImpact: string;
  impactEstimate?: string;
  impactReason?: string;
  impact: 'high' | 'medium' | 'low';
  priority: 'high' | 'medium' | 'low';
  suggestedActionUrl?: string | null;
  pillar: ActionPillar;
  actionGroup?: ActionGroup;
  rootCauseCode?: RootCauseDiagnosis['diagnosisRootCause'];
}

interface ActionCandidate {
  action: MvpActionItem;
  funnelStage: FunnelStage;
  source: 'core' | 'hack';
  score: number;
  evidenceScore: number;
  impactScore: number;
  confidenceScore: number;
  urgencyScore: number;
  executionScore: number;
  penalties: number;
}

type FunnelStage = 'SEARCH' | 'CLICK' | 'CONVERSION';

type DominantFailureType =
  | 'título pouco buscável'
  | 'categoria desalinhada'
  | 'atributos pouco claros'
  | 'imagem principal pouco clara'
  | 'título pouco específico'
  | 'promessa fraca'
  | 'descrição pouco convincente'
  | 'falta de confiança'
  | 'dúvidas não respondidas'
  | 'fricção de decisão';

export interface DeterministicMvpActionsInput {
  listingIdExt?: string | null;
  listingTitle?: string | null;
  picturesCount?: number | null;
  hackActions?: Array<{
    id?: string;
    actionKey?: string;
    title?: string;
    summary?: string;
    description?: string;
    impact?: string;
    estimatedImpact?: string;
    expectedImpact?: string;
    priority?: string;
    executionPayload?: {
      diagnostic?: string;
      readyCopy?: string;
      copyableVersion?: string;
      practicalApplication?: string;
    };
    actionGroup?: ActionGroup | 'optional';
    rootCauseCode?: RootCauseDiagnosis['diagnosisRootCause'];
    confidence?: number;
    evidence?: string[];
    suggestedActionUrl?: string | null;
  }>;
  metrics30d?: { visits?: number | null; orders?: number | null; conversionRate?: number | null };
  hasPromotion?: boolean | null;
  discountPercent?: number | null;
  mediaVerdict?: { canSuggestClip?: boolean | null; hasClipDetected?: boolean | null };
  visualAnalysis?: {
    visual_score?: number | null;
    strengths?: string[] | null;
    opportunities?: string[] | null;
    main_improvements?: string[] | null;
  } | null;
  dataQualityWarnings?: string[] | null;
  seoSuggestions?: {
    suggestedTitle?: string | null;
    titleRationale?: string | null;
  } | null;
  analysisV21?: {
    title_fix?: { before?: string | null; after?: string | null; problem?: string | null } | null;
    description_fix?: { diagnostic?: string | null; optimized_copy?: string | null } | null;
    image_plan?: Array<{ image?: number | null; action?: string | null }> | null;
    price_fix?: { diagnostic?: string | null; action?: string | null } | null;
  } | null;
  generatedContent?: {
    bullets?: string[] | null;
    seoDescription?: { long?: string | null } | null;
  } | null;
  scoreBreakdown?: Partial<Record<ActionPillar | 'seo' | 'midia' | 'cadastro' | 'competitividade' | 'performance', number>> | null;
  potentialGain?: Partial<Record<ActionPillar | 'seo' | 'midia' | 'cadastro' | 'competitividade' | 'performance', unknown>> | null;
  benchmark?: {
    confidence?: string | null;
    sampleSize?: number | null;
    baselineConversionRate?: number | null;
  };
  adsIntelligence?: {
    status?: 'available' | 'partial' | 'unavailable' | null;
    diagnosis?:
      | 'ads_data_unavailable'
      | 'ads_traffic_without_conversion'
      | 'ads_spend_without_return'
      | 'ads_low_ctr'
      | 'ads_healthy'
      | 'ads_partial_data'
      | 'ads_mixed_signal'
      | null;
    metrics?: {
      impressions?: number | null;
      clicks?: number | null;
      ctr?: number | null;
      spend?: number | null;
      roas?: number | null;
      ordersAttributed?: number | null;
      conversionRateAds?: number | null;
    } | null;
    signals?: {
      hasTrafficFromAds?: boolean | null;
      hasClicksFromAds?: boolean | null;
      hasAttributedSales?: boolean | null;
      adsEfficiencyLevel?: 'strong' | 'moderate' | 'weak' | 'unknown' | null;
      adsConversionHealth?: 'strong' | 'moderate' | 'weak' | 'unknown' | null;
      adsProfitabilitySignal?: 'positive' | 'mixed' | 'negative' | 'unknown' | null;
    } | null;
  } | null;
  rootCause?: Partial<RootCauseDiagnosis> | null;
  maxItems?: number;
}

export interface FunnelBottleneckDiagnosis {
  primaryBottleneck: FunnelStage;
  explanation: string;
  recommendedFocus: string;
}

export interface ExecutionRoadmapStep {
  stepNumber: number;
  actionTitle: string;
  reason: string;
  expectedImpact: string;
}

function normalizeText(value?: string | null): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function textHasAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function summarizeText(value?: string | null, maxLength = 220): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function hasStrongVisualEvidence(
  visualAnalysis?: DeterministicMvpActionsInput['visualAnalysis'],
  mediaVerdict?: DeterministicMvpActionsInput['mediaVerdict'],
): boolean {
  const visualScore = visualAnalysis?.visual_score ?? null;
  const strongSignals = [
    ...(visualAnalysis?.strengths || []),
    ...(visualAnalysis?.opportunities || []),
    ...(visualAnalysis?.main_improvements || []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  const visualLooksStrong =
    typeof visualScore === 'number' && visualScore >= 72;
  const explicitStrength =
    strongSignals.some((signal) =>
      textHasAny(signal, ['forte', 'boa', 'bom', 'consistente', 'adequad', 'atrativ', 'clara', 'profission'])
    ) &&
    !strongSignals.some((signal) =>
      textHasAny(signal, ['trocar capa', 'imagem principal', 'hero', 'foto 1', 'imagem 1', 'galeria fraca'])
    );

  return visualLooksStrong || explicitStrength;
}

function hasRobustMediaCounterEvidence(input: {
  picturesCount?: number | null;
  analysisV21?: DeterministicMvpActionsInput['analysisV21'];
}): boolean {
  const picturesCount = input.picturesCount ?? 0;
  const imagePlan = normalizeText((input.analysisV21?.image_plan || []).map((step) => step?.action || '').join(' '));

  return (
    (picturesCount > 0 && picturesCount < 4) ||
    textHasAny(imagePlan, ['trocar imagem principal', 'trocar capa', 'imagem 1', 'foto 1', 'hero']) ||
    textHasAny(imagePlan, ['sem contexto', 'sem uso', 'produto isolado'])
  );
}

function shouldDemoteMediaAction(input: DeterministicMvpActionsInput, action: MvpActionItem): boolean {
  if (action.pillar !== 'midia') return false;
  if (!hasStrongVisualEvidence(input.visualAnalysis, input.mediaVerdict)) return false;
  return !hasRobustMediaCounterEvidence({
    picturesCount: input.picturesCount,
    analysisV21: input.analysisV21,
  });
}

function inferDominantFailure(input: {
  stage: FunnelStage;
  listingTitle?: string | null;
  picturesCount?: number | null;
  metrics30d?: { visits?: number | null; orders?: number | null; conversionRate?: number | null };
  hasPromotion?: boolean | null;
  discountPercent?: number | null;
  mediaVerdict?: { canSuggestClip?: boolean | null; hasClipDetected?: boolean | null };
  visualAnalysis?: DeterministicMvpActionsInput['visualAnalysis'];
  dataQualityWarnings?: string[] | null;
  analysisV21?: {
    title_fix?: { problem?: string | null } | null;
    description_fix?: { diagnostic?: string | null } | null;
    image_plan?: Array<{ action?: string | null }> | null;
  } | null;
  benchmark?: {
    confidence?: string | null;
    sampleSize?: number | null;
    baselineConversionRate?: number | null;
  } | null;
}): DominantFailureType {
  const titleProblem = normalizeText(input.analysisV21?.title_fix?.problem);
  const descriptionDiagnostic = normalizeText(input.analysisV21?.description_fix?.diagnostic);
  const warnings = normalizeText((input.dataQualityWarnings || []).join(' '));
  const imagePlan = normalizeText((input.analysisV21?.image_plan || []).map((step) => step?.action || '').join(' '));
  const listingTitle = normalizeText(input.listingTitle);
  const picturesCount = input.picturesCount ?? 0;
  const visits = input.metrics30d?.visits ?? 0;
  const cr = input.metrics30d?.conversionRate ?? null;
  const hasPromotion = input.hasPromotion === true;
  const aggressivePromo = hasPromotion && (input.discountPercent ?? 0) >= 20;
  const benchmarkUnavailable = isBenchmarkUnavailable(input.benchmark ?? undefined);

  if (input.stage === 'SEARCH') {
    if (
      textHasAny(warnings, ['categoria', 'catalogo']) ||
      textHasAny(titleProblem, ['categoria', 'segmento', 'catalogo']) ||
      (textHasAny(listingTitle, ['kit', 'completo', 'premium']) && visits < 50)
    ) {
      return 'categoria desalinhada';
    }

    if (
      textHasAny(titleProblem, ['atrib', 'especific', 'modelo', 'medida', 'compat', 'voltag', 'capacidade']) ||
      textHasAny(warnings, ['atrib', 'ficha tecnica', 'variacao'])
    ) {
      return 'atributos pouco claros';
    }

    return 'título pouco buscável';
  }

  if (input.stage === 'CLICK') {
    if (
      !hasStrongVisualEvidence(input.visualAnalysis, input.mediaVerdict) &&
      (
        (picturesCount > 0 && picturesCount < 5) ||
        textHasAny(imagePlan, ['capa', 'principal', 'hero', 'imagem 1', 'foto 1'])
      )
    ) {
      return 'imagem principal pouco clara';
    }

    if (
      textHasAny(titleProblem, ['generico', 'vago', 'narrativa', 'pouco especifico']) ||
      textHasAny(listingTitle, ['incrivel', 'imperdivel', 'oferta'])
    ) {
      return 'título pouco específico';
    }

    return 'promessa fraca';
  }

  if (
    textHasAny(descriptionDiagnostic, ['duvida', 'faq', 'compat', 'nao responde', 'objec']) ||
    textHasAny(titleProblem, ['compat', 'duvida'])
  ) {
    return 'dúvidas não respondidas';
  }

  if (
    (aggressivePromo && visits >= 120 && cr !== null && cr < 0.015) ||
    (picturesCount > 0 && picturesCount < 4) ||
    textHasAny(imagePlan, ['prova', 'uso', 'comparacao', 'detalhe'])
  ) {
    return 'falta de confiança';
  }

  if (textHasAny(descriptionDiagnostic, ['descricao', 'copy', 'beneficio', 'diferencial', 'convinc'])) {
    return 'descrição pouco convincente';
  }

  if (benchmarkUnavailable && !hasPromotion && visits >= 100) {
    return 'fricção de decisão';
  }

  return 'fricção de decisão';
}

function buildFailureNarrative(stage: FunnelStage, failure: DominantFailureType): {
  explanation: string;
  recommendedFocus: string;
  hypothesis: string;
} {
  if (stage === 'SEARCH') {
    if (failure === 'categoria desalinhada') {
      return {
        explanation: 'O anúncio tende a ser lido fora do contexto ideal de busca, o que reduz descoberta e qualificação antes mesmo do clique.',
        recommendedFocus: 'revalidar enquadramento de categoria e sinais de indexação antes de buscar mais tráfego.',
        hypothesis: 'A hipótese dominante é de enquadramento comercial: o produto existe, mas está mal posicionado para ser encontrado.',
      };
    }
    if (failure === 'atributos pouco claros') {
      return {
        explanation: 'A busca perde eficiência quando modelo, compatibilidade e especificações não aparecem com nitidez logo na indexação.',
        recommendedFocus: 'explicitar atributos decisivos no título e no cadastro para capturar buscas de maior intenção.',
        hypothesis: 'A hipótese dominante é de leitura técnica fraca: o anúncio não traduz para a busca os atributos que o comprador filtra.',
      };
    }
    return {
      explanation: 'O anúncio perde tração ainda na busca porque o título atual não compete bem nas pesquisas específicas do comprador.',
      recommendedFocus: 'reescrever o título com atributos procurados e ordem comercial mais buscável.',
      hypothesis: 'A hipótese dominante é de baixa descoberta qualificada: o anúncio até pode ser relevante, mas não está entrando nas buscas certas.',
    };
  }

  if (stage === 'CLICK') {
    if (failure === 'imagem principal pouco clara') {
      return {
        explanation: 'O anúncio já tem chance de aparecer, mas a imagem principal não comunica com rapidez o diferencial da oferta e perde força no clique.',
        recommendedFocus: 'atualizar a capa para leitura imediata de produto, contexto e diferencial visual.',
        hypothesis: 'A hipótese dominante é de atrito visual: o anúncio entra no radar, mas não vence a comparação no grid.',
      };
    }
    if (failure === 'título pouco específico') {
      return {
        explanation: 'Há exposição, mas o título ainda não entrega especificidade suficiente para transformar impressão em clique qualificado.',
        recommendedFocus: 'deixar o título mais específico e menos genérico logo nas primeiras palavras.',
        hypothesis: 'A hipótese dominante é de proposta pouco precisa: o comprador vê o anúncio, mas não entende rápido por que ele é a melhor opção.',
      };
    }
    return {
      explanation: 'O anúncio aparece, porém a proposta inicial ainda soa morna e não cria urgência ou diferenciação no momento do clique.',
      recommendedFocus: 'fortalecer promessa comercial entre título e imagem principal antes de mexer em preço.',
      hypothesis: 'A hipótese dominante é de mensagem fraca: o problema parece menos de alcance e mais de capacidade de chamar atenção certa.',
    };
  }

  if (failure === 'descrição pouco convincente') {
    return {
      explanation: 'O anúncio já atrai visitas, mas perde força na decisão porque a página apresenta o produto sem sustentar bem seus diferenciais.',
      recommendedFocus: 'reorganizar descrição e argumentos para defender valor, uso e diferencial com mais convicção.',
      hypothesis: 'A hipótese dominante é de convencimento: há interesse inicial, mas a oferta ainda não fecha a lógica de compra.',
    };
  }
  if (failure === 'falta de confiança') {
    return {
      explanation: 'Mesmo com tráfego ativo, a decisão trava porque a página ainda não entrega prova visual e segurança suficientes para fechar o pedido.',
      recommendedFocus: 'reforçar prova visual, contexto de uso e sinais de confiança antes de aprofundar desconto.',
      hypothesis: 'A hipótese dominante é de confiança: o problema parece menos de preço e mais de segurança para decidir agora.',
    };
  }
  if (failure === 'dúvidas não respondidas') {
    return {
      explanation: 'O tráfego chega, mas a conversão fica presa porque compatibilidade, uso e objeções práticas ainda não estão resolvidos na página.',
      recommendedFocus: 'responder dúvidas críticas com FAQ, especificações objetivas e evidências de uso.',
      hypothesis: 'A hipótese dominante é de objeção aberta: o comprador considera o produto, mas ainda encontra perguntas sem resposta.',
    };
  }
  return {
    explanation: 'Há interesse suficiente para gerar visita, porém a jornada final ainda exige esforço demais para o comprador concluir a compra.',
    recommendedFocus: 'simplificar a decisão com hierarquia melhor de oferta, prova e argumentos de fechamento.',
    hypothesis: 'A hipótese dominante é de atrito final: existe intenção, mas a página não conduz a decisão com firmeza.',
  };
}

function normalizeMlbId(listingIdExt?: string | null): string | null {
  if (!listingIdExt) return null;
  const cleaned = listingIdExt.trim().replace(/-/g, '');
  const digits = cleaned.match(/\d{6,}/g) || cleaned.match(/\d+/g);
  if (!digits || digits.length === 0) return null;
  return digits.reduce((max, current) => (current.length > max.length ? current : max));
}

function buildMercadoLivreEditUrl(listingIdExt?: string | null): string | null {
  const normalized = normalizeMlbId(listingIdExt);
  if (!normalized) return null;
  return `https://www.mercadolivre.com.br/anuncios/MLB${normalized}/modificar/bomni`;
}

function normalizePriority(value?: string): 'high' | 'medium' | 'low' {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'high' || normalized === 'critical' || normalized === 'alta') return 'high';
  if (normalized === 'low' || normalized === 'baixa') return 'low';
  return 'medium';
}

function normalizeImpact(value?: string): 'high' | 'medium' | 'low' {
  return normalizePriority(value);
}

function softenPriority(value: 'high' | 'medium' | 'low'): 'medium' | 'low' {
  if (value === 'high') return 'medium';
  return 'low';
}

function getImpactScore(impact: 'high' | 'medium' | 'low'): number {
  if (impact === 'high') return 35;
  if (impact === 'medium') return 22;
  return 10;
}

function getPriorityScore(priority: 'high' | 'medium' | 'low'): number {
  if (priority === 'high') return 20;
  if (priority === 'medium') return 12;
  return 4;
}

function isGenericText(text: string): boolean {
  const normalized = text.toLowerCase();
  const genericPatterns = [
    'mapear pontos de abandono',
    'melhorar proposta percebida',
    'refinar oferta',
    'ganho incremental',
    'otimizar funil',
  ];
  return genericPatterns.some((pattern) => normalized.includes(pattern));
}

function isClipAction(action: MvpActionItem): boolean {
  const haystack = `${action.id} ${action.actionKey} ${action.title} ${action.summary} ${action.description}`.toLowerCase();
  return haystack.includes('clip') || haystack.includes('video') || haystack.includes('vídeo');
}

function isBenchmarkUnavailable(benchmark?: DeterministicMvpActionsInput['benchmark']): boolean {
  if (!benchmark) return true;
  if ((benchmark.confidence || '').toLowerCase() === 'unavailable') return true;
  if ((benchmark.sampleSize ?? 0) <= 0) return true;
  return false;
}

function isBenchmarkDependent(action: MvpActionItem): boolean {
  const haystack = `${action.id} ${action.actionKey} ${action.title} ${action.summary} ${action.description}`.toLowerCase();
  if (haystack.includes('benchmark') || haystack.includes('concorr')) {
    return true;
  }
  return action.pillar === 'competitividade' && haystack.includes('preço');
}

function isManualValidationAction(action: MvpActionItem): boolean {
  const haystack = `${action.title} ${action.summary} ${action.description}`.toLowerCase();
  return haystack.includes('validar') || haystack.includes('verificar') || haystack.includes('validação manual');
}

function classifyFailureType(input: {
  stage: FunnelStage;
  listingTitle?: string | null;
  picturesCount?: number | null;
  metrics30d?: { visits?: number | null; orders?: number | null; conversionRate?: number | null };
  hasPromotion?: boolean | null;
  discountPercent?: number | null;
  mediaVerdict?: { canSuggestClip?: boolean | null; hasClipDetected?: boolean | null };
  dataQualityWarnings?: string[] | null;
  analysisV21?: {
    title_fix?: { problem?: string | null } | null;
    description_fix?: { diagnostic?: string | null } | null;
    image_plan?: Array<{ action?: string | null }> | null;
  } | null;
  benchmark?: {
    confidence?: string | null;
    sampleSize?: number | null;
    baselineConversionRate?: number | null;
  } | null;
}): DominantFailureType {
  return inferDominantFailure(input);
}

function inferFunnelStage(action: MvpActionItem): FunnelStage {
  const haystack = `${action.actionKey} ${action.title} ${action.summary} ${action.description}`.toLowerCase();
  if (
    haystack.includes('seo_title') ||
    haystack.includes('título') ||
    haystack.includes('titulo') ||
    haystack.includes('categoria') ||
    haystack.includes('classifica') ||
    haystack.includes('busca') ||
    haystack.includes('palavras-chave')
  ) {
    return 'SEARCH';
  }
  if (
    haystack.includes('imagem') ||
    haystack.includes('foto') ||
    haystack.includes('galeria') ||
    haystack.includes('clip') ||
    haystack.includes('miniatura') ||
    haystack.includes('capa')
  ) {
    return 'CLICK';
  }
  return 'CONVERSION';
}

function attachFunnelDiagnosis(action: MvpActionItem): MvpActionItem {
  const stage = inferFunnelStage(action);
  const summary = action.summary.includes('Estágio do funil:')
    ? action.summary
    : `Estágio do funil: ${stage}. ${action.summary}`;
  return { ...action, summary };
}

function getFunnelStageWeight(stage: FunnelStage): number {
  if (stage === 'SEARCH') return 30;
  if (stage === 'CLICK') return 20;
  return 10;
}

function formatImpactRange(stage: FunnelStage, minValue: number, maxValue: number): string {
  if (stage === 'CONVERSION') {
    return `+${minValue.toFixed(2)}% a +${maxValue.toFixed(2)}% na conversão`;
  }
  const roundedMin = Math.round(minValue);
  const roundedMax = Math.round(maxValue);
  const metric = stage === 'SEARCH' ? 'visitas' : 'CTR';
  return `+${roundedMin}% a +${roundedMax}% ${metric}`;
}

function getImpactRangeByStage(stage: FunnelStage): { min: number; max: number } {
  if (stage === 'SEARCH') return { min: 10, max: 40 };
  if (stage === 'CLICK') return { min: 5, max: 20 };
  return { min: 0.3, max: 2 };
}

function getImpactStrengthMultiplier(impact: 'high' | 'medium' | 'low'): { min: number; max: number } {
  if (impact === 'high') return { min: 1, max: 1 };
  if (impact === 'medium') return { min: 0.85, max: 0.8 };
  return { min: 0.7, max: 0.6 };
}

function buildImpactReason(
  action: MvpActionItem,
  stage: FunnelStage,
  input: DeterministicMvpActionsInput,
  isPrimaryBottleneck: boolean
): string {
  const listingRef = input.listingTitle?.trim() ? `no anúncio "${input.listingTitle.trim()}"` : 'no anúncio';
  const visits = input.metrics30d?.visits ?? 0;
  const cr = input.metrics30d?.conversionRate ?? null;
  const crText = cr !== null ? `${(cr * 100).toFixed(2)}%` : 'indisponível';
  const bottleneckLine = isPrimaryBottleneck
    ? 'Esta é a primeira alavanca agora porque atua no gargalo primário do funil.'
    : 'Esta ação funciona como suporte e melhora uma etapa complementar do funil.';

  if (stage === 'SEARCH') {
    return `${listingRef}, a fricção de descoberta limita alcance qualificado (visitas 30d: ${visits}). ${bottleneckLine}`;
  }
  if (stage === 'CLICK') {
    return `${listingRef}, compradores veem o anúncio mas a proposta visual/textual ainda reduz clique qualificado. ${bottleneckLine}`;
  }
  return `${listingRef}, há tráfego ativo (visitas 30d: ${visits}) com conversão em ${crText}, sinal de dúvida na decisão. ${bottleneckLine}`;
}

function enrichActionWithOpportunityImpact(
  action: MvpActionItem,
  stage: FunnelStage,
  primaryBottleneck: FunnelStage,
  input: DeterministicMvpActionsInput
): MvpActionItem {
  const baseRange = getImpactRangeByStage(stage);
  const strength = getImpactStrengthMultiplier(action.impact);
  const bottleneckMultiplier = stage === primaryBottleneck ? 1.5 : 1;

  const minValue = baseRange.min * strength.min * bottleneckMultiplier;
  const maxValue = baseRange.max * strength.max * bottleneckMultiplier;
  const impactEstimate = formatImpactRange(stage, minValue, maxValue);
  const impactReason = buildImpactReason(action, stage, input, stage === primaryBottleneck);

  return {
    ...action,
    expectedImpact: impactEstimate,
    impactEstimate,
    impactReason,
  };
}

function decorateHackAsExtra(action: MvpActionItem): MvpActionItem {
  const summary = action.summary.toLowerCase().includes('oportunidade extra')
    ? action.summary
    : `Oportunidade extra complementar. ${action.summary}`;
  const description = action.description.toLowerCase().includes('oportunidade extra')
    ? action.description
    : `${action.description} Use esta frente depois das ações principais ou em paralelo com menor prioridade.`;

  return {
    ...action,
    summary,
    description,
    impact: action.impact === 'high' ? 'medium' : action.impact,
    priority: softenPriority(action.priority),
    actionGroup: 'best_practice',
  };
}

function estimateActionEffort(action: MvpActionItem): number {
  const haystack = `${action.title} ${action.summary} ${action.description}`.toLowerCase();
  if (haystack.includes('título') || haystack.includes('titulo') || haystack.includes('keyword') || haystack.includes('faq')) {
    return 1;
  }
  if (haystack.includes('imagem') || haystack.includes('galeria')) {
    return 2;
  }
  if (haystack.includes('descrição') || haystack.includes('descricao') || haystack.includes('preço') || haystack.includes('preco')) {
    return 3;
  }
  return 2;
}

function parseImpactUpperBound(impactEstimate?: string | null): number {
  if (!impactEstimate) return 0;
  const matches = impactEstimate.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return 0;
  const numeric = matches.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (numeric.length === 0) return 0;
  return Math.max(...numeric);
}

export function buildExecutionRoadmap(input: {
  bottleneckDiagnosis?: FunnelBottleneckDiagnosis | null;
  growthHacks?: MvpActionItem[] | null;
}): ExecutionRoadmapStep[] {
  const actions = (input.growthHacks || []).filter((action) => !isClipAction(action));
  if (actions.length === 0) return [];

  const primaryBottleneck = input.bottleneckDiagnosis?.primaryBottleneck ?? 'CONVERSION';

  const ranked = actions
    .map((action) => {
      const stage = inferFunnelStage(action);
      return {
        action,
        stage,
        solvesPrimaryBottleneck: stage === primaryBottleneck,
        effort: estimateActionEffort(action),
        impactUpperBound: parseImpactUpperBound(action.impactEstimate || action.expectedImpact),
      };
    })
    .sort((a, b) => {
      if (a.solvesPrimaryBottleneck !== b.solvesPrimaryBottleneck) {
        return a.solvesPrimaryBottleneck ? -1 : 1;
      }
      if (b.impactUpperBound !== a.impactUpperBound) {
        return b.impactUpperBound - a.impactUpperBound;
      }
      if (a.effort !== b.effort) {
        return a.effort - b.effort;
      }
      const priorityOrder: Record<'high' | 'medium' | 'low', number> = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.action.priority] - priorityOrder[a.action.priority];
    })
    .slice(0, 3);

  return ranked.map((entry, index) => ({
    stepNumber: index + 1,
    actionTitle: entry.action.title,
    reason:
      index === 0
        ? `Ação principal. ${entry.action.impactReason || `Esta é a primeira alavanca porque ataca diretamente o gargalo primário de ${primaryBottleneck}.`}`
        : index === 1
        ? `Ação de suporte. ${entry.action.impactReason || `Ela reforça a etapa ${entry.stage} e aumenta a chance de a ação principal capturar resultado.`}`
        : entry.action.impactReason
        ? entry.action.impactReason
        : `Esta ação reforça a etapa ${entry.stage} para melhorar performance do funil.`,
    expectedImpact: entry.action.impactEstimate || entry.action.expectedImpact || 'Impacto estimado indisponível.',
  }));
}

function makeManualValidationLowImpact(action: MvpActionItem): MvpActionItem {
  const label = 'Validação manual de baixo impacto enquanto benchmark estiver indisponível.';
  const summary = action.summary.toLowerCase().includes('validação manual')
    ? action.summary
    : `${action.summary} ${label}`;
  const description = action.description.toLowerCase().includes('validação manual')
    ? action.description
    : `${action.description} ${label}`;

  return {
    ...action,
    summary,
    description,
    impact: 'low',
    priority: 'low',
  };
}

function hasConcreteTitleEvidence(input: DeterministicMvpActionsInput): boolean {
  const suggestedTitle = input.seoSuggestions?.suggestedTitle;
  const titleAfter = input.analysisV21?.title_fix?.after;
  return Boolean((suggestedTitle && suggestedTitle.trim()) || (titleAfter && titleAfter.trim()));
}

function hasConcreteDescriptionEvidence(input: DeterministicMvpActionsInput): boolean {
  const optimizedCopy = input.analysisV21?.description_fix?.optimized_copy;
  const generatedLong = input.generatedContent?.seoDescription?.long;
  const bullets = input.generatedContent?.bullets || [];
  return Boolean((optimizedCopy && optimizedCopy.trim()) || (generatedLong && generatedLong.trim()) || bullets.length > 0);
}

function hasConcreteImageEvidence(input: DeterministicMvpActionsInput): boolean {
  const plan = input.analysisV21?.image_plan || [];
  return plan.some((step) => Boolean(step?.action && step.action.trim()));
}

function hasConcretePriceEvidence(input: DeterministicMvpActionsInput): boolean {
  const action = input.analysisV21?.price_fix?.action;
  return Boolean(action && action.trim());
}

function hasMediaImprovementEvidence(input: DeterministicMvpActionsInput): boolean {
  const picturesCount = input.picturesCount ?? 0;
  return picturesCount < 6;
}

function hasStrongCategoryEvidence(input: DeterministicMvpActionsInput): boolean {
  const warnings = normalizeText((input.dataQualityWarnings || []).join(' '));
  const titleProblem = normalizeText(input.analysisV21?.title_fix?.problem);
  const rootCause = input.rootCause?.diagnosisRootCause || null;
  const visits = input.metrics30d?.visits ?? 0;
  const seoScore = input.scoreBreakdown?.seo ?? null;
  const competitivenessScore = input.scoreBreakdown?.competitividade ?? null;

  const categorySignal =
    textHasAny(warnings, ['categoria', 'classifica', 'catalogo', 'catalog']) ||
    textHasAny(titleProblem, ['categoria', 'classifica', 'catalogo', 'catalog', 'indexa', 'enquadr']);
  const weakDiscoverySignal =
    visits < 80 ||
    (typeof seoScore === 'number' && seoScore <= 10) ||
    (typeof competitivenessScore === 'number' && competitivenessScore <= 4) ||
    rootCause === 'seo_low_discovery';

  return categorySignal && weakDiscoverySignal;
}

function inferTitleRewriteAngle(input: DeterministicMvpActionsInput): 'compatibility' | 'specs' | 'kit' | 'discovery' {
  const problem = normalizeText(input.analysisV21?.title_fix?.problem || input.seoSuggestions?.titleRationale);
  const listingTitle = normalizeText(input.listingTitle);

  if (textHasAny(problem, ['compat', 'aplicacao', 'serve', 'modelo compat']) || textHasAny(listingTitle, ['compat', 'serve em'])) {
    return 'compatibility';
  }
  if (textHasAny(problem, ['medida', 'capacidade', 'voltag', 'potencia', 'modelo', 'atrib'])) {
    return 'specs';
  }
  if (textHasAny(problem, ['kit', 'variacao', 'varia', 'completo']) || textHasAny(listingTitle, ['kit', 'combo', 'completo'])) {
    return 'kit';
  }
  return 'discovery';
}

function buildTitleActionCopy(input: DeterministicMvpActionsInput): {
  title: string;
  summary: string;
  description: string;
} {
  const visits = input.metrics30d?.visits ?? 0;
  const orders = input.metrics30d?.orders ?? 0;
  const crText = formatConversionRatePercent(input.metrics30d?.conversionRate ?? null);
  const suggestedTitle = input.analysisV21?.title_fix?.after?.trim() || input.seoSuggestions?.suggestedTitle?.trim() || null;
  const titleProblem = input.analysisV21?.title_fix?.problem?.trim() || input.seoSuggestions?.titleRationale?.trim() || null;
  const listingTitle = input.listingTitle?.trim() || 'o anúncio atual';
  const angle = inferTitleRewriteAngle(input);

  if (angle === 'compatibility') {
    return {
      title: 'Explicitar compatibilidade e modelo no título',
      summary: `Com ${visits} visitas e ${orders} pedidos${crText ? ` (CR ${crText})` : ''}, ${listingTitle} ainda não comunica rápido para qual modelo ou aplicação ele serve.`,
      description: suggestedTitle
        ? `Use "${suggestedTitle}" como base e traga compatibilidade, modelo e aplicação nas primeiras palavras.`
        : titleProblem || 'Reorganizar o título para deixar compatibilidade, modelo e aplicação evidentes logo no início.',
    };
  }

  if (angle === 'specs') {
    return {
      title: 'Trazer atributos decisivos para o início do título',
      summary: `O anúncio já recebe leitura suficiente para mostrar que faltam especificações que o comprador usa para filtrar a busca${crText ? ` (${crText})` : ''}.`,
      description: suggestedTitle
        ? `A nova linha sugerida é "${suggestedTitle}". Priorize medida, capacidade, voltagem ou modelo nas primeiras palavras.`
        : titleProblem || 'Reescrever o título destacando medida, capacidade, voltagem ou modelo antes da narrativa comercial.',
    };
  }

  if (angle === 'kit') {
    return {
      title: 'Deixar o título mais claro sobre o que vem na oferta',
      summary: `Hoje a oferta parece ampla demais no grid, o que reduz clique qualificado e descoberta certa para ${listingTitle}.`,
      description: suggestedTitle
        ? `Use "${suggestedTitle}" como referência e deixe explícito no título o que compõe o kit, a variação ou o combo.`
        : titleProblem || 'Explicar melhor no título o que acompanha a oferta e qual combinação está sendo vendida.',
    };
  }

  return {
    title: 'Reescrever título com busca real e contexto comercial',
    summary: `Com ${visits} visitas e ${orders} pedidos${crText ? ` (CR ${crText})` : ''}, o título ainda não está capturando a busca certa com especificidade suficiente.`,
    description: suggestedTitle
      ? `Ajuste recomendado: "${suggestedTitle}". Use a estrutura sugerida para subir termos de busca, modelo e diferencial comercial.`
      : titleProblem || 'Atualizar as primeiras palavras do título com produto, modelo, atributo e intenção de compra mais forte.',
  };
}

function buildAdsAction(input: DeterministicMvpActionsInput, editUrl: string | null): MvpActionItem | null {
  const ads = input.adsIntelligence;
  if (!ads || !ads.status || ads.status === 'unavailable') {
    return null;
  }

  const clicks = ads.metrics?.clicks ?? 0;
  const spend = ads.metrics?.spend ?? 0;
  const roas = ads.metrics?.roas ?? null;
  const ordersAttributed = ads.metrics?.ordersAttributed ?? 0;
  const crAds = ads.metrics?.conversionRateAds ?? null;
  const diagnosis = ads.diagnosis ?? null;
  const hasMeaningfulSpend = spend >= 80;
  const hasMeaningfulTraffic = clicks >= 15 || ads.signals?.hasTrafficFromAds === true;
  const unhealthy =
    diagnosis === 'ads_spend_without_return' ||
    diagnosis === 'ads_traffic_without_conversion' ||
    diagnosis === 'ads_low_ctr' ||
    input.rootCause?.diagnosisRootCause === 'ads_traffic_low_return';

  if (!unhealthy || (!hasMeaningfulSpend && !hasMeaningfulTraffic)) {
    return null;
  }

  if (diagnosis === 'ads_low_ctr' || ads.signals?.adsEfficiencyLevel === 'weak') {
    return {
      id: 'ads_creative_reset',
      actionKey: 'ads_creative_reset',
      title: 'Revisar criativo e promessa antes de insistir em Ads',
      summary: `CTR de Ads ainda fraco${clicks > 0 ? ` com ${clicks} cliques pagos já observados` : ''}, sinalizando atratividade baixa no leilão.`,
      description: 'Refaça capa, título e promessa principal do anúncio antes de aumentar verba. Quando o clique pago já nasce fraco, escalar mídia tende a amplificar desperdício.',
      expectedImpact: 'Melhor eficiência do tráfego pago e menos desperdício por clique.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'ads',
    };
  }

  return {
    id: 'ads_budget_guardrail',
    actionKey: 'ads_budget_guardrail',
    title: ordersAttributed > 0
      ? 'Reorganizar Ads antes de ampliar investimento'
      : 'Segurar escala de Ads até corrigir conversão',
    summary: `Ads já movimenta ${clicks} clique${clicks === 1 ? '' : 's'}${spend > 0 ? ` e R$ ${spend.toFixed(2)} de gasto` : ''}${roas !== null ? `, com ROAS ${roas.toFixed(2)}` : ''}.`,
    description: ordersAttributed > 0
      ? `O tráfego pago existe, mas a eficiência segue fraca${crAds !== null ? ` (CR Ads ${(crAds * 100).toFixed(2)}%)` : ''}. Rebalanceie campanha, criativo e página antes de escalar.`
      : 'Há clique pago sem retorno proporcional. Corrija oferta, prova e página antes de colocar mais verba; caso contrário, Ads só acelera um anúncio que ainda não fecha venda.',
    expectedImpact: 'Redução de desperdício em mídia e melhora da eficiência antes de escalar.',
    impact: 'high',
    priority: 'high',
    suggestedActionUrl: editUrl,
    pillar: 'ads',
  };
}

function shouldAddEvidenceDrivenAction(actionKey: string, input: DeterministicMvpActionsInput): boolean {
  if (actionKey === 'seo_title_refresh') return hasConcreteTitleEvidence(input);
  if (actionKey === 'seo_description_blocks') return hasConcreteDescriptionEvidence(input);
  if (actionKey === 'midia_gallery_upgrade') return hasConcreteImageEvidence(input) || hasMediaImprovementEvidence(input);
  if (actionKey === 'compet_price_positioning') return hasConcretePriceEvidence(input);
  if (actionKey === 'compet_category_alignment') return hasStrongCategoryEvidence(input);
  if (actionKey === 'ads_budget_guardrail' || actionKey === 'ads_creative_reset') return buildAdsAction(input, null) !== null;
  return true;
}

function buildMandatoryActionsForFailure(
  input: DeterministicMvpActionsInput,
  failure: DominantFailureType,
  editUrl: string | null
): MvpActionItem[] {
  const titleProblem = input.analysisV21?.title_fix?.problem?.trim();
  const descriptionDiagnostic = input.analysisV21?.description_fix?.diagnostic?.trim();
  const firstImageAction = input.analysisV21?.image_plan?.find((step) => step?.action?.trim())?.action?.trim();

  if (failure === 'categoria desalinhada') {
    if (!hasStrongCategoryEvidence(input)) {
      return [];
    }
    return [{
      id: 'compet_category_alignment',
      actionKey: 'compet_category_alignment',
      title: 'Revisar classificação ou categoria do anúncio',
      summary: 'Há sinal concreto de enquadramento incorreto ou categoria limitando a descoberta qualificada.',
      description: titleProblem
        ? `Sinal principal do diagnóstico: ${titleProblem}`
        : 'Validar enquadramento do produto, categoria e sinais de catálogo para melhorar descoberta qualificada.',
      expectedImpact: 'Mais aderência de busca e qualificação antes do clique.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'competitividade',
    }];
  }

  if (failure === 'título pouco buscável' || failure === 'atributos pouco claros' || failure === 'título pouco específico') {
    const copy = buildTitleActionCopy(input);
    const suggestedTitle = input.analysisV21?.title_fix?.after?.trim() || input.seoSuggestions?.suggestedTitle?.trim() || null;
    return [{
      id: 'seo_title_refresh',
      actionKey: 'seo_title_refresh',
      title: copy.title,
      summary: copy.summary,
      description: titleProblem
        ? `${suggestedTitle ? `Referência de reescrita: "${suggestedTitle}". ` : ''}Sinal principal do diagnóstico: ${titleProblem}`
        : copy.description,
      expectedImpact: 'Mais CTR qualificado e melhor entrada no funil.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'seo',
    }];
  }

  if (failure === 'imagem principal pouco clara') {
    return [{
      id: 'midia_gallery_upgrade',
      actionKey: 'midia_gallery_upgrade',
      title: 'Atualizar imagem principal e galeria com prova visual',
      summary: 'O veredito sinaliza atrito visual logo na leitura inicial da oferta.',
      description: firstImageAction || 'Atualizar capa, contexto de uso e diferenciais visuais para melhorar clique e confiança.',
      expectedImpact: 'Mais clique qualificado e menor fricção na comparação.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'midia',
    }];
  }

  if (failure === 'descrição pouco convincente') {
    return [{
      id: 'seo_description_reinforcement',
      actionKey: 'seo_description_reinforcement',
      title: 'Reforçar descrição com benefícios e diferenciais',
      summary: 'O veredito aponta baixa capacidade de convencimento na página.',
      description: descriptionDiagnostic || 'Reorganizar descrição para defender valor percebido, uso e diferencial da oferta.',
      expectedImpact: 'Mais clareza de oferta e avanço na decisão de compra.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'seo',
    }];
  }

  if (failure === 'dúvidas não respondidas') {
    return [{
      id: 'performance_faq_alignment',
      actionKey: 'performance_faq_alignment',
      title: 'Transformar dúvidas do comprador em FAQ visível',
      summary: 'O veredito mostra objeções práticas abertas na página do anúncio.',
      description: descriptionDiagnostic || 'Responder compatibilidade, uso, prazo e objeções principais em bloco objetivo.',
      expectedImpact: 'Menos objeção e melhor conversão com o tráfego atual.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'performance',
    }];
  }

  if (failure === 'promessa fraca') {
    return [{
      id: 'performance_offer_message',
      actionKey: 'performance_offer_message',
      title: 'Melhorar comunicação da oferta no anúncio',
      summary: 'O veredito indica proposta inicial morna para disputar atenção no clique.',
      description: 'Ajustar promessa principal entre título, imagem e argumento de valor para diferenciar a oferta.',
      expectedImpact: 'Mais atenção qualificada e melhor leitura comercial.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'performance',
    }];
  }

  if (failure === 'falta de confiança' || failure === 'fricção de decisão') {
    return [{
      id: 'performance_offer_trust',
      actionKey: 'performance_offer_trust',
      title: 'Melhorar comunicação da oferta e provas de confiança',
      summary: 'O veredito sinaliza atrito na decisão final da compra.',
      description: descriptionDiagnostic || firstImageAction || 'Reforçar provas, contexto de uso, garantias e clareza da oferta antes de insistir em preço.',
      expectedImpact: 'Mais segurança para comprar e ganho de conversão.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'performance',
    }];
  }

  return [];
}

function buildEvidenceTemplates(input: DeterministicMvpActionsInput, editUrl: string | null): MvpActionItem[] {
  const templates: MvpActionItem[] = [];
  const titleAfter = input.analysisV21?.title_fix?.after || input.seoSuggestions?.suggestedTitle;
  const titleProblem = input.analysisV21?.title_fix?.problem || input.seoSuggestions?.titleRationale;
  const optimizedCopy = input.analysisV21?.description_fix?.optimized_copy || input.generatedContent?.seoDescription?.long;
  const descriptionDiagnostic = input.analysisV21?.description_fix?.diagnostic;
  const imagePlan = (input.analysisV21?.image_plan || [])
    .filter((step) => typeof step?.action === 'string' && step.action.trim().length > 0)
    .slice(0, 3);
  const priceAction = input.analysisV21?.price_fix?.action;
  const hasAggressivePromo = Boolean(input.hasPromotion && (input.discountPercent ?? 0) >= 30);

  if (titleAfter && titleAfter.trim()) {
    const copy = buildTitleActionCopy(input);
    templates.push({
      id: 'seo_title_refresh',
      actionKey: 'seo_title_refresh',
      title: copy.title,
      summary: `Sugestão pronta: "${titleAfter.trim()}". ${copy.summary}`,
      description: titleProblem?.trim()
        ? `Motivo do ajuste: ${titleProblem.trim()}`
        : copy.description,
      expectedImpact: 'Mais cliques qualificados e melhor entrada no funil.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'seo',
    });
  }

  if (optimizedCopy && optimizedCopy.trim()) {
    const trimmedCopy = optimizedCopy.trim();
    const trimmedDiagnostic = descriptionDiagnostic?.trim() || 'A página ainda não sustenta diferenciais, aplicação e resposta às objeções principais.';
    templates.push({
      id: 'seo_description_blocks',
      actionKey: 'seo_description_blocks',
      title: 'Aplicar descrição pronta com benefícios, prova e FAQ',
      summary: `Diagnóstico curto: ${summarizeText(trimmedDiagnostic, 120)}`,
      description: `Copy pronta para publicar: ${summarizeText(trimmedCopy, 280)}`,
      executionPayload: {
        diagnostic: trimmedDiagnostic,
        readyCopy: trimmedCopy,
        copyableVersion: trimmedCopy,
        practicalApplication: 'Usar a copy como base da descrição principal e abrir um bloco final de FAQ com compatibilidade, uso e garantia.',
      },
      expectedImpact: 'Mais clareza de oferta e menor fricção na decisão de compra.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'seo',
    });
  }

  if (imagePlan.length > 0) {
    templates.push({
      id: 'midia_gallery_upgrade',
      actionKey: 'midia_gallery_upgrade',
      title: 'Atualizar imagem principal e galeria com prova visual',
      summary: `Plano concreto disponível com ${imagePlan.length} prioridades de imagem.`,
      description: imagePlan.map((step, index) => `${index + 1}. ${step.action?.trim()}`).join(' '),
      expectedImpact: 'Melhor prova visual e aumento de conversão.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'midia',
    });
  }

  if (priceAction && priceAction.trim() && !hasAggressivePromo) {
    templates.push({
      id: 'compet_price_positioning',
      actionKey: 'compet_price_positioning',
      title: 'Revisar preço e promoção da oferta',
      summary: 'Há recomendação concreta de preço/oferta no diagnóstico.',
      description: priceAction.trim(),
      expectedImpact: 'Melhor competitividade sem perder margem desnecessariamente.',
      impact: 'medium',
      priority: 'medium',
      suggestedActionUrl: editUrl,
      pillar: 'competitividade',
    });
  }

  const adsAction = buildAdsAction(input, editUrl);
  if (adsAction) {
    templates.push(adsAction);
  }

  return templates;
}

function computeEvidenceScore(action: MvpActionItem, extra?: { confidence?: number; evidenceCount?: number }): number {
  let score = 0;
  const text = `${action.summary} ${action.description}`;
  if (/\d/.test(text)) score += 12;
  if (text.toLowerCase().includes('30 dias')) score += 8;
  if (text.toLowerCase().includes('visitas') || text.toLowerCase().includes('pedidos')) score += 8;
  if (text.toLowerCase().includes('roas') || text.toLowerCase().includes('ads') || text.toLowerCase().includes('cliques pagos')) score += 10;
  if (extra?.confidence !== undefined) {
    score += Math.max(0, Math.min(20, Math.round(extra.confidence / 5)));
  }
  if (extra?.evidenceCount) {
    score += Math.min(20, extra.evidenceCount * 5);
  }
  return score;
}

function computeUrgencyScore(action: MvpActionItem, input: DeterministicMvpActionsInput): number {
  const visits = input.metrics30d?.visits ?? 0;
  const orders = input.metrics30d?.orders ?? 0;
  const cr = input.metrics30d?.conversionRate ?? null;
  const text = `${action.title} ${action.summary} ${action.description}`.toLowerCase();

  if (cr !== null && visits >= 120 && cr < 0.015) {
    if (text.includes('convers') || text.includes('título') || text.includes('imagem') || text.includes('descrição')) {
      return 20;
    }
  }

  if (orders === 0 && visits >= 150) {
    return 15;
  }

  return 6;
}

function buildTemplates(input: DeterministicMvpActionsInput, editUrl: string | null): MvpActionItem[] {
  const visits = input.metrics30d?.visits ?? 0;
  const orders = input.metrics30d?.orders ?? 0;
  const cr = input.metrics30d?.conversionRate ?? null;
  const picturesCount = input.picturesCount ?? 0;
  const crText = formatConversionRatePercent(cr);
  const listingTitle = (input.listingTitle || '').trim();
  const ref = listingTitle ? ` para "${listingTitle}"` : '';
  const templates: MvpActionItem[] = [];

  if (visits >= 80 && (orders === 0 || (cr !== null && cr < 0.02)) && !hasConcreteTitleEvidence(input)) {
    const copy = buildTitleActionCopy(input);
    templates.push({
      id: 'seo_title_refresh',
      actionKey: 'seo_title_refresh',
      title: copy.title,
      summary: copy.summary,
      description: copy.description || `Atualize as primeiras 60 letras${ref} com produto, modelo e atributo principal para atrair a busca certa.`,
      expectedImpact: 'Mais cliques qualificados e melhor entrada no funil.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'seo',
    });
  }

  if (picturesCount < 6) {
    templates.push({
      id: 'midia_gallery_upgrade',
      actionKey: 'midia_gallery_upgrade',
      title: 'Atualizar imagem principal e galeria com prova visual',
      summary: `Hoje o anúncio tem ${picturesCount} imagens. Aumentar para 8+ com contexto de uso tende a reduzir dúvida pré-compra.`,
      description: 'Adicionar imagem principal mais forte, foto de contexto, close técnico e prova visual do principal diferencial.',
      expectedImpact: 'Menor fricção na decisão e melhora de conversão.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'midia',
    });
  }

  if (input.hasPromotion && visits >= 120 && cr !== null && cr < 0.02) {
    templates.push({
      id: 'compet_promo_validation',
      actionKey: 'compet_promo_validation',
      title: 'Revisar promoção antes de continuar forçando tráfego',
      summary: `Promo ativa com ${visits} visitas, ${orders} pedidos${crText ? ` e CR ${crText}` : ''} sugere revisar mensagem e ancoragem da oferta.`,
      description: 'Destacar desconto, preço final e condição de compra antes de aprofundar desconto ou mais investimento.',
      expectedImpact: 'Recuperar conversão sem ampliar erosão de margem.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'competitividade',
    });
  }

  if (visits >= 150 && cr !== null && cr < 0.015) {
    const contentDriven = input.rootCause?.diagnosisRootCause === 'content_low_conversion';
    templates.push({
      id: 'performance_conversion_funnel',
      actionKey: 'performance_conversion_funnel',
      title: contentDriven ? 'Reescrever descrição e atributos que travam a decisão' : 'Corrigir o que trava a decisão na página',
      summary: `Há tráfego suficiente (${visits} visitas) com baixa conversão${crText ? ` (${crText})` : ''}.`,
      description: contentDriven
        ? 'Priorizar descrição, atributos e dúvidas recorrentes que ainda impedem a compra.'
        : 'Priorizar descrição, atributos, prova de confiança e dúvidas recorrentes que ainda impedem a compra.',
      expectedImpact: 'Ganho rápido de pedidos com o tráfego atual.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'performance',
    });
  }

  if (visits >= 100 && orders <= 2) {
    templates.push({
      id: 'performance_questions_faq',
      actionKey: 'performance_questions_faq',
      title: 'Transformar dúvidas comuns em FAQ visível',
      summary: `Baixo volume de pedidos (${orders}) com tráfego existente (${visits}) indica dúvida não respondida no anúncio.`,
      description: 'Adicionar FAQ com respostas objetivas sobre compatibilidade, uso, medidas, prazo e pós-venda.',
      expectedImpact: 'Redução de objeções e melhora de conversão.',
      impact: 'medium',
      priority: 'medium',
      suggestedActionUrl: editUrl,
      pillar: 'performance',
    });
  }

  const adsAction = buildAdsAction(input, editUrl);
  if (adsAction) {
    templates.push(adsAction);
  }

  const benchmarkUnavailable = isBenchmarkUnavailable(input.benchmark);
  if (!benchmarkUnavailable && input.benchmark?.baselineConversionRate && cr !== null && cr < input.benchmark.baselineConversionRate) {
    templates.push({
      id: 'compet_price_positioning',
      actionKey: 'compet_price_positioning',
      title: 'Comparar preço com concorrentes diretos',
      summary: `Conversão atual${crText ? ` (${crText})` : ''} abaixo do baseline da categoria pede revisão de posicionamento comercial.`,
      description: 'Comparar preço final e percepção de valor com concorrentes diretos para recuperar competitividade sem sacrificar margem.',
      expectedImpact: 'Recuperação de share e pedidos em buscas comparativas.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'competitividade',
    });
  }

  return templates;
}

function getRootCauseLeadMatchers(code?: RootCauseDiagnosis['diagnosisRootCause'] | null): string[] {
  switch (code) {
    case 'content_low_conversion':
      return ['descricao', 'descrição', 'atribut', 'faq', 'duvida', 'dúvida'];
    case 'ads_traffic_low_return':
      return ['campanha', 'ads', 'promo', 'oferta'];
    case 'visual_low_ctr':
      return ['imagem principal', 'imagem', 'capa', 'galeria', 'foto'];
    case 'seo_low_discovery':
      return ['titulo', 'título', 'busca', 'atributo'];
    case 'price_low_conversion':
      return ['preco', 'preço', 'promo'];
    case 'trust_low_conversion':
      return ['confi', 'garantia', 'faq', 'prova'];
    case 'logistics_low_conversion':
      return ['frete', 'prazo', 'envio', 'logist'];
    default:
      return [];
  }
}

function scoreActionForRootCause(action: MvpActionItem, code?: RootCauseDiagnosis['diagnosisRootCause'] | null): number {
  if (!code) return 0;
  const haystack = `${action.title} ${action.summary} ${action.description}`.toLowerCase();
  return getRootCauseLeadMatchers(code).reduce((total, matcher) => total + (haystack.includes(matcher) ? 6 : 0), 0);
}

function assignActionGroup(
  action: MvpActionItem,
  stage: FunnelStage,
  primaryBottleneck: FunnelStage,
  rootCause?: Partial<RootCauseDiagnosis> | null,
  input?: DeterministicMvpActionsInput,
): ActionGroup {
  if (input && shouldDemoteMediaAction(input, action)) {
    return 'support';
  }

  const matchScore = scoreActionForRootCause(action, rootCause?.diagnosisRootCause);
  const highPriority = action.priority === 'high';
  const hasRootCause = Boolean(rootCause?.diagnosisRootCause);

  if (hasRootCause && matchScore >= 6) {
    return 'immediate';
  }
  if (!hasRootCause && highPriority && stage === primaryBottleneck) {
    return 'immediate';
  }
  if (highPriority || matchScore >= 6 || stage === primaryBottleneck) {
    return 'support';
  }
  return 'best_practice';
}

function dedupeActions(actions: MvpActionItem[]): MvpActionItem[] {
  const seen = new Set<string>();
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const getSemanticFingerprint = (action: MvpActionItem): string => {
    const haystack = normalize(`${action.title} ${action.summary} ${action.description}`);

    if (
      action.pillar === 'seo' &&
      haystack.includes('titulo') &&
      (
        haystack.includes('reescrever') ||
        haystack.includes('clareza') ||
        haystack.includes('busca') ||
        haystack.includes('atribut') ||
        haystack.includes('modelo') ||
        haystack.includes('index')
      )
    ) {
      return 'seo:title_rewrite';
    }

    if (
      action.pillar === 'seo' &&
      (
        haystack.includes('descricao') ||
        haystack.includes('copy') ||
        haystack.includes('beneficio') ||
        haystack.includes('faq')
      )
    ) {
      return 'seo:description_rewrite';
    }

    if (
      action.pillar === 'ads' &&
      (
        haystack.includes('ads') ||
        haystack.includes('campanha') ||
        haystack.includes('roas') ||
        haystack.includes('trafego pago')
      )
    ) {
      return 'ads:traffic_efficiency';
    }

    if (
      action.pillar === 'midia' &&
      (
        haystack.includes('imagem') ||
        haystack.includes('foto') ||
        haystack.includes('galeria') ||
        haystack.includes('capa') ||
        haystack.includes('visual')
      )
    ) {
      return 'midia:gallery_upgrade';
    }

    return normalize(`${action.pillar} ${action.title}`)
      .split(' ')
      .filter((token) => token.length > 3)
      .slice(0, 6)
      .join(' ');
  };

  return actions.filter((action) => {
    const fingerprint = getSemanticFingerprint(action);

    if (!fingerprint) return true;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

export function buildDeterministicMvpActions(input: DeterministicMvpActionsInput): MvpActionItem[] {
  const requestedMaxItems = Math.min(15, Math.max(1, input.maxItems ?? 15));
  const editUrl = buildMercadoLivreEditUrl(input.listingIdExt);
  const benchmarkUnavailable = isBenchmarkUnavailable(input.benchmark);
  const diagnosisInput = {
    metrics30d: input.metrics30d,
    listingTitle: input.listingTitle,
    picturesCount: input.picturesCount,
    hasPromotion: input.hasPromotion,
    discountPercent: input.discountPercent,
    mediaVerdict: input.mediaVerdict,
    visualAnalysis: input.visualAnalysis,
    dataQualityWarnings: input.dataQualityWarnings,
    analysisV21: input.analysisV21,
    benchmark: input.benchmark,
  };
  const primaryBottleneck = buildFunnelBottleneckDiagnosis(diagnosisInput).primaryBottleneck;
  const dominantFailure = classifyFailureType({
    ...diagnosisInput,
    stage: primaryBottleneck,
  });

  const candidatesByKey = new Map<string, ActionCandidate>();

  const upsertCandidate = (
    action: MvpActionItem,
    extra?: { confidence?: number; evidenceCount?: number; hardPenalty?: number; source?: 'core' | 'hack' }
  ): void => {
    let normalizedAction = attachFunnelDiagnosis(action);
    const funnelStage = inferFunnelStage(normalizedAction);
    const source = extra?.source || 'core';

    if (isClipAction(normalizedAction)) {
      return;
    }

    if (!shouldAddEvidenceDrivenAction(normalizedAction.actionKey, input)) {
      return;
    }

    if (benchmarkUnavailable && isBenchmarkDependent(normalizedAction)) {
      if (!isManualValidationAction(normalizedAction)) {
        return;
      }
      normalizedAction = makeManualValidationLowImpact(normalizedAction);
    }

    const evidenceScore = computeEvidenceScore(normalizedAction, {
      confidence: extra?.confidence,
      evidenceCount: extra?.evidenceCount,
    });

    const impactScore = getImpactScore(normalizedAction.impact);
    const confidenceScore = extra?.confidence !== undefined
      ? Math.max(0, Math.min(20, Math.round(extra.confidence / 5)))
      : getPriorityScore(normalizedAction.priority);
    const urgencyScore = computeUrgencyScore(normalizedAction, input);
    const executionScore = normalizedAction.suggestedActionUrl ? 10 : 5;

    let penalties = 0;
    if (isGenericText(`${normalizedAction.summary} ${normalizedAction.description}`)) penalties += 20;
    if (benchmarkUnavailable && isBenchmarkDependent(normalizedAction)) penalties += 12;
    if (shouldDemoteMediaAction(input, normalizedAction)) penalties += 28;
    penalties += extra?.hardPenalty ?? 0;

    const stageScore = getFunnelStageWeight(funnelStage);
    const score = stageScore + impactScore + evidenceScore + confidenceScore + urgencyScore + executionScore - penalties;

    if (evidenceScore < 10 && normalizedAction.impact !== 'high') {
      return;
    }

    if (score < 40) {
      return;
    }

    const existing = candidatesByKey.get(normalizedAction.actionKey);
    if (!existing || score > existing.score) {
      candidatesByKey.set(normalizedAction.actionKey, {
        action: normalizedAction,
        funnelStage,
        source,
        score,
        evidenceScore,
        impactScore,
        confidenceScore,
        urgencyScore,
        executionScore,
        penalties,
      });
    }
  };

  for (const rawHack of input.hackActions || []) {
    const title = String(rawHack.title || '').trim();
    const description = String(rawHack.summary || rawHack.description || '').trim();
    if (!title || !description) continue;

    const id = String(rawHack.id || `hack_${candidatesByKey.size + 1}`);
    const lowTitle = title.toLowerCase();
    const pillar: ActionPillar =
      lowTitle.includes('categoria') || lowTitle.includes('preço') || lowTitle.includes('frete')
        ? 'competitividade'
        : lowTitle.includes('varia')
          ? 'cadastro'
          : lowTitle.includes('imagem') || lowTitle.includes('foto')
            ? 'midia'
            : 'seo';

    upsertCandidate(
      decorateHackAsExtra(
      {
        id,
        actionKey: String(rawHack.actionKey || id),
        title,
        summary: description,
        description,
        executionPayload: rawHack.executionPayload,
        expectedImpact: String(rawHack.expectedImpact || rawHack.estimatedImpact || rawHack.impact || 'Ganho incremental de conversão').trim(),
        impact: normalizeImpact(String(rawHack.impact || 'medium')),
        priority: normalizePriority(String(rawHack.priority || rawHack.impact || 'medium')),
        suggestedActionUrl: rawHack.suggestedActionUrl ?? editUrl,
        pillar,
        actionGroup: rawHack.actionGroup === 'optional' ? 'best_practice' : rawHack.actionGroup,
        rootCauseCode: rawHack.rootCauseCode,
      }),
      {
        confidence: rawHack.confidence,
        evidenceCount: rawHack.evidence?.length,
        source: 'hack',
      }
    );
  }

  for (const action of buildMandatoryActionsForFailure(input, dominantFailure, editUrl)) {
    upsertCandidate(action, { hardPenalty: -12, source: 'core' });
  }

  for (const template of buildEvidenceTemplates(input, editUrl)) {
    upsertCandidate(template, { hardPenalty: -6, source: 'core' });
  }

  for (const template of buildTemplates(input, editUrl)) {
    upsertCandidate(template, { source: 'core' });
  }

  const ranked = Array.from(candidatesByKey.values())
    .sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'core' ? -1 : 1;
      }
      const aPrimary = a.funnelStage === primaryBottleneck;
      const bPrimary = b.funnelStage === primaryBottleneck;
      if (aPrimary !== bPrimary) {
        return aPrimary ? -1 : 1;
      }
      if (b.score !== a.score) return b.score - a.score;
      if (b.evidenceScore !== a.evidenceScore) return b.evidenceScore - a.evidenceScore;
      return b.impactScore - a.impactScore;
    });

  const dynamicMaxItems = Math.min(
    requestedMaxItems,
    ranked.filter((candidate) => candidate.score >= 78 || candidate.evidenceScore >= 18).length >= 5
      ? 5
      : ranked.filter((candidate) => candidate.score >= 70 || candidate.evidenceScore >= 14).length >= 4
        ? 4
        : ranked.filter((candidate) => candidate.score >= 58 || candidate.evidenceScore >= 12).length >= 3
          ? 3
          : 2,
  );

  const coreCandidates = ranked.filter((candidate) => candidate.source === 'core');
  const hackCandidates = ranked.filter((candidate) => candidate.source === 'hack');
  const reserveHackSlot = hackCandidates.length > 0 && dynamicMaxItems > 1 ? 1 : 0;
  const coreLimit = Math.max(1, dynamicMaxItems - reserveHackSlot);
  const selectedCandidates = [
    ...coreCandidates.slice(0, coreLimit),
    ...hackCandidates.slice(0, dynamicMaxItems - Math.min(coreCandidates.length, coreLimit)),
  ].slice(0, dynamicMaxItems);

  const groupedCandidates = selectedCandidates.map((candidate) => {
    const enriched = enrichActionWithOpportunityImpact(candidate.action, candidate.funnelStage, primaryBottleneck, input);
    return {
      ...candidate,
      action: {
        ...enriched,
        actionGroup: assignActionGroup(enriched, candidate.funnelStage, primaryBottleneck, input.rootCause, input),
        rootCauseCode: input.rootCause?.diagnosisRootCause,
      },
    };
  });

  const deduped = dedupeActions(groupedCandidates.map((candidate) => candidate.action));
  const candidateById = new Map(groupedCandidates.map((candidate) => [candidate.action.id, candidate] as const));
  const resolvedCandidates = deduped
    .map((action) => candidateById.get(action.id))
    .filter((candidate) => candidate !== undefined);

  const immediate = resolvedCandidates
    .filter((candidate) => candidate.action.actionGroup === 'immediate')
    .sort((a, b) => {
      const aMatch = scoreActionForRootCause(a.action, input.rootCause?.diagnosisRootCause);
      const bMatch = scoreActionForRootCause(b.action, input.rootCause?.diagnosisRootCause);
      if (bMatch !== aMatch) return bMatch - aMatch;
      return b.score - a.score;
    })
    .slice(0, 3)
    .map((candidate) => candidate.action);

  const immediateIds = new Set(immediate.map((action) => action.id));
  const remaining = deduped.filter((action) => !immediateIds.has(action.id));
  const support = remaining.filter((action) => action.actionGroup === 'support');
  const bestPractice = remaining
    .filter((action) => action.actionGroup !== 'support')
    .map((action) => ({ ...action, actionGroup: 'best_practice' as const }));

  return [...immediate, ...support, ...bestPractice].slice(0, dynamicMaxItems);
}

export function buildVerdictText(input: {
  rawVerdict?: unknown;
  metrics30d?: { visits?: number | null; orders?: number | null; conversionRate?: number | null };
  hasPromotion?: boolean | null;
  discountPercent?: number | null;
  topActions?: Array<{ title?: string; description?: string }>;
  listingTitle?: string | null;
  picturesCount?: number | null;
  mediaVerdict?: { canSuggestClip?: boolean | null; hasClipDetected?: boolean | null };
  dataQualityWarnings?: string[] | null;
  analysisV21?: {
    title_fix?: { before?: string | null; after?: string | null; problem?: string | null } | null;
    description_fix?: { diagnostic?: string | null; optimized_copy?: string | null } | null;
    image_plan?: Array<{ image?: number | null; action?: string | null }> | null;
  } | null;
  scoreBreakdown?: Partial<Record<ActionPillar | 'seo' | 'midia' | 'cadastro' | 'competitividade' | 'performance', number>> | null;
  potentialGain?: Partial<Record<ActionPillar | 'seo' | 'midia' | 'cadastro' | 'competitividade' | 'performance', unknown>> | null;
  benchmark?: {
    confidence?: string | null;
    sampleSize?: number | null;
    baselineConversionRate?: number | null;
  } | null;
  rootCause?: Partial<RootCauseDiagnosis> | null;
}): string {
  const raw = typeof input.rawVerdict === 'string'
    ? input.rawVerdict
    : JSON.stringify(input.rawVerdict ?? '');
  const verdict = raw.trim();
  if (verdict.length >= 280) {
    return verdict;
  }

  const visits = input.metrics30d?.visits ?? 0;
  const orders = input.metrics30d?.orders ?? 0;
  const crValue = input.metrics30d?.conversionRate ?? null;
  const cr = formatConversionRatePercent(crValue);
  const top = (input.topActions || [])
    .map((a) => a.title?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => !/clip|video|vídeo/i.test(value))
    .slice(0, 3);
  const listingTitle = input.listingTitle?.trim();
  const listingRef = listingTitle ? `"${listingTitle}"` : 'este anúncio';
  const zeroOrders = orders === 0;
  const rootCauseCode = String(input.rootCause?.diagnosisRootCause || '').trim();
  const primaryRecommendation = String(input.rootCause?.primaryRecommendation || '').trim();
  const rootCauseLabelMap: Record<string, string> = {
    visual_low_ctr: 'a imagem principal ainda perde clique',
    seo_low_discovery: 'o anúncio ainda aparece pouco nas buscas',
    price_low_conversion: 'o preço ou a promoção ainda não convencem',
    trust_low_conversion: 'faltam provas de confiança para fechar a compra',
    logistics_low_conversion: 'frete e prazo ainda pesam contra a oferta',
    ads_traffic_low_return: 'os ads estão trazendo retorno fraco',
    content_low_conversion: 'descrição e atributos ainda não ajudam a decidir',
    mixed_signal: 'há mais de um problema relevante ao mesmo tempo',
    insufficient_data: 'ainda faltam sinais para cravar uma causa principal',
  };

  const summarize = (text?: string | null): string | null => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean || null;
  };

  const topAction = top[0] || 'priorizar o ajuste com maior evidência operacional';
  const titleProblem = summarize(input.analysisV21?.title_fix?.problem);
  const descriptionDiagnostic = summarize(input.analysisV21?.description_fix?.diagnostic);
  const imageHint = summarize(
    (input.analysisV21?.image_plan || []).find((step) => typeof step?.action === 'string' && step.action.trim().length > 0)?.action
  );
  const mainProblem = rootCauseCode
    ? rootCauseLabelMap[rootCauseCode] || 'há um problema principal no anúncio'
    : visits < 80
      ? 'o anúncio ainda aparece pouco nas buscas'
      : zeroOrders
        ? 'o anúncio recebe visitas, mas não está virando pedido'
        : 'o anúncio ainda não está convertendo como deveria';
  const why =
    descriptionDiagnostic ||
    titleProblem ||
    imageHint ||
    (zeroOrders
      ? `Nos últimos 30 dias, ${listingRef} teve ${visits} visitas e 0 pedidos.`
      : `${listingRef} teve ${visits} visitas, ${orders} pedidos${cr ? ` e conversão de ${cr}` : ''}.`);
  const firstAction = primaryRecommendation || topAction;

  return [
    `Problema principal: ${mainProblem}.`,
    `Por que isso está acontecendo: ${why}`,
    `O que fazer primeiro: ${firstAction}`,
  ].join('\n');
}

export function buildFunnelBottleneckDiagnosis(input: {
  metrics30d?: { visits?: number | null; orders?: number | null; conversionRate?: number | null };
  listingTitle?: string | null;
  picturesCount?: number | null;
  hasPromotion?: boolean | null;
  discountPercent?: number | null;
  mediaVerdict?: { canSuggestClip?: boolean | null; hasClipDetected?: boolean | null };
  visualAnalysis?: DeterministicMvpActionsInput['visualAnalysis'];
  dataQualityWarnings?: string[] | null;
  analysisV21?: {
    title_fix?: { problem?: string | null } | null;
    description_fix?: { diagnostic?: string | null } | null;
    image_plan?: Array<{ action?: string | null }> | null;
  } | null;
  benchmark?: {
    confidence?: string | null;
    sampleSize?: number | null;
    baselineConversionRate?: number | null;
  } | null;
}): FunnelBottleneckDiagnosis {
  const visits = input.metrics30d?.visits ?? 0;
  const conversionRate = input.metrics30d?.conversionRate ?? null;
  const hasAcceptableConversion = conversionRate !== null && conversionRate >= 0.025;
  const stage: FunnelStage =
    visits < 80
      ? 'SEARCH'
      : visits > 100 && conversionRate !== null && conversionRate < 0.025
      ? 'CONVERSION'
      : visits >= 80 && visits <= 200 && hasAcceptableConversion
      ? 'CLICK'
      : conversionRate !== null && conversionRate < 0.025
      ? 'CONVERSION'
      : 'CLICK';
  const failure = inferDominantFailure({
    stage,
    listingTitle: input.listingTitle,
    picturesCount: input.picturesCount,
    metrics30d: input.metrics30d,
    hasPromotion: input.hasPromotion,
    discountPercent: input.discountPercent,
    mediaVerdict: input.mediaVerdict,
    visualAnalysis: input.visualAnalysis,
    dataQualityWarnings: input.dataQualityWarnings,
    analysisV21: input.analysisV21,
    benchmark: input.benchmark,
  });
  const narrative = buildFailureNarrative(stage, failure);

  return {
    primaryBottleneck: stage,
    explanation: `${narrative.explanation} Falha dominante: ${failure}. ${narrative.hypothesis}`,
    recommendedFocus: `${narrative.recommendedFocus} ${
      stage === 'CONVERSION' && input.hasPromotion
        ? 'Antes de mexer em preço, vale resolver clareza e prova da oferta.'
        : stage === 'SEARCH'
        ? 'Esta frente vem primeiro porque influencia descoberta e qualidade do clique.'
        : 'Esta frente vem primeiro porque melhora a resposta comercial já na próxima leitura do anúncio.'
    }`,
  };
}

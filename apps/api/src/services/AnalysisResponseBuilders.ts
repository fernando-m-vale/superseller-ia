import { formatConversionRatePercent } from '../utils/percentage-format';

export type ActionPillar = 'seo' | 'midia' | 'cadastro' | 'competitividade' | 'performance';

export interface MvpActionItem {
  id: string;
  actionKey: string;
  title: string;
  summary: string;
  description: string;
  expectedImpact: string;
  impact: 'high' | 'medium' | 'low';
  priority: 'high' | 'medium' | 'low';
  suggestedActionUrl?: string | null;
  pillar: ActionPillar;
}

interface ActionCandidate {
  action: MvpActionItem;
  score: number;
  evidenceScore: number;
  impactScore: number;
  confidenceScore: number;
  urgencyScore: number;
  executionScore: number;
  penalties: number;
}

export interface DeterministicMvpActionsInput {
  listingIdExt?: string | null;
  listingTitle?: string | null;
  picturesCount?: number | null;
  hackActions?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    description?: string;
    impact?: string;
    estimatedImpact?: string;
    priority?: string;
    confidence?: number;
    evidence?: string[];
    suggestedActionUrl?: string | null;
  }>;
  metrics30d?: { visits?: number | null; orders?: number | null; conversionRate?: number | null };
  hasPromotion?: boolean | null;
  discountPercent?: number | null;
  mediaVerdict?: { canSuggestClip?: boolean | null; hasClipDetected?: boolean | null };
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
  maxItems?: number;
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

function hasClipInconclusiveWarning(input: DeterministicMvpActionsInput): boolean {
  return (input.dataQualityWarnings || []).includes('clips_not_detectable_via_items_api');
}

function isBenchmarkUnavailable(benchmark?: DeterministicMvpActionsInput['benchmark']): boolean {
  if (!benchmark) return true;
  if ((benchmark.confidence || '').toLowerCase() === 'unavailable') return true;
  if ((benchmark.sampleSize ?? 0) <= 0) return true;
  return false;
}

function isBenchmarkDependent(action: MvpActionItem): boolean {
  const haystack = `${action.id} ${action.actionKey} ${action.title} ${action.summary} ${action.description}`.toLowerCase();
  if (haystack.includes('benchmark') || haystack.includes('concorr') || haystack.includes('categoria')) {
    return true;
  }
  return action.pillar === 'competitividade' && (haystack.includes('preço') || haystack.includes('compet'));
}

function isManualValidationAction(action: MvpActionItem): boolean {
  const haystack = `${action.title} ${action.summary} ${action.description}`.toLowerCase();
  return haystack.includes('validar') || haystack.includes('verificar') || haystack.includes('validação manual');
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
  return picturesCount < 6 || input.mediaVerdict?.canSuggestClip === true;
}

function shouldAddEvidenceDrivenAction(actionKey: string, input: DeterministicMvpActionsInput): boolean {
  if (actionKey === 'seo_title_refresh') return hasConcreteTitleEvidence(input);
  if (actionKey === 'seo_description_blocks') return hasConcreteDescriptionEvidence(input);
  if (actionKey === 'midia_gallery_upgrade') return hasConcreteImageEvidence(input) || hasMediaImprovementEvidence(input);
  if (actionKey === 'compet_price_positioning') return hasConcretePriceEvidence(input);
  return true;
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
    templates.push({
      id: 'seo_title_refresh',
      actionKey: 'seo_title_refresh',
      title: 'Reescrever título com palavras-chave principais',
      summary: `Sugestão pronta de título: "${titleAfter.trim()}".`,
      description: titleProblem?.trim()
        ? `Motivo do ajuste: ${titleProblem.trim()}`
        : 'Há evidência concreta no diagnóstico para otimizar o título e aumentar CTR qualificado.',
      expectedImpact: 'Mais cliques qualificados e melhor entrada no funil.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'seo',
    });
  }

  if (optimizedCopy && optimizedCopy.trim()) {
    templates.push({
      id: 'seo_description_blocks',
      actionKey: 'seo_description_blocks',
      title: 'Atualizar descrição com blocos prontos',
      summary: 'Existe copy otimizada pronta no diagnóstico para reaproveitar imediatamente.',
      description: descriptionDiagnostic?.trim()
        ? descriptionDiagnostic.trim()
        : 'Aplicar blocos da descrição otimizada tende a reduzir objeções e melhorar conversão.',
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
      title: 'Executar plano de imagens do diagnóstico',
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
      title: 'Ajustar estratégia de preço/oferta',
      summary: 'Há recomendação concreta de preço/oferta no diagnóstico.',
      description: priceAction.trim(),
      expectedImpact: 'Melhor competitividade sem perder margem desnecessariamente.',
      impact: 'medium',
      priority: 'medium',
      suggestedActionUrl: editUrl,
      pillar: 'competitividade',
    });
  }

  return templates;
}

function computeEvidenceScore(action: MvpActionItem, extra?: { confidence?: number; evidenceCount?: number }): number {
  let score = 0;
  const text = `${action.summary} ${action.description}`;
  if (/\d/.test(text)) score += 12;
  if (text.toLowerCase().includes('30 dias')) score += 8;
  if (text.toLowerCase().includes('visitas') || text.toLowerCase().includes('pedidos')) score += 8;
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

  if (visits >= 80 && (orders === 0 || (cr !== null && cr < 0.02))) {
    templates.push({
      id: 'seo_title_refresh',
      actionKey: 'seo_title_refresh',
      title: 'Reescrever título com busca real',
      summary: `Com ${visits} visitas e ${orders} pedidos em 30 dias${crText ? ` (CR ${crText})` : ''}, o título precisa ficar mais aderente à intenção de compra.`,
      description: `Atualize as primeiras 60 letras${ref} com produto + marca + modelo + atributo principal para elevar CTR qualificado.`,
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
      title: 'Completar galeria com prova visual',
      summary: `Hoje o anúncio tem ${picturesCount} imagens. Aumentar para 8+ com contexto de uso tende a reduzir dúvida pré-compra.`,
      description: 'Adicionar foto de contexto, close técnico e comparação direta com principal diferencial do produto.',
      expectedImpact: 'Menor fricção na decisão e melhora de conversão.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'midia',
    });
  }

  if (input.mediaVerdict?.canSuggestClip === true && visits >= 100) {
    templates.push({
      id: 'midia_video_clip',
      actionKey: 'midia_video_clip',
      title: 'Publicar clip curto de demonstração',
      summary: `Com ${visits} visitas em 30 dias, um clip de 15-30s pode responder dúvidas de uso que a foto não cobre.`,
      description: 'Gravar demonstração objetiva do uso real, foco no benefício principal e no resultado final em poucos segundos.',
      expectedImpact: 'Aumento de confiança e conversão em tráfego de alta intenção.',
      impact: 'medium',
      priority: 'medium',
      suggestedActionUrl: editUrl,
      pillar: 'midia',
    });
  }

  if (input.hasPromotion && visits >= 120 && cr !== null && cr < 0.02) {
    templates.push({
      id: 'compet_promo_validation',
      actionKey: 'compet_promo_validation',
      title: 'Validar eficiência da promoção atual',
      summary: `Promo ativa com ${visits} visitas, ${orders} pedidos${crText ? ` e CR ${crText}` : ''} sugere revisar mensagem e ancoragem da oferta.`,
      description: 'Testar nova comunicação da oferta (economia absoluta, prazo e condição) antes de aprofundar desconto.',
      expectedImpact: 'Recuperar conversão sem ampliar erosão de margem.',
      impact: 'high',
      priority: 'high',
      suggestedActionUrl: editUrl,
      pillar: 'competitividade',
    });
  }

  if (visits >= 150 && cr !== null && cr < 0.015) {
    templates.push({
      id: 'performance_conversion_funnel',
      actionKey: 'performance_conversion_funnel',
      title: 'Corrigir fricções de conversão na página',
      summary: `Há tráfego suficiente (${visits} visitas) com baixa conversão${crText ? ` (${crText})` : ''}.`,
      description: 'Priorizar os 2 maiores pontos de atrito observáveis no anúncio: clareza de oferta, provas visuais e dúvidas recorrentes.',
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
      description: 'Adicionar bloco de FAQ com 5 respostas objetivas sobre compatibilidade, uso e pós-venda.',
      expectedImpact: 'Redução de objeções e melhora de conversão.',
      impact: 'medium',
      priority: 'medium',
      suggestedActionUrl: editUrl,
      pillar: 'performance',
    });
  }

  const benchmarkUnavailable = isBenchmarkUnavailable(input.benchmark);
  if (!benchmarkUnavailable && input.benchmark?.baselineConversionRate && cr !== null && cr < input.benchmark.baselineConversionRate) {
    templates.push({
      id: 'compet_price_positioning',
      actionKey: 'compet_price_positioning',
      title: 'Recalibrar preço frente à categoria',
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

export function buildDeterministicMvpActions(input: DeterministicMvpActionsInput): MvpActionItem[] {
  const maxItems = Math.min(15, Math.max(1, input.maxItems ?? 15));
  const editUrl = buildMercadoLivreEditUrl(input.listingIdExt);
  const benchmarkUnavailable = isBenchmarkUnavailable(input.benchmark);
  const clipDetectionInconclusive = hasClipInconclusiveWarning(input);

  const candidatesByKey = new Map<string, ActionCandidate>();

  const upsertCandidate = (
    action: MvpActionItem,
    extra?: { confidence?: number; evidenceCount?: number; hardPenalty?: number }
  ): void => {
    let normalizedAction = action;

    if (
      isClipAction(normalizedAction) &&
      normalizedAction.actionKey !== 'midia_clip_manual_validation' &&
      (clipDetectionInconclusive || input.mediaVerdict?.canSuggestClip !== true)
    ) {
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
    penalties += extra?.hardPenalty ?? 0;

    const score = impactScore + evidenceScore + confidenceScore + urgencyScore + executionScore - penalties;

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

  if (clipDetectionInconclusive) {
    upsertCandidate({
      id: 'midia_clip_manual_validation',
      actionKey: 'midia_clip_manual_validation',
      title: 'Validar clip manualmente no Mercado Livre',
      summary: 'A API pública não detecta clips com confiabilidade neste anúncio.',
      description: 'Valide manualmente no painel do Mercado Livre se já existe clip publicado antes de qualquer ajuste de mídia.',
      expectedImpact: 'Evita ação incorreta de baixo valor e mantém o plano confiável.',
      impact: 'low',
      priority: 'low',
      suggestedActionUrl: editUrl,
      pillar: 'midia',
    }, {
      confidence: 70,
      evidenceCount: 2,
    });
  }

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
          : lowTitle.includes('clip') || lowTitle.includes('imagem') || lowTitle.includes('foto')
            ? 'midia'
            : 'seo';

    upsertCandidate(
      {
        id,
        actionKey: id,
        title,
        summary: description,
        description,
        expectedImpact: String(rawHack.impact || rawHack.estimatedImpact || 'Ganho incremental de conversão').trim(),
        impact: normalizeImpact(String(rawHack.impact || 'medium')),
        priority: normalizePriority(String(rawHack.priority || rawHack.impact || 'medium')),
        suggestedActionUrl: rawHack.suggestedActionUrl ?? editUrl,
        pillar,
      },
      {
        confidence: rawHack.confidence,
        evidenceCount: rawHack.evidence?.length,
      }
    );
  }

  for (const template of buildEvidenceTemplates(input, editUrl)) {
    upsertCandidate(template, { hardPenalty: -6 });
  }

  for (const template of buildTemplates(input, editUrl)) {
    upsertCandidate(template);
  }

  const sorted = Array.from(candidatesByKey.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.evidenceScore !== a.evidenceScore) return b.evidenceScore - a.evidenceScore;
      return b.impactScore - a.impactScore;
    })
    .slice(0, maxItems)
    .map((candidate) => candidate.action);

  return sorted;
}

export function buildVerdictText(input: {
  rawVerdict?: string | null;
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
}): string {
  const raw = (input.rawVerdict || '').trim();
  if (raw.length >= 280) {
    return raw;
  }

  const visits = input.metrics30d?.visits ?? 0;
  const orders = input.metrics30d?.orders ?? 0;
  const crValue = input.metrics30d?.conversionRate ?? null;
  const cr = formatConversionRatePercent(crValue);
  const top = (input.topActions || []).slice(0, 3).map((a) => a.title).filter(Boolean) as string[];
  const listingTitle = input.listingTitle?.trim();
  const listingRef = listingTitle ? `"${listingTitle}"` : 'este anúncio';
  const lowVisits = visits < 80;
  const highVisits = visits >= 250;
  const reasonableVisits = visits >= 80 && visits < 250;
  const zeroOrders = orders === 0;
  const weakConversion = typeof crValue === 'number' ? crValue < 0.01 : zeroOrders;
  const benchmarkUnavailable = isBenchmarkUnavailable(input.benchmark ?? undefined);
  const mediaEvidence = input.analysisV21?.image_plan?.some((step) => Boolean(step?.action && step.action.trim().length > 0)) ?? false;
  const mediaWeak = mediaEvidence || (input.picturesCount ?? 0) > 0 && (input.picturesCount ?? 0) < 6 || input.mediaVerdict?.canSuggestClip === true;
  const seoWeak = Boolean(
    input.analysisV21?.title_fix?.problem ||
    input.analysisV21?.title_fix?.after ||
    input.analysisV21?.description_fix?.diagnostic ||
    input.analysisV21?.description_fix?.optimized_copy
  );

  const pillars: ActionPillar[] = ['seo', 'midia', 'cadastro', 'competitividade', 'performance'];
  const breakdown = input.scoreBreakdown || {};
  const availableScores = pillars
    .map((pillar) => ({ pillar, value: breakdown[pillar] }))
    .filter((entry): entry is { pillar: ActionPillar; value: number } => typeof entry.value === 'number' && Number.isFinite(entry.value));
  const dominantPillar = availableScores.length > 0
    ? availableScores.sort((a, b) => a.value - b.value)[0].pillar
    : null;
  const hasPromotion = input.hasPromotion === true;

  const seedBase = `${listingTitle || ''}|${visits}|${orders}|${cr || ''}|${hasPromotion}|${dominantPillar || ''}`;
  let seed = 0;
  for (let i = 0; i < seedBase.length; i += 1) {
    seed = (seed * 31 + seedBase.charCodeAt(i)) >>> 0;
  }
  const pick = (choices: string[], offset = 0): string => choices[(seed + offset) % choices.length];

  const choosePattern = (): 'A' | 'B' | 'C' | 'D' | 'E' => {
    if (hasPromotion && weakConversion) return 'C';
    if (!hasPromotion && zeroOrders) return 'C';
    if (lowVisits && zeroOrders) return 'A';
    if (highVisits && weakConversion) return 'B';
    if (dominantPillar === 'seo' || dominantPillar === 'midia') return 'D';
    if (dominantPillar === 'competitividade' || dominantPillar === 'performance') return 'E';
    if (reasonableVisits && zeroOrders) return 'B';
    return 'A';
  };

  const pattern = choosePattern();
  const topAction = top[0] || pick([
    'priorizar o ajuste com maior evidência operacional',
    'executar a melhoria mais direta para remover fricção de compra',
    'atacar primeiro o ponto de bloqueio mais claro no anúncio',
  ], 2);

  const metricsLine = pick([
    `${listingRef} registrou ${visits} visitas e ${orders} pedidos nos últimos 30 dias${cr ? `, com conversão de ${cr}` : ''}.`,
    `Nos últimos 30 dias, ${listingRef} acumulou ${visits} visitas para ${orders} pedidos${cr ? ` (${cr} de conversão)` : ''}.`,
    `A leitura recente de ${listingRef} mostra ${visits} visitas e ${orders} pedidos${cr ? `, em ${cr} de conversão` : ''}.`,
  ]);

  const discoveryLine = lowVisits
    ? pick([
      'O gargalo principal ainda está em tração: falta volume qualificado suficiente para validar escala.',
      'O cenário aponta mais limitação de alcance qualificado do que de fechamento em escala.',
    ], 1)
    : highVisits && weakConversion
      ? pick([
        'O anúncio já atrai atenção, mas perde força na etapa de decisão.',
        'Há sinais claros de descoberta; o bloqueio parece estar no convencimento para fechar compra.',
      ], 1)
      : reasonableVisits && zeroOrders
        ? pick([
          'Existe fluxo de visitas, porém a proposta ainda não está fechando pedidos.',
          'Há descoberta, mas a oferta não está convertendo interesse em compra.',
        ])
        : pick([
          'A base de tráfego existe, e o avanço agora depende de reduzir fricções da página.',
          'O próximo salto vem menos de volume e mais de clareza de decisão para quem já visita.',
        ]);

  const promoLine = hasPromotion
    ? `Promoção ativa${typeof input.discountPercent === 'number' ? ` (~${input.discountPercent.toFixed(1)}% OFF)` : ''}: o desconto já está em jogo, então o ganho tende a vir da percepção de valor e da prova de oferta.`
    : pick([
      'Sem promoção ativa, o anúncio precisa sustentar valor por clareza comercial e confiança de página.',
      'Como não há promoção ativa, a evolução depende de comunicação de oferta e redução de objeções.',
    ], 1);

  const mediaLine = (input.dataQualityWarnings || []).includes('clips_not_detectable_via_items_api')
    ? 'O status de clip está inconclusivo via API; a prioridade de mídia fica em reforçar galeria e validar vídeo manualmente.'
    : input.mediaVerdict?.canSuggestClip === true
      ? 'Há oportunidade de mídia: o anúncio entra no radar, mas ainda falta prova visual forte para sustentar decisão.'
      : (mediaWeak
        ? 'A mídia ainda pode avançar em prova visual para reduzir insegurança na etapa final da compra.'
        : 'A base visual está razoável; o bloqueio parece mais de proposta/comunicação do que de cobertura de mídia.');

  const seoLine = seoWeak
    ? pick([
      'Os sinais de SEO/copys indicam espaço para melhorar descoberta qualificada e remover dúvida na leitura da oferta.',
      'Há indícios de ajuste em título/descrição para alinhar busca com intenção de compra.',
    ])
    : 'O texto comercial está funcional, então o foco imediato fica em execução de oferta e conversão.';

  const benchmarkLine = benchmarkUnavailable
    ? 'Benchmark externo está indisponível no momento; as decisões aqui se apoiam apenas nos sinais do próprio anúncio.'
    : '';

  let p2 = '';
  if (pattern === 'A') {
    p2 = [discoveryLine, mediaWeak ? mediaLine : seoLine, benchmarkLine].filter(Boolean).join(' ');
  } else if (pattern === 'B') {
    p2 = [discoveryLine, hasPromotion ? promoLine : seoLine, benchmarkLine].filter(Boolean).join(' ');
  } else if (pattern === 'C') {
    p2 = [promoLine, weakConversion ? pick([
      'O problema parece menos de alcance e mais de convencimento no momento da decisão.',
      'O bloqueio atual é transformar interesse em fechamento, não apenas atrair clique.',
    ]) : discoveryLine, benchmarkLine].filter(Boolean).join(' ');
  } else if (pattern === 'D') {
    p2 = [mediaWeak ? mediaLine : seoLine, discoveryLine, benchmarkLine].filter(Boolean).join(' ');
  } else {
    const dominantLine = dominantPillar === 'competitividade'
      ? 'O ponto mais sensível está em competitividade comercial e posicionamento da oferta.'
      : dominantPillar === 'performance'
        ? 'O gargalo dominante está em performance de funil (visita para pedido).'
        : 'O anúncio tem base funcional, mas com bloqueio concentrado em uma frente específica.';
    p2 = [dominantLine, benchmarkLine || discoveryLine].filter(Boolean).join(' ');
  }

  const p3 = pick([
    `Prioridade imediata: ${topAction}.`,
    `Alavanca mais direta agora: ${topAction}.`,
    `Foco operacional desta rodada: ${topAction}.`,
  ], 3);

  return [metricsLine, p2, p3].join('\n\n');
}


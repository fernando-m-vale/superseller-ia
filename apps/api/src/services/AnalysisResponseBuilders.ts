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
  const top = (input.topActions || []).slice(0, 3).map((a) => a.title?.trim()).filter(Boolean) as string[];
  const listingTitle = input.listingTitle?.trim();
  const listingRef = listingTitle ? `"${listingTitle}"` : 'este anúncio';
  const lowVisits = visits < 80;
  const highVisits = visits >= 250;
  const zeroOrders = orders === 0;
  const weakConversion = typeof crValue === 'number' ? crValue < 0.01 : zeroOrders;
  const benchmarkUnavailable = isBenchmarkUnavailable(input.benchmark ?? undefined);
  const clipInconclusive = (input.dataQualityWarnings || []).includes('clips_not_detectable_via_items_api');
  const mediaEvidence = input.analysisV21?.image_plan?.some((step) => Boolean(step?.action && step.action.trim().length > 0)) ?? false;
  const mediaWeak = mediaEvidence || (((input.picturesCount ?? 0) > 0) && ((input.picturesCount ?? 0) < 6)) || input.mediaVerdict?.canSuggestClip === true;
  const seoEvidence = Boolean(
    input.analysisV21?.title_fix?.problem ||
    input.analysisV21?.title_fix?.after ||
    input.analysisV21?.description_fix?.diagnostic ||
    input.analysisV21?.description_fix?.optimized_copy
  );
  const hasPromotion = input.hasPromotion === true;
  const promotionLine = hasPromotion
    ? `Promoção ativa${typeof input.discountPercent === 'number' ? ` (~${input.discountPercent.toFixed(1)}% OFF)` : ''}.`
    : 'Sem promoção ativa.';

  const pillars: ActionPillar[] = ['seo', 'midia', 'cadastro', 'competitividade', 'performance'];
  const breakdown = input.scoreBreakdown || {};
  const availableScores = pillars
    .map((pillar) => ({ pillar, value: breakdown[pillar] }))
    .filter((entry): entry is { pillar: ActionPillar; value: number } => typeof entry.value === 'number' && Number.isFinite(entry.value));
  const dominantPillar = availableScores.length > 0 ? availableScores.sort((a, b) => a.value - b.value)[0].pillar : null;

  const summarize = (text?: string | null, max = 90): string | null => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return null;
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1).trimEnd()}…`;
  };

  const inferActionPillar = (title: string): ActionPillar | null => {
    const value = title.toLowerCase();
    if (value.includes('titulo') || value.includes('título') || value.includes('descricao') || value.includes('descrição') || value.includes('seo')) {
      return 'seo';
    }
    if (value.includes('imagem') || value.includes('foto') || value.includes('galeria') || value.includes('clip') || value.includes('video') || value.includes('vídeo')) {
      return 'midia';
    }
    if (value.includes('preco') || value.includes('preço') || value.includes('frete') || value.includes('compet')) {
      return 'competitividade';
    }
    if (value.includes('varia') || value.includes('ficha') || value.includes('cadastro')) {
      return 'cadastro';
    }
    if (value.includes('convers') || value.includes('funil') || value.includes('oferta')) {
      return 'performance';
    }
    return null;
  };

  const inferMainProblem = (): 'descoberta' | 'conversao' | 'oferta' | 'clareza' | 'midia' | 'competitividade' | 'performance' => {
    if (lowVisits) return 'descoberta';
    if (highVisits && weakConversion) return 'conversao';
    if (zeroOrders) return hasPromotion ? 'conversao' : 'oferta';
    if (dominantPillar === 'seo') return 'clareza';
    if (dominantPillar === 'midia') return 'midia';
    if (dominantPillar === 'competitividade' && !benchmarkUnavailable) return 'competitividade';
    if (dominantPillar === 'performance') return 'performance';
    if (seoEvidence) return 'clareza';
    if (mediaWeak) return 'midia';
    return weakConversion ? 'conversao' : 'performance';
  };

  const mainProblem = inferMainProblem();
  const topAction = top[0] || 'priorizar o ajuste com maior evidência operacional';
  const topActionPillar = inferActionPillar(topAction);
  const titleProblem = summarize(input.analysisV21?.title_fix?.problem, 96);
  const descriptionDiagnostic = summarize(input.analysisV21?.description_fix?.diagnostic, 96);
  const imageHint = summarize(
    (input.analysisV21?.image_plan || []).find((step) => typeof step?.action === 'string' && step.action.trim().length > 0)?.action,
    92
  );

  const executiveLines: string[] = [
    `${listingRef} registrou ${visits} visitas e ${orders} pedidos nos últimos 30 dias${cr ? `, com conversão de ${cr}` : ''}.`,
  ];
  if (hasPromotion || zeroOrders) {
    executiveLines.push(`${promotionLine} ${zeroOrders ? 'Até aqui, o resultado é 0 pedidos.' : ''}`.trim());
  }
  if (mainProblem === 'descoberta') {
    executiveLines.push('Leitura executiva: o gargalo dominante está em descoberta e tração qualificada.');
  } else if (mainProblem === 'conversao') {
    executiveLines.push('Leitura executiva: existe descoberta, mas o bloqueio principal está na conversão da visita em decisão.');
  } else if (mainProblem === 'oferta') {
    executiveLines.push('Leitura executiva: o ponto crítico está na força comercial da oferta para transformar interesse em pedido.');
  } else if (mainProblem === 'clareza') {
    executiveLines.push('Leitura executiva: o anúncio precisa de mais clareza de proposta para alinhar busca e decisão.');
  } else if (mainProblem === 'midia') {
    executiveLines.push('Leitura executiva: o principal limitador está em mídia e prova visual da oferta.');
  } else if (mainProblem === 'competitividade') {
    executiveLines.push('Leitura executiva: o risco dominante está em competitividade e posicionamento comercial.');
  } else {
    executiveLines.push('Leitura executiva: o funil tem base funcional, mas ainda com perda relevante na etapa final.');
  }

  const diagnosisLines: string[] = [];
  if (mainProblem === 'conversao' && hasPromotion) {
    diagnosisLines.push('Como o desconto já está ativo, o bloqueio parece menos de preço e mais de convencimento, confiança e percepção de valor.');
  } else if (mainProblem === 'descoberta') {
    diagnosisLines.push('O volume atual limita aprendizado de escala, o que sugere baixa descoberta qualificada antes da etapa de fechamento.');
  } else if (mainProblem === 'midia') {
    diagnosisLines.push('Há sinais de interesse, mas a apresentação visual ainda não sustenta decisão com prova de uso e diferenciais claros.');
  } else if (mainProblem === 'clareza') {
    diagnosisLines.push('Os sinais de SEO e copy indicam desalinhamento entre intenção de busca e leitura comercial da página.');
  } else if (mainProblem === 'oferta') {
    diagnosisLines.push('Sem incentivo promocional, a conversão depende mais da clareza da proposta e da redução de objeções no anúncio.');
  } else {
    diagnosisLines.push('O anúncio já gera algum fluxo, mas perde eficiência ao transformar interesse em fechamento.');
  }
  if (titleProblem || descriptionDiagnostic) {
    diagnosisLines.push(`Evidência direta do diagnóstico: ${titleProblem || descriptionDiagnostic}.`);
  } else if (imageHint && mainProblem !== 'clareza') {
    diagnosisLines.push(`Evidência operacional de mídia: ${imageHint}.`);
  }
  if (clipInconclusive) {
    diagnosisLines.push('O status de clip está inconclusivo via API; qualquer decisão sobre vídeo depende de validação manual.');
  }
  if (benchmarkUnavailable) {
    diagnosisLines.push('Benchmark externo está indisponível no momento, então a leitura competitiva fica restrita aos sinais internos do anúncio.');
  }

  const priorityReason = (() => {
    if (topActionPillar === 'seo') return 'Esse foco atua na entrada qualificada do funil e na clareza da decisão já na leitura do anúncio.';
    if (topActionPillar === 'midia') return 'Esse foco reduz fricção visual no momento da decisão e tende a melhorar confiança para compra.';
    if (topActionPillar === 'competitividade') {
      return benchmarkUnavailable
        ? 'Esse foco deve começar por validação interna de valor percebido antes de comparação externa mais assertiva.'
        : 'Esse foco ataca diretamente o posicionamento comercial frente ao mercado.';
    }
    if (topActionPillar === 'cadastro') return 'Esse foco organiza a base do anúncio e reduz ruído operacional no funil.';
    if (mainProblem === 'conversao') return 'Esse é o melhor ponto de alavanca agora porque atua no bloqueio entre interesse e pedido.';
    if (mainProblem === 'descoberta') return 'Esse é o melhor ponto de alavanca agora porque acelera descoberta antes de otimizações finas.';
    return 'Esse é o melhor ponto de alavanca agora porque concentra esforço no principal gargalo desta rodada.';
  })();

  const gainHint = topActionPillar && input.potentialGain?.[topActionPillar]
    ? ` Há potencial de ganho reportado para esta frente (${String(input.potentialGain[topActionPillar])}).`
    : '';

  const priorityLines = [
    `Prioridade operacional agora: ${topAction}.`,
    `${priorityReason}${gainHint}`,
  ];

  const expectedResult = (() => {
    if (mainProblem === 'descoberta' || topActionPillar === 'seo') {
      return 'Resultado esperado: aumentar CTR qualificado e elevar o volume de visitas com melhor aderência de busca.';
    }
    if (mainProblem === 'midia' || topActionPillar === 'midia') {
      return 'Resultado esperado: melhorar percepção de valor e reduzir insegurança visual, elevando a taxa de decisão.';
    }
    if (mainProblem === 'oferta' || topActionPillar === 'competitividade') {
      return 'Resultado esperado: fortalecer proposta comercial e converter melhor o interesse já gerado.';
    }
    return 'Resultado esperado: reduzir fricção no funil e aumentar conversão de visitas em pedidos de forma sustentada.';
  })();

  const resultLines = [expectedResult];
  if (hasPromotion && weakConversion) {
    resultLines.push('Com promoção já ativa, o ganho deve vir principalmente de melhor comunicação e prova da oferta, não de novo desconto.');
  }

  return [
    executiveLines.slice(0, 3).join(' '),
    diagnosisLines.slice(0, 3).join(' '),
    priorityLines.slice(0, 2).join(' '),
    resultLines.slice(0, 2).join(' '),
  ].join('\n\n');
}


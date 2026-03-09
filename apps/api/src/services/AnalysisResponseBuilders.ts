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
  mediaVerdict?: { canSuggestClip?: boolean | null };
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

  const candidatesByKey = new Map<string, ActionCandidate>();

  const upsertCandidate = (
    action: MvpActionItem,
    extra?: { confidence?: number; evidenceCount?: number; hardPenalty?: number }
  ): void => {
    let normalizedAction = action;

    if (isClipAction(normalizedAction) && input.mediaVerdict?.canSuggestClip !== true) {
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
}): string {
  const raw = (input.rawVerdict || '').trim();
  if (raw.length >= 120) {
    return raw;
  }

  const visits = input.metrics30d?.visits ?? 0;
  const orders = input.metrics30d?.orders ?? 0;
  const cr = formatConversionRatePercent(input.metrics30d?.conversionRate ?? null);
  const top = (input.topActions || []).slice(0, 3).map((a) => a.title).filter(Boolean) as string[];
  const listingRef = input.listingTitle?.trim() ? `para "${input.listingTitle.trim()}" ` : '';

  const p1 = `Diagnóstico ${listingRef}nos últimos 30 dias: ${visits} visitas e ${orders} pedidos${cr ? `, com conversão de ${cr}` : ''}. O volume indica interesse real, mas ainda há margem para converter melhor o tráfego já conquistado.`;

  const p2 = input.hasPromotion
    ? `Há promoção ativa${typeof input.discountPercent === 'number' ? ` (~${input.discountPercent.toFixed(1)}% de desconto)` : ''}. O maior ganho tende a vir de clareza da oferta, prova visual e remoção de fricções na página.`
    : 'Sem promoção ativa, o crescimento depende de fundamentos do anúncio: título orientado à busca, mídia forte e cadastro completo.';

  const p3 = `Próxima ação recomendada: ${top.length > 0 ? top[0] : 'priorizar melhoria com maior evidência observável'}.`;

  return [p1, p2, p3].join('\n\n');
}


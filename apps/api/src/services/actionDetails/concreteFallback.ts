import { ActionDetailsV1 } from '../ActionDetailsPrompt';
import { ActionDetailsV2 } from '../schemas/ActionDetailsV2';
import { mapActionKeyToActionType } from './actionTypeMapping';

type SchemaVersion = 'v1' | 'v2';

interface ApplyConcreteFallbackInput {
  actionKey: string;
  schemaVersion: SchemaVersion;
  details: ActionDetailsV1 | ActionDetailsV2;
  analysisPayload?: Record<string, unknown> | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function asTitleArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const record = asRecord(item);
      return asString(record?.text) || asString(record?.title) || '';
    })
    .filter(Boolean);
}

function extractFallbackSources(payload?: Record<string, unknown> | null): {
  suggestedTitle: string | null;
  titleAfter: string | null;
  titleBefore: string | null;
  titleProblem: string | null;
  titleRationale: string | null;
  generatedTitles: string[];
  descriptionCopy: string | null;
  descriptionDiagnostic: string | null;
  generatedLongDescription: string | null;
  generatedBullets: string[];
  imagePlan: Array<{ image: number; action: string }>;
} {
  const analysisV21 = asRecord(payload?.analysisV21);
  const seoSuggestions = asRecord(payload?.seoSuggestions);
  const generatedContent = asRecord(payload?.generatedContent);

  const titleFix = asRecord(analysisV21?.title_fix);
  const descriptionFix = asRecord(analysisV21?.description_fix);
  const rawImagePlan = Array.isArray(analysisV21?.image_plan) ? analysisV21?.image_plan : [];
  const seoDescription = asRecord(generatedContent?.seoDescription);

  const imagePlan = rawImagePlan
    .map((step) => {
      const item = asRecord(step);
      const image = Number(item?.image);
      const action = asString(item?.action);
      if (!Number.isFinite(image) || !action) return null;
      return { image, action };
    })
    .filter((item): item is { image: number; action: string } => Boolean(item))
    .sort((a, b) => a.image - b.image);

  return {
    suggestedTitle: asString(seoSuggestions?.suggestedTitle),
    titleAfter: asString(titleFix?.after),
    titleBefore: asString(titleFix?.before),
    titleProblem: asString(titleFix?.problem),
    titleRationale: asString(seoSuggestions?.titleRationale),
    generatedTitles: asTitleArray(generatedContent?.titles),
    descriptionCopy: asString(descriptionFix?.optimized_copy),
    descriptionDiagnostic: asString(descriptionFix?.diagnostic),
    generatedLongDescription: asString(seoDescription?.long),
    generatedBullets: asStringArray(generatedContent?.bullets),
    imagePlan,
  };
}

function ensureThreeTitleSuggestions(primary: string, alternatives: string[] = []): string[] {
  const dedup = [primary, ...alternatives]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 60))
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 3);

  while (dedup.length < 3) {
    dedup.push(primary);
  }

  return dedup.slice(0, 3);
}

function getDescriptionBlocks(source: string): string[] {
  const byParagraph = source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (byParagraph.length >= 2) return byParagraph.slice(0, 4);

  const bySentence = source
    .split(/[.!?]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (bySentence.length >= 2) return bySentence.slice(0, 4);
  if (bySentence.length === 1) return [bySentence[0], bySentence[0]];
  return [];
}

function buildCopyReadyDescription(source: string, bullets: string[]): string {
  const blocks = getDescriptionBlocks(source);
  const selectedBullets = bullets.slice(0, 6);
  const lines = [
    ...blocks,
    ...(selectedBullets.length > 0 ? ['', ...selectedBullets.map((bullet) => `• ${bullet}`)] : []),
  ];
  return lines.filter(Boolean).join('\n\n');
}

function getKeywordSuggestionsFromTitle(title: string): Array<{ keyword: string; placement: 'title' | 'description' | 'bullets' }> {
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4);

  const unique = Array.from(new Set(words)).slice(0, 3);
  while (unique.length < 3 && unique.length > 0) unique.push(unique[0]);

  return unique.map((keyword) => ({ keyword, placement: 'title' as const }));
}

function ensureGalleryPlan(plan: Array<{ image: number; action: string }>): Array<{
  slotNumber: number;
  objective: string;
  whatToShow: string;
}> {
  const slots = plan.map((step, index) => ({
    slotNumber: index + 1,
    objective: `Imagem ${step.image}`,
    whatToShow: step.action,
  }));

  while (slots.length > 0 && slots.length < 6) {
    const next = slots.length + 1;
    slots.push({
      slotNumber: next,
      objective: `Imagem ${next}`,
      whatToShow: 'Repetir o ângulo mais forte com variação de contexto para reforçar prova visual.',
    });
  }

  return slots.slice(0, 12);
}

export function applyConcreteFallbackDetails(input: ApplyConcreteFallbackInput): ActionDetailsV1 | ActionDetailsV2 {
  if (!input.analysisPayload) return input.details;

  const actionType = mapActionKeyToActionType(input.actionKey);
  const source = extractFallbackSources(input.analysisPayload);
  const prioritizedTitle = source.titleAfter || source.suggestedTitle || source.generatedTitles[0] || null;
  const alternativeTitles = [source.suggestedTitle, ...source.generatedTitles, source.titleAfter]
    .filter((item): item is string => Boolean(item && item.trim().length > 0))
    .filter((item, index, array) => array.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index);
  const prioritizedDescription = source.descriptionCopy || source.generatedLongDescription || null;
  const titleReason = source.titleProblem || source.titleRationale;

  if (input.schemaVersion === 'v1') {
    const details = { ...(input.details as ActionDetailsV1) } as ActionDetailsV1 & {
      copySuggestions?: {
        titles?: Array<{ variation: 'A' | 'B' | 'C'; text: string }>;
        description?: string;
        bullets?: string[];
      };
    };

    if (actionType === 'SEO_TITLE_REWRITE') {
      if (prioritizedTitle) {
        const variants = ensureThreeTitleSuggestions(prioritizedTitle, alternativeTitles);
        details.titleSuggestions = variants;
        details.copySuggestions = {
          ...(details.copySuggestions || {}),
          titles: variants.map((text, index) => ({
            variation: index === 0 ? 'A' : index === 1 ? 'B' : 'C',
            text,
          })),
        };
        if (source.titleBefore || titleReason) {
          const titleNow = source.titleBefore ? `Título atual: "${source.titleBefore}". ` : '';
          const reason = titleReason ? `Motivo da troca: ${titleReason}.` : '';
          details.rationale = `${titleNow}Título sugerido: "${prioritizedTitle}". ${reason}`.trim();
        }
        details.summary = `Título sugerido pronto para copiar: "${prioritizedTitle}".`;
      }
    }

    if (actionType === 'DESCRIPTION_REWRITE_BLOCKS') {
      if (prioritizedDescription) {
        const blocks = getDescriptionBlocks(prioritizedDescription);
        if (blocks.length >= 2) details.descriptionTemplateBlocks = blocks;
        const bullets = source.generatedBullets.slice(0, 6);
        const copyReadyDescription = buildCopyReadyDescription(prioritizedDescription, bullets);
        details.copySuggestions = {
          ...(details.copySuggestions || {}),
          description: copyReadyDescription,
          bullets: bullets.length > 0 ? bullets : undefined,
        };
        details.summary = `Descrição pronta para copiar disponível.${source.descriptionDiagnostic ? ` Diagnóstico: ${source.descriptionDiagnostic}.` : ''}`.trim();
      }
    }

    if (actionType === 'MEDIA_GALLERY_PLAN' && source.imagePlan.length > 0) {
      const ordered = source.imagePlan.map((step) => `Imagem ${step.image}: ${step.action}`);
      const mergedSteps = [...ordered, ...details.howToSteps].slice(0, 7);
      while (mergedSteps.length < 3) mergedSteps.push(ordered[0]);
      details.howToSteps = mergedSteps;
      details.summary = `${details.summary} Plano de imagens em ordem disponível nos passos.`.trim();
    }

    return details;
  }

  const details = { ...(input.details as ActionDetailsV2) };
  const artifacts = { ...(details.artifacts || {}) };

  if (actionType === 'SEO_TITLE_REWRITE') {
    if (prioritizedTitle) {
      const copy = { ...(artifacts.copy || {}) };
      const variants = ensureThreeTitleSuggestions(prioritizedTitle, alternativeTitles);
      copy.titleSuggestions = variants.map((text, index) => ({
        variation: index === 0 ? 'A' : index === 1 ? 'B' : 'C',
        text,
        rationale: index === 0
          ? [
              source.titleBefore ? `Título atual: ${source.titleBefore}` : null,
              titleReason ? `Motivo: ${titleReason}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || undefined
          : 'Variação alternativa para teste A/B.',
      }));
      if (copy.titleSuggestions.length > 0) {
        copy.keywordSuggestions = getKeywordSuggestionsFromTitle(copy.titleSuggestions[0].text).map((keyword) => ({
          ...keyword,
          rationale: 'Termo extraído do título sugerido para reforçar intenção de busca.',
        }));
      }
      artifacts.copy = copy;
    }
  }

  if (actionType === 'DESCRIPTION_REWRITE_BLOCKS') {
    if (prioritizedDescription) {
      const copy = { ...(artifacts.copy || {}) };
      const blocks = getDescriptionBlocks(prioritizedDescription);
      const preferredSourceLabel = source.descriptionCopy ? 'analysisV21.description_fix.optimized_copy' : 'generatedContent.seoDescription.long';
      const secondarySourceLabel = source.descriptionCopy && source.generatedLongDescription
        ? 'generatedContent.seoDescription.long'
        : null;
      if (blocks.length >= 2) {
        copy.descriptionTemplate = {
          headline: source.descriptionDiagnostic || 'Descrição pronta para copiar no ML',
          blocks,
          bullets: source.generatedBullets.length >= 3 ? source.generatedBullets.slice(0, 6) : undefined,
          cta: `Versão principal: ${preferredSourceLabel}.${secondarySourceLabel ? ` Fallback secundário: ${secondarySourceLabel}.` : ''}`,
        };
      }
      if (source.generatedBullets.length > 0) {
        const bullets = source.generatedBullets.slice(0, 5);
        while (bullets.length < 3) bullets.push(bullets[0]);
        copy.bulletSuggestions = bullets;
      }
      if (!copy.keywordSuggestions || copy.keywordSuggestions.length === 0) {
        const keywordSource = prioritizedTitle || prioritizedDescription;
        copy.keywordSuggestions = getKeywordSuggestionsFromTitle(keywordSource);
      }
      artifacts.copy = copy;
    }
  }

  if (actionType === 'MEDIA_GALLERY_PLAN' && source.imagePlan.length > 0) {
    const media = { ...(artifacts.media || {}) };
    if (!media.galleryPlan || media.galleryPlan.length === 0) {
      media.galleryPlan = ensureGalleryPlan(source.imagePlan);
    }
    artifacts.media = media;
  }

  details.artifacts = artifacts;
  return details;
}

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

function extractFallbackSources(payload?: Record<string, unknown> | null): {
  suggestedTitle: string | null;
  titleAfter: string | null;
  titleBefore: string | null;
  titleProblem: string | null;
  titleRationale: string | null;
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
    descriptionCopy: asString(descriptionFix?.optimized_copy),
    descriptionDiagnostic: asString(descriptionFix?.diagnostic),
    generatedLongDescription: asString(seoDescription?.long),
    generatedBullets: asStringArray(generatedContent?.bullets),
    imagePlan,
  };
}

function ensureThreeTitleSuggestions(primary: string, secondary?: string | null, tertiary?: string | null): string[] {
  const dedup = [primary, secondary || '', tertiary || '']
    .map((item) => item.trim())
    .filter(Boolean)
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

  if (input.schemaVersion === 'v1') {
    const details = { ...(input.details as ActionDetailsV1) };

    if (actionType === 'SEO_TITLE_REWRITE') {
      const title = source.suggestedTitle || source.titleAfter;
      if (title && (!details.titleSuggestions || details.titleSuggestions.length === 0)) {
        details.titleSuggestions = ensureThreeTitleSuggestions(title, source.titleAfter, source.titleBefore);
      }
      if (title) {
        details.rationale = `${details.rationale} Sugestão concreta: "${title}". ${source.titleProblem || source.titleRationale || ''}`.trim();
      }
    }

    if (actionType === 'DESCRIPTION_REWRITE_BLOCKS') {
      const copy = source.descriptionCopy || source.generatedLongDescription;
      if (copy && (!details.descriptionTemplateBlocks || details.descriptionTemplateBlocks.length === 0)) {
        const blocks = getDescriptionBlocks(copy);
        if (blocks.length >= 2) details.descriptionTemplateBlocks = blocks;
      }
      if (copy) {
        details.summary = `${details.summary} Copy sugerida disponível para aplicar diretamente.`.trim();
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
    const title = source.suggestedTitle || source.titleAfter;
    if (title) {
      const copy = { ...(artifacts.copy || {}) };
      if (!copy.titleSuggestions || copy.titleSuggestions.length === 0) {
        const variants = ensureThreeTitleSuggestions(title, source.titleAfter, source.titleBefore);
        copy.titleSuggestions = variants.map((text, index) => ({
          variation: index === 0 ? 'A' : index === 1 ? 'B' : 'C',
          text: text.slice(0, 60),
          rationale: index === 0 ? (source.titleProblem || source.titleRationale || undefined) : undefined,
        }));
      }
      if (!copy.keywordSuggestions || copy.keywordSuggestions.length === 0) {
        copy.keywordSuggestions = getKeywordSuggestionsFromTitle(title);
      }
      artifacts.copy = copy;
    }
  }

  if (actionType === 'DESCRIPTION_REWRITE_BLOCKS') {
    const copySource = source.descriptionCopy || source.generatedLongDescription;
    if (copySource) {
      const copy = { ...(artifacts.copy || {}) };
      const blocks = getDescriptionBlocks(copySource);
      if ((!copy.descriptionTemplate || copy.descriptionTemplate.blocks.length === 0) && blocks.length >= 2) {
        copy.descriptionTemplate = {
          headline: source.descriptionDiagnostic || 'Descrição otimizada para aplicar',
          blocks,
          bullets: source.generatedBullets.length >= 3 ? source.generatedBullets.slice(0, 6) : undefined,
          cta: 'Aplicar esta versão no anúncio e monitorar conversão por 7 dias.',
        };
      }
      if ((!copy.bulletSuggestions || copy.bulletSuggestions.length === 0) && source.generatedBullets.length > 0) {
        const bullets = source.generatedBullets.slice(0, 5);
        while (bullets.length < 3) bullets.push(bullets[0]);
        copy.bulletSuggestions = bullets;
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

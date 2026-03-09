import { describe, expect, it } from 'vitest';
import { applyConcreteFallbackDetails } from '../actionDetails/concreteFallback';

const baseV2Details = {
  version: 'action_details_v2' as const,
  whyThisMatters: 'Base',
  howToSteps: ['Passo 1', 'Passo 2', 'Passo 3'],
  doThisNow: ['Agora 1', 'Agora 2', 'Agora 3'],
  benchmark: { available: false },
};

describe('ActionDetails concrete fallback', () => {
  it('preenche fallback concreto de titulo quando artifacts uteis estiverem ausentes', () => {
    const enriched = applyConcreteFallbackDetails({
      actionKey: 'seo_title_refresh',
      schemaVersion: 'v2',
      details: baseV2Details,
      analysisPayload: {
        seoSuggestions: {
          suggestedTitle: 'Notebook i5 16GB SSD 512GB Tela Full HD',
          titleRationale: 'Inclui termos de busca principais',
        },
        analysisV21: {
          title_fix: {
            before: 'Notebook',
            after: 'Notebook i5 16GB SSD 512GB Tela Full HD',
            problem: 'Titulo atual e generico',
          },
        },
      },
    });

    const copy = (enriched as any).artifacts?.copy;
    expect(copy?.titleSuggestions?.length).toBeGreaterThanOrEqual(3);
    expect(copy?.titleSuggestions?.[0]?.text).toContain('Notebook i5 16GB');
  });

  it('preenche fallback concreto de descricao com copy e bullets', () => {
    const enriched = applyConcreteFallbackDetails({
      actionKey: 'seo_description_blocks',
      schemaVersion: 'v2',
      details: baseV2Details,
      analysisPayload: {
        analysisV21: {
          description_fix: {
            diagnostic: 'Descricao atual superficial',
            optimized_copy: 'Headline forte.\n\nBloco com beneficios.\n\nBloco com garantia.',
          },
        },
        generatedContent: {
          bullets: ['Beneficio 1', 'Beneficio 2', 'Beneficio 3'],
          seoDescription: {
            long: 'Descricao longa alternativa',
          },
        },
      },
    });

    const copy = (enriched as any).artifacts?.copy;
    expect(copy?.descriptionTemplate?.blocks?.length).toBeGreaterThanOrEqual(2);
    expect(copy?.bulletSuggestions?.length).toBeGreaterThanOrEqual(3);
  });

  it('preenche fallback concreto de imagens com plano ordenado', () => {
    const enriched = applyConcreteFallbackDetails({
      actionKey: 'midia_gallery_upgrade',
      schemaVersion: 'v2',
      details: baseV2Details,
      analysisPayload: {
        analysisV21: {
          image_plan: [
            { image: 2, action: 'Close do detalhe tecnico' },
            { image: 1, action: 'Capa com produto principal' },
            { image: 3, action: 'Produto em uso real' },
          ],
        },
      },
    });

    const gallery = (enriched as any).artifacts?.media?.galleryPlan;
    expect(gallery?.length).toBeGreaterThanOrEqual(6);
    expect(gallery?.[0]?.whatToShow).toContain('Capa com produto principal');
    expect(gallery?.[1]?.whatToShow).toContain('Close do detalhe tecnico');
  });
});


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
  it('seo_title_refresh prioriza analysisV21.title_fix.after e gera copy executavel', () => {
    const enriched = applyConcreteFallbackDetails({
      actionKey: 'seo_title_refresh',
      schemaVersion: 'v2',
      details: baseV2Details,
      analysisPayload: {
        seoSuggestions: {
          suggestedTitle: 'Titulo vindo de seoSuggestions',
          titleRationale: 'Inclui termos de busca principais',
        },
        analysisV21: {
          title_fix: {
            before: 'Notebook',
            after: 'Notebook Gamer i7 16GB SSD 1TB RTX Tela 144Hz',
            problem: 'Titulo atual e generico',
          },
        },
        generatedContent: {
          titles: ['Titulo alternativo 1', 'Titulo alternativo 2'],
        },
      },
    });

    const copy = (enriched as any).artifacts?.copy;
    expect(copy?.titleSuggestions?.length).toBeGreaterThanOrEqual(3);
    expect(copy?.titleSuggestions?.[0]?.text).toContain('Notebook Gamer i7');
    expect(copy?.titleSuggestions?.[0]?.rationale).toContain('Título atual: Notebook');
    expect(copy?.titleSuggestions?.[0]?.rationale).toContain('Motivo: Titulo atual e generico');
    expect(copy?.keywordSuggestions?.length).toBeGreaterThanOrEqual(3);
  });

  it('seo_title_refresh usa seoSuggestions.suggestedTitle quando title_fix.after nao existe', () => {
    const enriched = applyConcreteFallbackDetails({
      actionKey: 'seo_title_refresh',
      schemaVersion: 'v2',
      details: baseV2Details,
      analysisPayload: {
        seoSuggestions: {
          suggestedTitle: 'Smart TV 50 Polegadas 4K UHD HDR Wi-Fi',
          titleRationale: 'Melhor alinhamento com busca real',
        },
      },
    });

    const copy = (enriched as any).artifacts?.copy;
    expect(copy?.titleSuggestions?.[0]?.text).toContain('Smart TV 50 Polegadas 4K');
    expect(copy?.titleSuggestions?.[0]?.rationale).toContain('Motivo: Melhor alinhamento com busca real');
  });

  it('seo_description_blocks prioriza analysisV21.description_fix.optimized_copy', () => {
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
            long: 'Descricao longa alternativa secundaria',
          },
        },
      },
    });

    const copy = (enriched as any).artifacts?.copy;
    expect(copy?.descriptionTemplate?.blocks?.length).toBeGreaterThanOrEqual(2);
    expect(copy?.descriptionTemplate?.blocks?.join(' ')).toContain('Headline forte');
    expect(copy?.bulletSuggestions?.length).toBeGreaterThanOrEqual(3);
    expect(copy?.descriptionTemplate?.cta).toContain('analysisV21.description_fix.optimized_copy');
    expect(copy?.descriptionTemplate?.cta).toContain('Fallback secundário');
  });

  it('seo_description_blocks usa generatedContent.seoDescription.long como fallback', () => {
    const enriched = applyConcreteFallbackDetails({
      actionKey: 'seo_description_blocks',
      schemaVersion: 'v2',
      details: baseV2Details,
      analysisPayload: {
        generatedContent: {
          seoDescription: {
            long: 'Descricao longa pronta para colar no anuncio. Com prova social. E garantia.',
          },
          bullets: ['Entrega rapida', 'Garantia oficial', 'Suporte no pos-venda'],
        },
      },
    });

    const copy = (enriched as any).artifacts?.copy;
    expect(copy?.descriptionTemplate?.blocks?.join(' ')).toContain('Descricao longa pronta para colar no anuncio');
    expect(copy?.descriptionTemplate?.cta).toContain('generatedContent.seoDescription.long');
    expect(copy?.bulletSuggestions?.length).toBeGreaterThanOrEqual(3);
  });

  it('nao mantem texto generico quando existe material concreto para titulo e descricao', () => {
    const enrichedTitle = applyConcreteFallbackDetails({
      actionKey: 'seo_title_refresh',
      schemaVersion: 'v2',
      details: {
        ...baseV2Details,
        artifacts: {
          copy: {
            titleSuggestions: [
              { variation: 'A', text: 'Melhore seu titulo', rationale: 'Genérico' },
              { variation: 'B', text: 'Otimize para SEO' },
              { variation: 'C', text: 'Ajuste o anuncio' },
            ],
          },
        },
      } as any,
      analysisPayload: {
        analysisV21: {
          title_fix: {
            before: 'Notebook',
            after: 'Notebook Dell i5 16GB SSD 512GB Full HD',
            problem: 'Falta especificidade',
          },
        },
      },
    });

    const enrichedDescription = applyConcreteFallbackDetails({
      actionKey: 'seo_description_blocks',
      schemaVersion: 'v2',
      details: {
        ...baseV2Details,
        artifacts: {
          copy: {
            descriptionTemplate: {
              headline: 'Melhore sua descrição',
              blocks: ['Texto genérico 1', 'Texto genérico 2'],
            },
          },
        },
      } as any,
      analysisPayload: {
        analysisV21: {
          description_fix: {
            diagnostic: 'Falta prova de valor',
            optimized_copy: 'Bloco concreto 1.\n\nBloco concreto 2.',
          },
        },
      },
    });

    expect((enrichedTitle as any).artifacts?.copy?.titleSuggestions?.[0]?.text).toContain('Notebook Dell i5');
    expect((enrichedDescription as any).artifacts?.copy?.descriptionTemplate?.blocks?.join(' ')).toContain('Bloco concreto 1');
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

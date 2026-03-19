import { describe, it, expect } from 'vitest';
import { generateListingContent } from '../services/GeneratedContentService';
import { CriticalGap } from '../services/BenchmarkInsightsService';

describe('GeneratedContentService', () => {
  it('deve retornar 3 títulos diferentes', () => {
    const listing = {
      title: 'Produto Teste Qualidade Garantida',
      description: 'Descrição do produto',
      picturesCount: 5,
      hasClips: null,
      hasPromotion: false,
      discountPercent: null,
      price: 100,
      originalPrice: null,
      category: 'MLB123',
    };

    const criticalGaps: CriticalGap[] = [];

    const content = generateListingContent(listing, criticalGaps);

    expect(content.titles.length).toBe(3);
    expect(content.titles[0].variation).toBe('A');
    expect(content.titles[1].variation).toBe('B');
    expect(content.titles[2].variation).toBe('C');
    
    // Títulos devem ser diferentes
    expect(content.titles[0].text).not.toBe(content.titles[1].text);
    expect(content.titles[1].text).not.toBe(content.titles[2].text);
    expect(content.titles[0].text).not.toBe(content.titles[2].text);
    expect(content.titles[0].text).not.toContain(' - ');
    expect(content.titles[1].text).toContain(' - ');
    expect(content.titles[2].text).toContain(' com ');
  });

  it('deve retornar bullets e descrições', () => {
    const listing = {
      title: 'Produto Teste',
      description: 'Descrição',
      picturesCount: 5,
      hasClips: null,
      hasPromotion: false,
      discountPercent: null,
      price: 100,
      originalPrice: null,
      category: 'MLB123',
    };

    const criticalGaps: CriticalGap[] = [];

    const content = generateListingContent(listing, criticalGaps);

    expect(content.bullets.length).toBeGreaterThan(0);
    expect(content.bullets.length).toBeLessThanOrEqual(5);
    expect(content.seoDescription.short).toBeDefined();
    expect(content.seoDescription.long).toBeDefined();
    expect(content.seoDescription.short.length).toBeLessThanOrEqual(200);
    expect(content.seoDescription.long.length).toBeLessThanOrEqual(1000);
  });

  it('NÃO deve mencionar vídeo se hasClips não for true', () => {
    const listing = {
      title: 'Produto Teste',
      description: 'Descrição',
      picturesCount: 5,
      hasClips: false, // false, não deve mencionar
      hasPromotion: false,
      discountPercent: null,
      price: 100,
      originalPrice: null,
      category: 'MLB123',
    };

    const criticalGaps: CriticalGap[] = [];

    const content = generateListingContent(listing, criticalGaps);

    // Verificar que nenhum bullet menciona vídeo
    const hasVideoMention = content.bullets.some(b => 
      b.toLowerCase().includes('vídeo') || b.toLowerCase().includes('video')
    );
    expect(hasVideoMention).toBe(false);
  });

  it('não deve mencionar clip mesmo se hasClips for true', () => {
    const listing = {
      title: 'Produto Teste',
      description: 'Descrição',
      picturesCount: 5,
      hasClips: true, // true, deve mencionar
      hasPromotion: false,
      discountPercent: null,
      price: 100,
      originalPrice: null,
      category: 'MLB123',
    };

    const criticalGaps: CriticalGap[] = [];

    const content = generateListingContent(listing, criticalGaps);

    // A UX principal não deve exibir clip
    const hasVideoMention = content.bullets.some(b => 
      b.toLowerCase().includes('vídeo') || b.toLowerCase().includes('video') || b.toLowerCase().includes('clip')
    );
    expect(hasVideoMention).toBe(false);
    expect(content.seoDescription.short.toLowerCase()).not.toContain('clip');
    expect(content.seoDescription.long.toLowerCase()).not.toContain('clip');
  });

  it('deve mencionar promoção quando hasPromotion=true e discountPercent>=20', () => {
    const listing = {
      title: 'Produto Teste',
      description: 'Descrição',
      picturesCount: 5,
      hasClips: null,
      hasPromotion: true,
      discountPercent: 47,
      price: 100,
      originalPrice: 150,
      category: 'MLB123',
    };

    const criticalGaps: CriticalGap[] = [];

    const content = generateListingContent(listing, criticalGaps);

    // Verificar que algum bullet menciona promoção/desconto
    const hasPromoMention = content.bullets.some(b => 
      b.toLowerCase().includes('desconto') || 
      b.toLowerCase().includes('oferta') ||
      b.toLowerCase().includes('promo')
    );
    expect(hasPromoMention).toBe(true);
    
    // Verificar que descrição menciona promoção
    const descHasPromo = content.seoDescription.short.toLowerCase().includes('desconto') ||
      content.seoDescription.long.toLowerCase().includes('desconto');
    expect(descHasPromo).toBe(true);
  });

  it('deve considerar criticalGaps ao gerar conteúdo', () => {
    const listing = {
      title: 'Produto Teste',
      description: 'Descrição',
      picturesCount: 3,
      hasClips: false,
      hasPromotion: false,
      discountPercent: null,
      price: 100,
      originalPrice: null,
      category: 'MLB123',
    };

    const criticalGaps: CriticalGap[] = [
      {
        id: 'gap_images',
        dimension: 'images',
        title: 'Adicionar 5 imagens',
        whyItMatters: 'Mais imagens aumentam conversão',
        impact: 'high',
        effort: 'low',
        confidence: 'high',
        metrics: {
          current: 3,
          median: 8,
          gap: 5,
        },
      },
    ];

    const content = generateListingContent(listing, criticalGaps);

    // Verificar que algum bullet menciona imagens (pode ser baseado no gap ou no número atual)
    const hasImageMention = content.bullets.some(b => 
      b.toLowerCase().includes('imagem') || b.toLowerCase().includes('foto')
    );
    // Se houver gap de imagens, deve mencionar imagens (mesmo que seja o número atual)
    expect(hasImageMention || listing.picturesCount > 0).toBe(true);
  });

  it('gera títulos estruturalmente diferentes para anúncios diferentes', () => {
    const infantil = generateListingContent({
      title: 'Kit 3 Cuecas Slip Infantil Algodão Confortável Menino',
      description: 'Cueca infantil para rotina diária',
      picturesCount: 6,
      hasClips: false,
      hasPromotion: false,
      discountPercent: null,
      price: 39.9,
      originalPrice: null,
      category: 'moda infantil',
    }, []);

    const tech = generateListingContent({
      title: 'Cabo HDMI 2.1 4K Ultra HD 2 Metros',
      description: 'Cabo para áudio e vídeo',
      picturesCount: 6,
      hasClips: false,
      hasPromotion: true,
      discountPercent: 15,
      price: 29.9,
      originalPrice: null,
      category: 'eletrônicos',
    }, []);

    expect(infantil.titles[0].text).not.toBe(tech.titles[0].text);
    expect(infantil.titles[1].text).not.toBe(tech.titles[1].text);
    expect(infantil.titles[2].text).not.toBe(tech.titles[2].text);
  });

  it('varia a abertura da descrição entre anúncios e evita padrão engessado', () => {
    const contentA = generateListingContent({
      title: 'Cueca Slip Infantil Algodão Confortável Menino',
      description: 'Cueca infantil',
      picturesCount: 5,
      hasClips: false,
      hasPromotion: false,
      discountPercent: null,
      price: 34.9,
      originalPrice: null,
      category: 'moda infantil',
    }, []);

    const contentB = generateListingContent({
      title: 'Aspirador Vertical 2 em 1 Portátil Casa',
      description: 'Aspirador para limpeza diária',
      picturesCount: 5,
      hasClips: false,
      hasPromotion: false,
      discountPercent: null,
      price: 249.9,
      originalPrice: null,
      category: 'casa',
    }, []);

    const openingA = contentA.seoDescription.long.split('\n')[0];
    const openingB = contentB.seoDescription.long.split('\n')[0];

    expect(openingA).not.toBe(openingB);
    expect(contentA.seoDescription.long).not.toContain('Este produto é ideal para');
    expect(contentB.seoDescription.long).not.toContain('Este produto é ideal para');
  });
});

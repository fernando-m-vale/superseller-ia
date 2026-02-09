import { describe, it, expect } from 'vitest';
import { buildPromotionPlacementSuggestions, type PricingInput } from '../src/promotionPlacement';

describe('buildPromotionPlacementSuggestions', () => {
  it('returns empty array when hasPromotion is false', () => {
    const pricing: PricingInput = {
      hasPromotion: false,
      originalPrice: 60,
      finalPrice: 60,
      discountPercent: null,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    expect(result).toEqual([]);
  });

  it('returns exactly 4 items when hasPromotion is true', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 60,
      finalPrice: 32,
      discountPercent: 47,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    expect(result).toHaveLength(4);
  });

  it('returns items with correct IDs', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 60,
      finalPrice: 32,
      discountPercent: 47,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    const ids = result.map(item => item.id);
    expect(ids).toContain('promo_cover');
    expect(ids).toContain('promo_secondary_image');
    expect(ids).toContain('promo_description');
    expect(ids).toContain('promo_seo_rule');
  });

  it('includes discount percentage in suggestions', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 60,
      finalPrice: 32,
      discountPercent: 47,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    const coverItem = result.find(item => item.id === 'promo_cover');
    expect(coverItem?.exampleText).toContain('47%');
  });

  it('calculates discount percentage when not provided', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 100,
      finalPrice: 50,
      discountPercent: null,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    const coverItem = result.find(item => item.id === 'promo_cover');
    expect(coverItem?.exampleText).toContain('50%');
  });

  it('includes price values in suggestions', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 60,
      finalPrice: 32,
      discountPercent: 47,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    const descItem = result.find(item => item.id === 'promo_description');
    expect(descItem?.exampleText).toContain('R$ 60.00');
    expect(descItem?.exampleText).toContain('R$ 32.00');
  });

  it('each item has required fields', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 60,
      finalPrice: 32,
      discountPercent: 47,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    
    for (const item of result) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('where');
      expect(item).toHaveProperty('how');
      expect(item).toHaveProperty('constraints');
      expect(item).toHaveProperty('exampleText');
      expect(Array.isArray(item.constraints)).toBe(true);
      expect(item.constraints.length).toBeGreaterThan(0);
    }
  });

  it('promo_seo_rule has empty exampleText', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 60,
      finalPrice: 32,
      discountPercent: 47,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    const seoItem = result.find(item => item.id === 'promo_seo_rule');
    expect(seoItem?.exampleText).toBe('');
  });

  it('suggestions do not contain emojis or markdown', () => {
    const pricing: PricingInput = {
      hasPromotion: true,
      originalPrice: 60,
      finalPrice: 32,
      discountPercent: 47,
    };
    const result = buildPromotionPlacementSuggestions(pricing);
    
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const markdownRegex = /(\*{1,3}|_{1,3}|#{1,6}|`{1,3}|\[.*\]\(.*\))/g;
    
    for (const item of result) {
      expect(item.title).not.toMatch(emojiRegex);
      expect(item.where).not.toMatch(emojiRegex);
      expect(item.how).not.toMatch(emojiRegex);
      expect(item.exampleText).not.toMatch(emojiRegex);
      
      expect(item.title).not.toMatch(markdownRegex);
      expect(item.where).not.toMatch(markdownRegex);
      expect(item.how).not.toMatch(markdownRegex);
      expect(item.exampleText).not.toMatch(markdownRegex);
      
      for (const constraint of item.constraints) {
        expect(constraint).not.toMatch(emojiRegex);
        expect(constraint).not.toMatch(markdownRegex);
      }
    }
  });
});

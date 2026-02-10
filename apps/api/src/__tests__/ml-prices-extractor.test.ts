import { describe, it, expect } from 'vitest';
import { applyBuyerPricesOverrideFromMlPrices, extractBuyerPricesFromMlPrices } from '../utils/ml-prices-extractor';

describe('extractBuyerPricesFromMlPrices', () => {
  it('deve extrair preços quando há promoção válida', () => {
    const payload = {
      prices: [
        {
          type: 'standard',
          amount: 100,
          currency_id: 'BRL',
        },
        {
          type: 'promotion',
          amount: 66.93,
          regular_amount: 100,
          currency_id: 'BRL',
        },
      ],
    };

    const result = extractBuyerPricesFromMlPrices(payload);

    expect(result.hasPromotionEffective).toBe(true);
    expect(result.originalPrice).toBe(100);
    expect(result.promotionalPrice).toBe(66.93);
    expect(result.discountPercent).toBe(33); // round(((100 - 66.93) / 100) * 100) = 33
  });

  it('deve retornar sem promoção quando não há entrada promotion', () => {
    const payload = {
      prices: [
        {
          type: 'standard',
          amount: 100,
          currency_id: 'BRL',
        },
      ],
    };

    const result = extractBuyerPricesFromMlPrices(payload);

    expect(result.hasPromotionEffective).toBe(false);
    expect(result.originalPrice).toBe(100);
    expect(result.promotionalPrice).toBe(100); // Sem promoção, usa preço regular
    expect(result.discountPercent).toBeUndefined();
  });

  it('deve retornar sem promoção quando promotion.amount >= regular', () => {
    const payload = {
      prices: [
        {
          type: 'standard',
          amount: 100,
          currency_id: 'BRL',
        },
        {
          type: 'promotion',
          amount: 100, // Igual ao regular
          regular_amount: 100,
          currency_id: 'BRL',
        },
      ],
    };

    const result = extractBuyerPricesFromMlPrices(payload);

    expect(result.hasPromotionEffective).toBe(false);
    expect(result.originalPrice).toBe(100);
    expect(result.promotionalPrice).toBe(100);
  });

  it('deve usar promotion.regular_amount quando disponível', () => {
    const payload = {
      prices: [
        {
          type: 'promotion',
          amount: 66.93,
          regular_amount: 100, // Usar este como original
          currency_id: 'BRL',
        },
      ],
    };

    const result = extractBuyerPricesFromMlPrices(payload);

    expect(result.hasPromotionEffective).toBe(true);
    expect(result.originalPrice).toBe(100); // Usa regular_amount
    expect(result.promotionalPrice).toBe(66.93);
    expect(result.discountPercent).toBe(33);
  });

  it('deve retornar objeto vazio quando prices não existe', () => {
    const payload = {};

    const result = extractBuyerPricesFromMlPrices(payload);

    expect(result.hasPromotionEffective).toBe(false);
    expect(result.originalPrice).toBeUndefined();
    expect(result.promotionalPrice).toBeUndefined();
  });

  it('deve retornar objeto vazio quando prices não é array', () => {
    const payload = {
      prices: null,
    };

    const result = extractBuyerPricesFromMlPrices(payload);

    expect(result.hasPromotionEffective).toBe(false);
  });
});

describe('applyBuyerPricesOverrideFromMlPrices', () => {
  it('deve sobrescrever promoção do /items quando /prices indicar valor menor (regressão MLB4167251409)', () => {
    // Simula cálculo atual vindo do /items: original 100, promo 70.23 (stale)
    const current = {
      priceFinal: 70.23,
      originalPrice: 100,
      discountPercent: 30,
      hasPromotion: true,
    };

    // Source of truth do comprador (/prices): promo 66.93 com regular 100
    const payload = {
      prices: [
        { type: 'standard', amount: 100, currency_id: 'BRL' },
        { type: 'promotion', amount: 66.93, regular_amount: 100, currency_id: 'BRL' },
      ],
    };

    const res = applyBuyerPricesOverrideFromMlPrices(current, payload);

    expect(res.applied).toBe(true);
    expect(res.next.hasPromotion).toBe(true);
    expect(res.next.originalPrice).toBe(100);
    expect(res.next.priceFinal).toBe(66.93);
    expect(res.next.discountPercent).toBe(33);
  });

  it('não deve aplicar override quando não há promoção efetiva no /prices', () => {
    const current = {
      priceFinal: 70.23,
      originalPrice: 100,
      discountPercent: 30,
      hasPromotion: true,
    };

    const payload = {
      prices: [{ type: 'standard', amount: 100, currency_id: 'BRL' }],
    };

    const res = applyBuyerPricesOverrideFromMlPrices(current, payload);
    expect(res.applied).toBe(false);
    expect(res.next).toEqual(current);
  });
});

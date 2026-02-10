import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shouldFetchMlPricesForPromo, getPromoPricesTtlHours } from '../utils/ml-prices-ttl';

describe('shouldFetchMlPricesForPromo', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar false quando flag USE_ML_PRICES_FOR_PROMO não está ativa', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'false';
    
    const result = shouldFetchMlPricesForPromo(null);
    
    expect(result).toBe(false);
  });

  it('deve retornar true quando flag está ativa e listing é null (nunca verificado)', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    
    const result = shouldFetchMlPricesForPromo(null);
    
    expect(result).toBe(true);
  });

  it('deve retornar true quando flag está ativa e promotion_checked_at é null', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    
    const listing = { promotion_checked_at: null };
    const result = shouldFetchMlPricesForPromo(listing);
    
    expect(result).toBe(true);
  });

  it('deve retornar false quando TTL ainda não expirou (recente)', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    process.env.PROMO_PRICES_TTL_HOURS = '12';
    
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 horas atrás (menos que 12h)
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now);
    
    expect(result).toBe(false);
  });

  it('deve retornar true quando TTL expirou (antigo)', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    process.env.PROMO_PRICES_TTL_HOURS = '12';
    
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13 horas atrás (mais que 12h)
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now);
    
    expect(result).toBe(true);
  });

  it('deve retornar true quando diferença é exatamente igual ao TTL', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    process.env.PROMO_PRICES_TTL_HOURS = '12';
    
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 12 * 60 * 60 * 1000); // Exatamente 12 horas atrás
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now);
    
    expect(result).toBe(true);
  });

  it('deve usar TTL padrão (12h) quando PROMO_PRICES_TTL_HOURS não está definido', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    delete process.env.PROMO_PRICES_TTL_HOURS;
    
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13 horas atrás
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now);
    
    expect(result).toBe(true);
  });

  it('deve usar TTL padrão quando PROMO_PRICES_TTL_HOURS é inválido', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    process.env.PROMO_PRICES_TTL_HOURS = 'invalid';
    
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13 horas atrás
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now);
    
    expect(result).toBe(true);
  });
});

describe('getPromoPricesTtlHours', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar 12 quando PROMO_PRICES_TTL_HOURS não está definido', () => {
    delete process.env.PROMO_PRICES_TTL_HOURS;
    
    const result = getPromoPricesTtlHours();
    
    expect(result).toBe(12);
  });

  it('deve retornar valor configurado quando PROMO_PRICES_TTL_HOURS é válido', () => {
    process.env.PROMO_PRICES_TTL_HOURS = '24';
    
    const result = getPromoPricesTtlHours();
    
    expect(result).toBe(24);
  });

  it('deve retornar 12 quando PROMO_PRICES_TTL_HOURS é inválido', () => {
    process.env.PROMO_PRICES_TTL_HOURS = 'invalid';
    
    const result = getPromoPricesTtlHours();
    
    expect(result).toBe(12);
  });

  it('deve retornar 12 quando PROMO_PRICES_TTL_HOURS é zero ou negativo', () => {
    process.env.PROMO_PRICES_TTL_HOURS = '0';
    
    const result = getPromoPricesTtlHours();
    
    expect(result).toBe(12);
  });
});

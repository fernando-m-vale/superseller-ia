import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shouldFetchMlPricesForPromo } from '../utils/ml-prices-ttl';

describe('force-refresh TTL behavior', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.USE_ML_PRICES_FOR_PROMO = 'true';
    process.env.PROMO_PRICES_TTL_HOURS = '12';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar false quando TTL ainda válido (recente)', () => {
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 horas atrás
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now, false);
    
    expect(result).toBe(false);
  });

  it('deve retornar true quando TTL expirado (antigo)', () => {
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13 horas atrás
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now, false);
    
    expect(result).toBe(true);
  });

  it('deve retornar true quando forcePromoPrices=true mesmo com TTL válido', () => {
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 horas atrás (TTL ainda válido)
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now, true);
    
    expect(result).toBe(true);
  });

  it('deve retornar false quando flag USE_ML_PRICES_FOR_PROMO está desativada', () => {
    process.env.USE_ML_PRICES_FOR_PROMO = 'false';
    
    const now = new Date();
    const checkedAt = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13 horas atrás (TTL expirado)
    const listing = { promotion_checked_at: checkedAt };
    
    const result = shouldFetchMlPricesForPromo(listing, now, false);
    
    expect(result).toBe(false);
  });

  it('deve retornar true quando listing nunca foi verificado (promotion_checked_at null)', () => {
    const listing = { promotion_checked_at: null };
    
    const result = shouldFetchMlPricesForPromo(listing, new Date(), false);
    
    expect(result).toBe(true);
  });

  it('deve retornar true quando listing é null (não existe no DB)', () => {
    const result = shouldFetchMlPricesForPromo(null, new Date(), false);
    
    expect(result).toBe(true);
  });
});

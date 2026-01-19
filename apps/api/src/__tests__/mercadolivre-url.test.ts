/**
 * Mercado Livre URL Tests
 * 
 * Testa a normalização de MLB IDs e construção de URLs
 */

import { describe, it, expect } from 'vitest';
import { normalizeMlbId, buildMercadoLivreListingUrl } from '../utils/mercadolivre-url';

describe('normalizeMlbId', () => {
  it('deve extrair ID de formato MLB3923303743', () => {
    expect(normalizeMlbId('MLB3923303743')).toBe('3923303743');
  });

  it('deve extrair ID de formato apenas numérico', () => {
    expect(normalizeMlbId('3923303743')).toBe('3923303743');
  });

  it('deve extrair ID de formato MLB-3923303743', () => {
    expect(normalizeMlbId('MLB-3923303743')).toBe('3923303743');
  });

  it('deve retornar null para entrada vazia', () => {
    expect(normalizeMlbId(null)).toBe(null);
    expect(normalizeMlbId('')).toBe(null);
    expect(normalizeMlbId('   ')).toBe(null);
  });

  it('deve escolher o maior número quando houver múltiplos', () => {
    expect(normalizeMlbId('MLB3923303743abc123')).toBe('3923303743');
  });
});

describe('buildMercadoLivreListingUrl', () => {
  it('deve gerar URL de edição para MLB3923303743', () => {
    const url = buildMercadoLivreListingUrl('MLB3923303743', null, 'edit');
    expect(url).toBe('https://www.mercadolivre.com.br/anuncios/MLB3923303743/modificar/bomni');
  });

  it('deve gerar URL de edição para 3923303743 (sem prefixo)', () => {
    const url = buildMercadoLivreListingUrl('3923303743', null, 'edit');
    expect(url).toBe('https://www.mercadolivre.com.br/anuncios/MLB3923303743/modificar/bomni');
  });

  it('deve gerar URL de view para MLB3923303743', () => {
    const url = buildMercadoLivreListingUrl('MLB3923303743', null, 'view');
    expect(url).toBe('https://produto.mercadolivre.com.br/MLB-3923303743');
  });

  it('deve retornar null quando não houver ID válido', () => {
    expect(buildMercadoLivreListingUrl(null, null, 'edit')).toBe(null);
    expect(buildMercadoLivreListingUrl('', null, 'edit')).toBe(null);
    expect(buildMercadoLivreListingUrl('invalid', null, 'edit')).toBe(null);
  });

  it('deve usar permalink quando disponível (modo view)', () => {
    const permalink = 'https://produto.mercadolivre.com.br/MLB-3923303743-123456';
    const url = buildMercadoLivreListingUrl('MLB3923303743', permalink, 'view');
    expect(url).toBe(permalink);
  });

  it('deve priorizar permalink sobre listingIdExt no modo view', () => {
    const permalink = 'https://produto.mercadolivre.com.br/MLB-9999999999-123456';
    const url = buildMercadoLivreListingUrl('MLB3923303743', permalink, 'view');
    expect(url).toBe(permalink);
  });
});

import { describe, it, expect } from 'vitest';
import { buildSignals } from '../SignalsBuilder';

describe('SignalsBuilder - hasClips tri-state (HOTFIX 09.5)', () => {
  it('preserves hasClips === true', () => {
    const listing = {
      id: '00000000-0000-0000-0000-000000000001',
      tenant_id: 't1',
      marketplace: 'mercadolivre',
      listing_id_ext: 'MLB1234567890',
      title: 'Produto',
      status: 'active',
      category: 'MLB1234',
      price: 100,
      original_price: null,
      has_promotion: false,
      discount_percent: null,
      stock: 10,
      pictures_count: 8,
      has_video: true,
      has_clips: true,
      variations_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;

    const signals = buildSignals({ listing, pricing: { hasPromotion: false } });
    expect(signals.hasClips).toBe(true);
  });

  it('preserves hasClips === false', () => {
    const listing = {
      id: '00000000-0000-0000-0000-000000000002',
      tenant_id: 't1',
      marketplace: 'mercadolivre',
      listing_id_ext: 'MLB1234567890',
      title: 'Produto',
      status: 'active',
      category: 'MLB1234',
      price: 100,
      original_price: null,
      has_promotion: false,
      discount_percent: null,
      stock: 10,
      pictures_count: 8,
      has_video: false,
      has_clips: false,
      variations_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;

    const signals = buildSignals({ listing, pricing: { hasPromotion: false } });
    expect(signals.hasClips).toBe(false);
  });

  it('preserves hasClips === null (unknown)', () => {
    const listing = {
      id: '00000000-0000-0000-0000-000000000003',
      tenant_id: 't1',
      marketplace: 'mercadolivre',
      listing_id_ext: 'MLB1234567890',
      title: 'Produto',
      status: 'active',
      category: 'MLB1234',
      price: 100,
      original_price: null,
      has_promotion: false,
      discount_percent: null,
      stock: 10,
      pictures_count: 8,
      has_video: null,
      has_clips: null,
      variations_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;

    const signals = buildSignals({ listing, pricing: { hasPromotion: false } });
    expect(signals.hasClips).toBeNull();
  });
});


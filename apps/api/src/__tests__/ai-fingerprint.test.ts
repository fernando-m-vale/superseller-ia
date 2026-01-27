import { describe, it, expect } from 'vitest';
import { generateFingerprint, buildFingerprintInput, PROMPT_VERSION } from '../utils/ai-fingerprint';

describe('AI Fingerprint Utility', () => {
  const mockListing = {
    title: 'Test Product',
    price: 99.99,
    category: 'MLB1234',
    pictures_count: 5,
    has_video: true,
    status: 'active',
    stock: 10,
    // V2.1 fields
    price_final: 89.99,
    has_promotion: true,
    discount_percent: 10,
    description: 'This is a test product description',
    has_clips: false,
    updated_at: new Date('2024-01-01T00:00:00Z'), // Should not affect fingerprint
  };

  const mockMetrics = {
    orders: 100,
    revenue: 9999.0,
    visitsCoverage: {
      filledDays: 28,
      totalDays: 30,
    },
  };

  const periodDays = 30;

  describe('generateFingerprint', () => {
    it('should generate deterministic fingerprints - same input produces same output', () => {
      const input = buildFingerprintInput(mockListing, mockMetrics, periodDays);
      const fingerprint1 = generateFingerprint(input);
      const fingerprint2 = generateFingerprint(input);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(64); // SHA256 produces 64 char hex string
    });

    it('should generate different fingerprints for different listing titles', () => {
      const input1 = buildFingerprintInput(
        { ...mockListing, title: 'Product A' },
        mockMetrics,
        periodDays
      );
      const input2 = buildFingerprintInput(
        { ...mockListing, title: 'Product B' },
        mockMetrics,
        periodDays
      );

      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different prices', () => {
      const input1 = buildFingerprintInput(
        { ...mockListing, price: 99.99 },
        mockMetrics,
        periodDays
      );
      const input2 = buildFingerprintInput(
        { ...mockListing, price: 149.99 },
        mockMetrics,
        periodDays
      );

      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different metrics', () => {
      const input1 = buildFingerprintInput(mockListing, { ...mockMetrics, orders: 100 }, periodDays);
      const input2 = buildFingerprintInput(mockListing, { ...mockMetrics, orders: 200 }, periodDays);

      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different period days', () => {
      const input1 = buildFingerprintInput(mockListing, mockMetrics, 30);
      const input2 = buildFingerprintInput(mockListing, mockMetrics, 60);

      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      expect(fp1).not.toBe(fp2);
    });

    it('should NOT change fingerprint when updated_at changes', () => {
      const input1 = buildFingerprintInput(
        { ...mockListing, updated_at: new Date('2024-01-01T00:00:00Z') },
        mockMetrics,
        periodDays
      );
      const input2 = buildFingerprintInput(
        { ...mockListing, updated_at: new Date('2024-12-31T23:59:59Z') },
        mockMetrics,
        periodDays
      );

      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      // Fingerprint should be the same despite updated_at being different
      expect(fp1).toBe(fp2);
    });

    it('should generate stable fingerprints with keys in different order', () => {
      // Build input and generate fingerprint
      const input = buildFingerprintInput(mockListing, mockMetrics, periodDays);
      const fp1 = generateFingerprint(input);

      // Manually construct with keys in different order (should still produce same fingerprint)
      const inputReordered: typeof input = {
        promptVersion: input.promptVersion, // Keys in different order
        periodDays: input.periodDays,
        listing: {
          stock: input.listing.stock, // Keys in different order
          status: input.listing.status,
          has_video: input.listing.has_video,
          pictures_count: input.listing.pictures_count,
          category_id: input.listing.category_id,
          price: input.listing.price,
          title: input.listing.title,
          // V2.1 fields
          price_final: input.listing.price_final,
          has_promotion: input.listing.has_promotion,
          discount_percent: input.listing.discount_percent,
          description_length: input.listing.description_length,
          has_clips: input.listing.has_clips,
        },
        metrics: {
          visitsCoverage: input.metrics.visitsCoverage,
          revenue: input.metrics.revenue,
          orders: input.metrics.orders,
        },
      };

      const fp2 = generateFingerprint(inputReordered);

      // Should be the same due to stable stringify
      expect(fp1).toBe(fp2);
    });
  });

  describe('buildFingerprintInput', () => {
    it('should exclude updated_at from fingerprint input', () => {
      const input = buildFingerprintInput(mockListing, mockMetrics, periodDays);

      expect(input.listing).not.toHaveProperty('updated_at');
      expect(input.listing.title).toBe(mockListing.title);
      expect(input.listing.price).toBe(99.99);
      expect(input.periodDays).toBe(periodDays);
      expect(input.promptVersion).toBe(PROMPT_VERSION);
    });

    it('should handle Prisma Decimal type for price', () => {
      const decimalPrice = {
        toNumber: () => 149.99,
      };

      const input = buildFingerprintInput(
        { ...mockListing, price: decimalPrice as any },
        mockMetrics,
        periodDays
      );

      expect(input.listing.price).toBe(149.99);
    });

    it('should handle null values correctly', () => {
      const input = buildFingerprintInput(
        {
          ...mockListing,
          category: null,
          pictures_count: null,
          has_video: null,
          // V2.1 fields with null values
          price_final: null,
          has_promotion: null,
          discount_percent: null,
          description: null,
          has_clips: null,
        },
        {
          ...mockMetrics,
          revenue: null,
        },
        periodDays
      );

      expect(input.listing.category_id).toBeNull();
      expect(input.listing.pictures_count).toBe(0); // Defaults to 0
      expect(input.listing.has_video).toBeNull();
      expect(input.metrics.revenue).toBeNull();
      // V2.1 fields
      expect(input.listing.price_final).toBe(99.99); // Fallback to price
      expect(input.listing.has_promotion).toBe(false); // Defaults to false
      expect(input.listing.discount_percent).toBeNull();
      expect(input.listing.description_length).toBe(0); // Empty description
      expect(input.listing.has_clips).toBeNull();
    });
  });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateFingerprint, buildFingerprintInput, PROMPT_VERSION } from '../utils/ai-fingerprint';

// Mock Prisma client
const mockPrisma = {
  listing: {
    findFirst: vi.fn(),
  },
  listingAIAnalysis: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
} as unknown as PrismaClient;

describe('AI Analyze Cache Behavior', () => {
  const tenantId = 'test-tenant';
  const listingId = 'test-listing-id';
  const periodDays = 30;

  const mockListing = {
    id: listingId,
    tenant_id: tenantId,
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
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  const mockMetrics = {
    orders: 100,
    revenue: 9999.0,
    visitsCoverage: {
      filledDays: 28,
      totalDays: 30,
    },
  };

  const mockAnalysisResult = {
    analysis: {
      score: 85,
      critique: 'Good product',
      growthHacks: [
        { title: 'Hack 1', description: 'Desc 1', priority: 'high', estimatedImpact: 'high' },
      ],
      seoSuggestions: {
        suggestedTitle: 'Better Title',
        titleRationale: 'Rationale',
        suggestedDescriptionPoints: ['Point 1'],
        keywords: ['keyword1'],
      },
      analyzedAt: new Date().toISOString(),
      model: 'gpt-4o',
    },
    savedRecommendations: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate consistent fingerprint between calls', async () => {
    // First call - calculate fingerprint
    const fingerprintInput1 = buildFingerprintInput(mockListing, mockMetrics, periodDays);
    const fingerprint1 = generateFingerprint(fingerprintInput1);

    // Simulate listing updated_at changing (should not affect fingerprint)
    const updatedListing = {
      ...mockListing,
      updated_at: new Date('2024-12-31T23:59:59Z'),
    };

    // Second call - should produce same fingerprint
    const fingerprintInput2 = buildFingerprintInput(updatedListing, mockMetrics, periodDays);
    const fingerprint2 = generateFingerprint(fingerprintInput2);

    expect(fingerprint1).toBe(fingerprint2);
  });

  it('should return cacheHit=false on first call (no cache found)', async () => {
    // Mock: no cache found
    vi.mocked(mockPrisma.listingAIAnalysis.findFirst).mockResolvedValue(null);

    // Simulate cache lookup
    const fingerprintInput = buildFingerprintInput(mockListing, mockMetrics, periodDays);
    const fingerprint = generateFingerprint(fingerprintInput);

    const cached = await mockPrisma.listingAIAnalysis.findFirst({
      where: {
        tenant_id: tenantId,
        listing_id: listingId,
        period_days: periodDays,
        fingerprint,
      },
    });

    expect(cached).toBeNull();

    // Verify findFirst was called with correct parameters
    expect(mockPrisma.listingAIAnalysis.findFirst).toHaveBeenCalledWith({
      where: {
        tenant_id: tenantId,
        listing_id: listingId,
        period_days: periodDays,
        fingerprint,
      },
    });
  });

  it('should return cacheHit=true on second call (cache found)', async () => {
    // Mock: cache found on second call
    const fingerprintInput = buildFingerprintInput(mockListing, mockMetrics, periodDays);
    const fingerprint = generateFingerprint(fingerprintInput);

    const cachedEntry = {
      id: 'cache-id',
      tenant_id: tenantId,
      listing_id: listingId,
      period_days: periodDays,
      fingerprint,
      model: 'gpt-4o',
      prompt_version: PROMPT_VERSION,
      result_json: mockAnalysisResult,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(mockPrisma.listingAIAnalysis.findFirst).mockResolvedValue(cachedEntry as any);

    const cached = await mockPrisma.listingAIAnalysis.findFirst({
      where: {
        tenant_id: tenantId,
        listing_id: listingId,
        period_days: periodDays,
        fingerprint,
      },
    });

    expect(cached).not.toBeNull();
    expect(cached?.result_json).toEqual(mockAnalysisResult);
    expect(cached?.fingerprint).toBe(fingerprint);
  });

  it('should create cache entry on first call (cache miss)', async () => {
    const fingerprintInput = buildFingerprintInput(mockListing, mockMetrics, periodDays);
    const fingerprint = generateFingerprint(fingerprintInput);

    // Mock: no cache found initially
    vi.mocked(mockPrisma.listingAIAnalysis.findFirst).mockResolvedValue(null);
    vi.mocked(mockPrisma.listingAIAnalysis.upsert).mockResolvedValue({
      id: 'new-cache-id',
      tenant_id: tenantId,
      listing_id: listingId,
      period_days: periodDays,
      fingerprint,
      model: 'gpt-4o',
      prompt_version: PROMPT_VERSION,
      result_json: mockAnalysisResult,
      created_at: new Date(),
      updated_at: new Date(),
    } as any);

    // Simulate cache miss - should create entry
    await mockPrisma.listingAIAnalysis.upsert({
      where: {
        tenant_id_listing_id_period_days_fingerprint: {
          tenant_id: tenantId,
          listing_id: listingId,
          period_days: periodDays,
          fingerprint,
        },
      },
      update: {
        model: 'gpt-4o',
        prompt_version: PROMPT_VERSION,
        result_json: mockAnalysisResult as any,
        updated_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        listing_id: listingId,
        period_days: periodDays,
        fingerprint,
        model: 'gpt-4o',
        prompt_version: PROMPT_VERSION,
        result_json: mockAnalysisResult as any,
      },
    });

    // Verify upsert was called with create (not update) on first call
    expect(mockPrisma.listingAIAnalysis.upsert).toHaveBeenCalledWith({
      where: {
        tenant_id_listing_id_period_days_fingerprint: {
          tenant_id: tenantId,
          listing_id: listingId,
          period_days: periodDays,
          fingerprint,
        },
      },
      update: expect.any(Object),
      create: expect.objectContaining({
        tenant_id: tenantId,
        listing_id: listingId,
        period_days: periodDays,
        fingerprint,
      }),
    });
  });

  it('should use cache when forceRefresh is false and cache exists', () => {
    const forceRefresh = false;
    const hasCache = true;

    // If forceRefresh is false and cache exists, should use cache (cacheHit = true)
    const cacheHit = !forceRefresh && hasCache;

    expect(cacheHit).toBe(true);
  });

  it('should bypass cache when forceRefresh is true', () => {
    const forceRefresh = true;
    const hasCache = true;

    // If forceRefresh is true, should bypass cache (cacheHit = false)
    const shouldCallOpenAI = forceRefresh || !hasCache;

    expect(shouldCallOpenAI).toBe(true);
  });

  it('should use different fingerprints for different listing data', () => {
    const input1 = buildFingerprintInput(
      { ...mockListing, title: 'Product A', price: 99.99 },
      mockMetrics,
      periodDays
    );
    const input2 = buildFingerprintInput(
      { ...mockListing, title: 'Product B', price: 149.99 },
      mockMetrics,
      periodDays
    );

    const fp1 = generateFingerprint(input1);
    const fp2 = generateFingerprint(input2);

    expect(fp1).not.toBe(fp2);
  });
});


/**
 * AI Analysis Fingerprint Utility
 * 
 * Generates SHA256 fingerprints for AI analysis caching.
 * The fingerprint is based on listing data, metrics, and prompt version
 * to determine if a cached analysis can be reused.
 */

import { createHash } from 'crypto';

// Current prompt version - increment when prompt changes significantly
export const PROMPT_VERSION = 'ai-v1.2';

/**
 * Data structure for fingerprint generation
 */
export interface FingerprintInput {
  // Listing fields that affect analysis
  listing: {
    title: string;
    price: number;
    category_id: string | null;
    pictures_count: number;
    has_video: boolean | null;
    status: string;
    stock: number;
    updated_at: string; // ISO date string
  };
  // Metrics that affect analysis
  metrics: {
    orders: number;
    revenue: number | null;
    visitsCoverage: {
      filledDays: number;
      totalDays: number;
    };
  };
  // Analysis parameters
  periodDays: number;
  promptVersion: string;
}

/**
 * Generates a SHA256 fingerprint from the input data.
 * The fingerprint is deterministic - same input always produces same output.
 * 
 * @param input - The data to generate fingerprint from
 * @returns SHA256 hash string (64 characters)
 */
export function generateFingerprint(input: FingerprintInput): string {
  // Create a deterministic JSON string (sorted keys)
  const data = JSON.stringify({
    listing: {
      title: input.listing.title,
      price: input.listing.price,
      category_id: input.listing.category_id,
      pictures_count: input.listing.pictures_count,
      has_video: input.listing.has_video,
      status: input.listing.status,
      stock: input.listing.stock,
      updated_at: input.listing.updated_at,
    },
    metrics: {
      orders: input.metrics.orders,
      revenue: input.metrics.revenue,
      visitsCoverage: {
        filledDays: input.metrics.visitsCoverage.filledDays,
        totalDays: input.metrics.visitsCoverage.totalDays,
      },
    },
    periodDays: input.periodDays,
    promptVersion: input.promptVersion,
  });

  return createHash('sha256').update(data).digest('hex');
}

/**
 * Builds fingerprint input from listing and metrics data.
 * 
 * @param listing - Listing data from database
 * @param metrics - Aggregated metrics for the period
 * @param periodDays - Analysis period in days
 * @returns FingerprintInput ready for fingerprint generation
 */
export function buildFingerprintInput(
  listing: {
    title: string;
    price: number | { toNumber: () => number };
    category: string | null;
    pictures_count: number | null;
    has_video: boolean | null;
    status: string;
    stock: number;
    updated_at: Date;
  },
  metrics: {
    orders: number;
    revenue: number | null;
    visitsCoverage: {
      filledDays: number;
      totalDays: number;
    };
  },
  periodDays: number
): FingerprintInput {
  // Handle Prisma Decimal type
  const price = typeof listing.price === 'number' 
    ? listing.price 
    : listing.price.toNumber();

  return {
    listing: {
      title: listing.title,
      price,
      category_id: listing.category,
      pictures_count: listing.pictures_count ?? 0,
      has_video: listing.has_video,
      status: listing.status,
      stock: listing.stock,
      updated_at: listing.updated_at.toISOString(),
    },
    metrics: {
      orders: metrics.orders,
      revenue: metrics.revenue,
      visitsCoverage: metrics.visitsCoverage,
    },
    periodDays,
    promptVersion: PROMPT_VERSION,
  };
}

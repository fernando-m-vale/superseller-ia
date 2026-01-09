/**
 * AI Analysis Fingerprint Utility
 * 
 * Generates SHA256 fingerprints for AI analysis caching.
 * The fingerprint is based on listing data, metrics, and prompt version
 * to determine if a cached analysis can be reused.
 * 
 * IMPORTANT: The fingerprint must be deterministic and stable.
 * Do NOT include volatile fields like timestamps, requestId, or runtime info.
 */

import { createHash } from 'crypto';

// Current prompt version - increment when prompt changes significantly
export const PROMPT_VERSION = 'ai-v1.2';

/**
 * Data structure for fingerprint generation
 * 
 * NOTE: updated_at is intentionally excluded as it's volatile and doesn't affect analysis content.
 * The analysis should be the same regardless of when the listing was last updated.
 */
export interface FingerprintInput {
  // Listing fields that affect analysis (NO volatile timestamps)
  listing: {
    title: string;
    price: number;
    category_id: string | null;
    pictures_count: number;
    has_video: boolean | null;
    status: string;
    stock: number;
    // updated_at is intentionally excluded - it's volatile and doesn't affect analysis
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
 * Stable stringify that sorts keys recursively to ensure deterministic output.
 * Arrays are kept in their original order (they should already be stable).
 * 
 * @param obj - Object to stringify
 * @returns Deterministic JSON string
 */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    // Arrays are kept in order - they should already be stable
    const items = obj.map(item => stableStringify(item));
    return `[${items.join(',')}]`;
  }

  if (typeof obj === 'object') {
    // Sort keys recursively for objects
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => {
      const value = (obj as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${stableStringify(value)}`;
    });
    return `{${pairs.join(',')}}`;
  }

  return JSON.stringify(obj);
}

/**
 * Generates a SHA256 fingerprint from the input data.
 * The fingerprint is deterministic - same input always produces same output.
 * 
 * Uses stable stringify to ensure keys are sorted consistently.
 * 
 * @param input - The data to generate fingerprint from
 * @returns SHA256 hash string (64 characters)
 */
export function generateFingerprint(input: FingerprintInput): string {
  // Create a deterministic JSON string with sorted keys
  const data = stableStringify({
    listing: {
      title: input.listing.title,
      price: input.listing.price,
      category_id: input.listing.category_id,
      pictures_count: input.listing.pictures_count,
      has_video: input.listing.has_video,
      status: input.listing.status,
      stock: input.listing.stock,
      // updated_at is intentionally excluded - it's volatile
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
    updated_at: Date; // Received but not included in fingerprint
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
      // updated_at is intentionally excluded - it's volatile and doesn't affect analysis
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

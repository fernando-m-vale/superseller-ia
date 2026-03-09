export type AnalysisStatus = 'generating' | 'completed' | 'failed';

interface StatusEntry {
  status: AnalysisStatus;
  updatedAt: number;
}

const STATUS_TTL_MS = 30 * 60 * 1000;

class AnalysisStatusTracker {
  private readonly byKey = new Map<string, StatusEntry>();

  private makeKey(tenantId: string, listingId: string): string {
    return `${tenantId}:${listingId}`;
  }

  setStatus(tenantId: string, listingId: string, status: AnalysisStatus): void {
    this.byKey.set(this.makeKey(tenantId, listingId), {
      status,
      updatedAt: Date.now(),
    });
  }

  getStatus(tenantId: string, listingId: string): AnalysisStatus | null {
    const key = this.makeKey(tenantId, listingId);
    const entry = this.byKey.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.updatedAt > STATUS_TTL_MS) {
      this.byKey.delete(key);
      return null;
    }

    return entry.status;
  }
}

export const analysisStatusTracker = new AnalysisStatusTracker();

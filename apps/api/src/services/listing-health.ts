import { Listing, ListingStatus } from '@prisma/client';

export interface HealthIssue {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
}

export interface ListingHealthResult {
  score: number;
  issues: HealthIssue[];
}

const TITLE_MIN_LENGTH = 20;
const TITLE_MAX_LENGTH = 60;
const TITLE_OPTIMAL_MIN = 30;
const TITLE_OPTIMAL_MAX = 50;

export function calculateListingHealth(listing: Pick<Listing, 'title' | 'status' | 'stock' | 'price'>): ListingHealthResult {
  const issues: HealthIssue[] = [];
  let score = 100;

  // Rule 1: Title length check
  const titleLength = listing.title.length;
  
  if (titleLength < TITLE_MIN_LENGTH) {
    issues.push({
      code: 'TITLE_TOO_SHORT',
      severity: 'critical',
      message: `Título muito curto (${titleLength} caracteres). Mínimo recomendado: ${TITLE_MIN_LENGTH}`,
    });
    score -= 30;
  } else if (titleLength > TITLE_MAX_LENGTH) {
    issues.push({
      code: 'TITLE_TOO_LONG',
      severity: 'warning',
      message: `Título muito longo (${titleLength} caracteres). Máximo recomendado: ${TITLE_MAX_LENGTH}`,
    });
    score -= 10;
  } else if (titleLength < TITLE_OPTIMAL_MIN || titleLength > TITLE_OPTIMAL_MAX) {
    issues.push({
      code: 'TITLE_SUBOPTIMAL',
      severity: 'warning',
      message: `Título fora do tamanho ideal (${titleLength} caracteres). Ideal: ${TITLE_OPTIMAL_MIN}-${TITLE_OPTIMAL_MAX}`,
    });
    score -= 5;
  }

  // Rule 2: Status check
  if (listing.status === ListingStatus.paused) {
    issues.push({
      code: 'LISTING_PAUSED',
      severity: 'warning',
      message: 'Anúncio pausado não está visível para compradores',
    });
    score -= 20;
  } else if (listing.status === ListingStatus.deleted) {
    issues.push({
      code: 'LISTING_DELETED',
      severity: 'critical',
      message: 'Anúncio deletado',
    });
    score -= 50;
  }

  // Rule 3: Stock check
  if (listing.stock === 0) {
    issues.push({
      code: 'OUT_OF_STOCK',
      severity: 'critical',
      message: 'Produto sem estoque',
    });
    score -= 30;
  } else if (listing.stock < 5) {
    issues.push({
      code: 'LOW_STOCK',
      severity: 'warning',
      message: `Estoque baixo (${listing.stock} unidades)`,
    });
    score -= 10;
  }

  // Rule 4: Price check
  const price = Number(listing.price);
  if (price <= 0) {
    issues.push({
      code: 'INVALID_PRICE',
      severity: 'critical',
      message: 'Preço inválido ou zerado',
    });
    score -= 30;
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score * 100) / 100,
    issues,
  };
}

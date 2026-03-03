import { ActionDetailsV2 } from '../schemas/ActionDetailsV2';
import { RequiredArtifacts, getRequiredArtifactsForActionKey } from './actionTypeMapping';

export interface ValidationResult {
  isValid: boolean;
  missingArtifacts: string[];
  errorMessage?: string;
}

/**
 * Valida se ActionDetailsV2 contém todos os artifacts obrigatórios para o actionKey
 */
export function validateArtifacts(
  details: ActionDetailsV2,
  actionKey: string,
): ValidationResult {
  const required = getRequiredArtifactsForActionKey(actionKey);
  const missing: string[] = [];

  // Validar artifacts.copy
  if (required.copy) {
    if (required.copy.titleSuggestions && (!details.artifacts?.copy?.titleSuggestions || details.artifacts.copy.titleSuggestions.length < 3)) {
      missing.push('artifacts.copy.titleSuggestions (mínimo 3)');
    }
    if (required.copy.descriptionTemplate && !details.artifacts?.copy?.descriptionTemplate) {
      missing.push('artifacts.copy.descriptionTemplate');
    }
    if (required.copy.bulletSuggestions && (!details.artifacts?.copy?.bulletSuggestions || details.artifacts.copy.bulletSuggestions.length < 3)) {
      missing.push('artifacts.copy.bulletSuggestions (mínimo 3)');
    }
    if (required.copy.keywordSuggestions && (!details.artifacts?.copy?.keywordSuggestions || details.artifacts.copy.keywordSuggestions.length < 3)) {
      missing.push('artifacts.copy.keywordSuggestions (mínimo 3)');
    }
  }

  // Validar artifacts.media
  if (required.media) {
    if (required.media.galleryPlan && (!details.artifacts?.media?.galleryPlan || details.artifacts.media.galleryPlan.length < 6)) {
      missing.push('artifacts.media.galleryPlan (mínimo 6 slots)');
    }
    if (required.media.videoScript && !details.artifacts?.media?.videoScript) {
      missing.push('artifacts.media.videoScript');
    }
  }

  // Validar artifacts.pricing
  if (required.pricing?.suggestions && (!details.artifacts?.pricing?.suggestions || details.artifacts.pricing.suggestions.length === 0)) {
    missing.push('artifacts.pricing.suggestions');
  }

  // Validar artifacts.variations
  if (required.variations && (!details.artifacts?.variations || details.artifacts.variations.length === 0)) {
    missing.push('artifacts.variations');
  }

  // Validar artifacts.kits
  if (required.kits && (!details.artifacts?.kits || details.artifacts.kits.length === 0)) {
    missing.push('artifacts.kits');
  }

  // Validar artifacts.techSpecs
  if (required.techSpecs && (!details.artifacts?.techSpecs || details.artifacts.techSpecs.length === 0)) {
    missing.push('artifacts.techSpecs');
  }

  // Validar artifacts.trustGuarantees
  if (required.trustGuarantees && (!details.artifacts?.trustGuarantees || details.artifacts.trustGuarantees.length === 0)) {
    missing.push('artifacts.trustGuarantees');
  }

  if (missing.length > 0) {
    return {
      isValid: false,
      missingArtifacts: missing,
      errorMessage: `Artifacts obrigatórios ausentes para ${actionKey}: ${missing.join(', ')}`,
    };
  }

  return { isValid: true, missingArtifacts: [] };
}

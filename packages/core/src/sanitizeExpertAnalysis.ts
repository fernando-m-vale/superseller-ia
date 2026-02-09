import { sanitizeMlText } from './sanitizeMlText';

export interface ExpertAnalysisFields {
  verdict?: string;
  title_fix?: {
    problem?: string;
    impact?: string;
    before?: string;
    after?: string;
  };
  image_plan?: Array<{
    image?: number;
    action?: string;
  }>;
  description_fix?: {
    diagnostic?: string;
    optimized_copy?: string;
  };
  price_fix?: {
    diagnostic?: string;
    action?: string;
  };
  algorithm_hacks?: Array<{
    hack?: string;
    how_to_apply?: string;
    signal_impacted?: string;
  }>;
  final_action_plan?: string[];
  meta?: Record<string, unknown>;
}

export function sanitizeExpertAnalysis<T extends ExpertAnalysisFields>(analysis: T): T {
  if (!analysis) return analysis;

  const result = { ...analysis };

  if (result.verdict) {
    result.verdict = sanitizeMlText(result.verdict);
  }

  if (result.title_fix) {
    result.title_fix = { ...result.title_fix };
    if (result.title_fix.problem) {
      result.title_fix.problem = sanitizeMlText(result.title_fix.problem);
    }
    if (result.title_fix.impact) {
      result.title_fix.impact = sanitizeMlText(result.title_fix.impact);
    }
    if (result.title_fix.after) {
      result.title_fix.after = sanitizeMlText(result.title_fix.after);
    }
  }

  if (result.image_plan) {
    result.image_plan = result.image_plan.map(item => ({
      ...item,
      action: item.action ? sanitizeMlText(item.action) : item.action,
    }));
  }

  if (result.description_fix) {
    result.description_fix = { ...result.description_fix };
    if (result.description_fix.diagnostic) {
      result.description_fix.diagnostic = sanitizeMlText(result.description_fix.diagnostic);
    }
    if (result.description_fix.optimized_copy) {
      result.description_fix.optimized_copy = sanitizeMlText(result.description_fix.optimized_copy);
    }
  }

  if (result.price_fix) {
    result.price_fix = { ...result.price_fix };
    if (result.price_fix.diagnostic) {
      result.price_fix.diagnostic = sanitizeMlText(result.price_fix.diagnostic);
    }
    if (result.price_fix.action) {
      result.price_fix.action = sanitizeMlText(result.price_fix.action);
    }
  }

  if (result.algorithm_hacks) {
    result.algorithm_hacks = result.algorithm_hacks.map(hack => ({
      ...hack,
      hack: hack.hack ? sanitizeMlText(hack.hack) : hack.hack,
      how_to_apply: hack.how_to_apply ? sanitizeMlText(hack.how_to_apply) : hack.how_to_apply,
      signal_impacted: hack.signal_impacted ? sanitizeMlText(hack.signal_impacted) : hack.signal_impacted,
    }));
  }

  if (result.final_action_plan) {
    result.final_action_plan = result.final_action_plan.map(item => sanitizeMlText(item));
  }

  return result;
}

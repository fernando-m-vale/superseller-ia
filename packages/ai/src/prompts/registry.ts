/**
 * Registry de prompts versionados
 * 
 * Centraliza acesso aos prompts via função getPrompt(version)
 */

import {
  promptVersion as mlExpertV21Version,
  systemPrompt as mlExpertV21SystemPrompt,
  buildMLExpertV21UserPrompt,
} from './mlExpertV21';

import {
  promptVersion as mlSalesV22Version,
  systemPrompt as mlSalesV22SystemPrompt,
  buildMLSalesV22UserPrompt,
} from './mlSalesV22';

export type PromptVersion = 'ml-expert-v21' | 'ml-sales-v22';

export interface PromptRegistryEntry {
  version: PromptVersion;
  systemPrompt: string;
  buildUserPrompt: typeof buildMLExpertV21UserPrompt | typeof buildMLSalesV22UserPrompt;
}

export const PROMPT_REGISTRY: Record<PromptVersion, PromptRegistryEntry> = {
  'ml-expert-v21': {
    version: mlExpertV21Version as PromptVersion,
    systemPrompt: mlExpertV21SystemPrompt,
    buildUserPrompt: buildMLExpertV21UserPrompt,
  },
  'ml-sales-v22': {
    version: mlSalesV22Version as PromptVersion,
    systemPrompt: mlSalesV22SystemPrompt,
    buildUserPrompt: buildMLSalesV22UserPrompt,
  },
} as const;

/**
 * Obtém prompt por versão
 */
export function getPrompt(version: PromptVersion): PromptRegistryEntry {
  const entry = PROMPT_REGISTRY[version];
  if (!entry) {
    throw new Error(`Prompt version "${version}" not found in registry`);
  }
  return entry;
}

/**
 * Lista todas as versões disponíveis
 */
export function getAvailableVersions(): PromptVersion[] {
  return Object.keys(PROMPT_REGISTRY) as PromptVersion[];
}

/**
 * Prompt Version - Single Source of Truth
 * 
 * Centraliza a definição da versão do prompt usado para análise de IA.
 * Prioridade: process.env.AI_PROMPT_VERSION > fallback 'ml-expert-v23'
 */

export function getPromptVersion(): string {
  return process.env.AI_PROMPT_VERSION || 'ml-expert-v23';
}

export const PROMPT_VERSION = getPromptVersion();

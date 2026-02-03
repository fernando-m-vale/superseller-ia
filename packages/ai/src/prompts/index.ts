/**
 * Exports de prompts versionados
 */

export {
  promptVersion as mlExpertV21Version,
  systemPrompt as mlExpertV21SystemPrompt,
  buildMLExpertV21UserPrompt,
  type MLExpertV21BuildUserPromptInput,
} from './mlExpertV21';

export {
  promptVersion as mlSalesV22Version,
  systemPrompt as mlSalesV22SystemPrompt,
  buildMLSalesV22UserPrompt,
  type MLSalesV22BuildUserPromptInput,
} from './mlSalesV22';

export {
  PROMPT_REGISTRY,
  getPrompt,
  getAvailableVersions,
  type PromptVersion,
  type PromptRegistryEntry,
} from './registry';

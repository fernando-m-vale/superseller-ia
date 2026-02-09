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
  promptVersion as mlExpertV22Version,
  systemPrompt as mlExpertV22SystemPrompt,
  buildMLExpertV22UserPrompt,
  type MLExpertV22BuildUserPromptInput,
} from './mlExpertV22';

export {
  PROMPT_REGISTRY,
  getPrompt,
  getAvailableVersions,
  type PromptVersion,
  type PromptRegistryEntry,
} from './registry';

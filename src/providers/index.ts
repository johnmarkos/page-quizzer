import { BaseProvider, type ProviderConfig } from './BaseProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'ollama';

const PROVIDERS: Record<ProviderName, new (config: ProviderConfig) => BaseProvider> = {
  anthropic: AnthropicProvider,
  openai: OpenAIProvider,
  gemini: GeminiProvider,
  ollama: OllamaProvider,
};

export function createProvider(name: ProviderName, config: ProviderConfig): BaseProvider {
  const Provider = PROVIDERS[name];
  if (!Provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return new Provider(config);
}

export function getAvailableProviders(): ProviderName[] {
  return Object.keys(PROVIDERS) as ProviderName[];
}

export { BaseProvider, type ProviderConfig } from './BaseProvider.js';
export { AnthropicProvider } from './AnthropicProvider.js';
export { GeminiProvider } from './GeminiProvider.js';
export { OllamaProvider } from './OllamaProvider.js';
export { OpenAIProvider } from './OpenAIProvider.js';
export {
  getDefaultProviderModel,
  getProviderModels,
  normalizeProviderModel,
} from './provider-models.js';
export {
  DEFAULT_OLLAMA_BASE_URL,
  normalizeProviderBaseUrl,
  providerRequiresApiKey,
  providerSupportsBaseUrl,
} from './provider-settings.js';

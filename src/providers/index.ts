import { BaseProvider, type ProviderConfig } from './BaseProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';

export type ProviderName = 'anthropic' | 'openai';

const PROVIDERS: Record<ProviderName, new (config: ProviderConfig) => BaseProvider> = {
  anthropic: AnthropicProvider,
  openai: OpenAIProvider,
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
export { OpenAIProvider } from './OpenAIProvider.js';

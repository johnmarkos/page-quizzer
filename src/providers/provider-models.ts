import type { ProviderName } from './index.js';

const PROVIDER_MODELS: Record<ProviderName, readonly string[]> = {
  anthropic: [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929',
  ],
  openai: [
    'gpt-5-mini',
    'gpt-4o-mini',
    'gpt-4.1-nano',
    'gpt-4.1-mini',
    'gpt-4.1',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
  ],
};

export function getProviderModels(provider: ProviderName): string[] {
  return [...PROVIDER_MODELS[provider]];
}

export function getDefaultProviderModel(provider: ProviderName): string {
  return PROVIDER_MODELS[provider][0];
}

export function normalizeProviderModel(provider: ProviderName, requestedModel?: string): string {
  const models = PROVIDER_MODELS[provider];
  if (requestedModel && models.includes(requestedModel)) {
    return requestedModel;
  }

  return models[0];
}

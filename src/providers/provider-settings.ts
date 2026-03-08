import type { ProviderName } from './index.js';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

export function providerRequiresApiKey(provider: ProviderName): boolean {
  return provider !== 'ollama';
}

export function providerSupportsBaseUrl(provider: ProviderName): boolean {
  return provider === 'ollama';
}

export function normalizeProviderBaseUrl(provider: ProviderName, baseUrl?: string): string | undefined {
  if (!providerSupportsBaseUrl(provider)) {
    return undefined;
  }

  const trimmed = baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL;

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
    url.pathname = normalizedPath || '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '').replace(/\/api$/, '') || DEFAULT_OLLAMA_BASE_URL;
  }
}

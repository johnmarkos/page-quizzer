import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OLLAMA_BASE_URL,
  normalizeProviderBaseUrl,
  providerRequiresApiKey,
  providerSupportsBaseUrl,
} from '../../src/providers/provider-settings.js';

describe('provider settings', () => {
  it('marks ollama as the only base-url provider', () => {
    expect(providerSupportsBaseUrl('anthropic')).toBe(false);
    expect(providerSupportsBaseUrl('ollama')).toBe(true);
  });

  it('marks ollama as not requiring an API key', () => {
    expect(providerRequiresApiKey('openai')).toBe(true);
    expect(providerRequiresApiKey('ollama')).toBe(false);
  });

  it('normalizes the default ollama base URL', () => {
    expect(normalizeProviderBaseUrl('ollama')).toBe(DEFAULT_OLLAMA_BASE_URL);
  });

  it('strips trailing slashes and /api suffixes from ollama URLs', () => {
    expect(normalizeProviderBaseUrl('ollama', 'http://localhost:11434/api/')).toBe(DEFAULT_OLLAMA_BASE_URL);
    expect(normalizeProviderBaseUrl('ollama', 'http://example.com/custom/api')).toBe('http://example.com/custom');
  });

  it('returns undefined for providers that do not use base URLs', () => {
    expect(normalizeProviderBaseUrl('openai', 'http://localhost:11434')).toBeUndefined();
  });
});

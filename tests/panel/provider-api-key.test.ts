import { describe, expect, it } from 'vitest';
import { shouldApplyLoadedProviderKey } from '../../src/panel/provider-api-key.js';

describe('provider api key loading', () => {
  it('applies the result when the request is still current for the same provider', () => {
    expect(shouldApplyLoadedProviderKey(2, 2, 'openai', 'openai')).toBe(true);
  });

  it('ignores stale requests when a newer provider-key load started', () => {
    expect(shouldApplyLoadedProviderKey(1, 2, 'openai', 'openai')).toBe(false);
  });

  it('ignores results for a provider that is no longer selected', () => {
    expect(shouldApplyLoadedProviderKey(2, 2, 'openai', 'gemini')).toBe(false);
  });
});

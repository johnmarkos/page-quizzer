import { describe, it, expect } from 'vitest';
import { createProvider, getAvailableProviders } from '../../src/providers/index.js';

describe('Provider Registry', () => {
  it('lists available providers', () => {
    const providers = getAvailableProviders();
    expect(providers).toContain('anthropic');
  });

  it('creates an anthropic provider', () => {
    const provider = createProvider('anthropic', { apiKey: 'test-key' });
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-haiku-4-5-20251001');
  });

  it('uses custom model when provided', () => {
    const provider = createProvider('anthropic', {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-5-20250929',
    });
    expect(provider.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('throws for unknown provider', () => {
    expect(() => createProvider('nonexistent' as any, { apiKey: '' })).toThrow('Unknown provider');
  });
});

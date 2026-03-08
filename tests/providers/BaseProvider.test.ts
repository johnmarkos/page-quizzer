import { describe, it, expect } from 'vitest';
import { createProvider, getAvailableProviders } from '../../src/providers/index.js';

describe('Provider Registry', () => {
  it('lists available providers', () => {
    const providers = getAvailableProviders();
    expect(providers).toContain('anthropic');
    expect(providers).toContain('openai');
    expect(providers).toContain('gemini');
  });

  it('creates an anthropic provider', () => {
    const provider = createProvider('anthropic', { apiKey: 'test-key' });
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-haiku-4-5-20251001');
  });

  it('creates an openai provider', () => {
    const provider = createProvider('openai', { apiKey: 'test-key' });
    expect(provider.name).toBe('openai');
    expect(provider.model).toBe('gpt-4o-mini');
  });

  it('uses custom model when provided', () => {
    const provider = createProvider('anthropic', {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-5-20250929',
    });
    expect(provider.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('uses custom model for openai when provided', () => {
    const provider = createProvider('openai', {
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
    });
    expect(provider.model).toBe('gpt-4.1-mini');
  });

  it('creates a gemini provider', () => {
    const provider = createProvider('gemini', { apiKey: 'test-key' });
    expect(provider.name).toBe('gemini');
    expect(provider.model).toBe('gemini-2.5-flash');
  });

  it('uses custom model for gemini when provided', () => {
    const provider = createProvider('gemini', {
      apiKey: 'test-key',
      model: 'gemini-2.5-flash-lite',
    });
    expect(provider.model).toBe('gemini-2.5-flash-lite');
  });

  it('throws for unknown provider', () => {
    expect(() => createProvider('nonexistent' as never, { apiKey: '' })).toThrow('Unknown provider');
  });
});

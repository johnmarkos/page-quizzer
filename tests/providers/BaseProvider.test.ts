import { describe, it, expect } from 'vitest';
import {
  createProvider,
  getAvailableProviders,
  getDefaultProviderModel,
  getProviderModels,
  normalizeProviderModel,
} from '../../src/providers/index.js';

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
    expect(provider.models).toEqual(getProviderModels('anthropic'));
  });

  it('creates an openai provider', () => {
    const provider = createProvider('openai', { apiKey: 'test-key' });
    expect(provider.name).toBe('openai');
    expect(provider.model).toBe('gpt-5-mini');
    expect(provider.models).toEqual(getProviderModels('openai'));
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
    expect(provider.models).toEqual(getProviderModels('gemini'));
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

  it('exposes non-empty model lists for every provider', () => {
    for (const providerName of getAvailableProviders()) {
      const models = getProviderModels(providerName);
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toBe(getDefaultProviderModel(providerName));
    }
  });

  it('normalizes invalid or missing model selections to the provider default', () => {
    expect(normalizeProviderModel('openai')).toBe('gpt-5-mini');
    expect(normalizeProviderModel('openai', 'not-a-real-model')).toBe('gpt-5-mini');
    expect(normalizeProviderModel('openai', 'gpt-4.1')).toBe('gpt-4.1');
  });
});

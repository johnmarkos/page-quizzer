import { describe, expect, it } from 'vitest';
import { resolveConnectionSettings } from '../../src/background/connection-settings.js';

describe('resolveConnectionSettings', () => {
  it('uses stored settings when no override is provided', () => {
    const resolved = resolveConnectionSettings({
      provider: 'anthropic',
      apiKey: 'stored-key',
      model: 'claude-haiku-4-5-20251001',
      baseUrl: undefined,
    });

    expect(resolved).toEqual({
      provider: 'anthropic',
      apiKey: 'stored-key',
      model: 'claude-haiku-4-5-20251001',
      baseUrl: undefined,
    });
  });

  it('prefers current form values over stored settings', () => {
    const resolved = resolveConnectionSettings(
      {
        provider: 'anthropic',
        apiKey: 'old-key',
        model: 'claude-haiku-4-5-20251001',
        baseUrl: undefined,
      },
      {
        provider: 'openai',
        apiKey: 'new-key',
      },
    );

    expect(resolved).toEqual({
      provider: 'openai',
      apiKey: 'new-key',
      model: undefined,
      baseUrl: undefined,
    });
  });

  it('keeps the stored model when the provider stays the same', () => {
    const resolved = resolveConnectionSettings(
      {
        provider: 'openai',
        apiKey: 'old-key',
        model: 'gpt-4o-mini',
        baseUrl: undefined,
      },
      {
        provider: 'openai',
        apiKey: 'new-key',
      },
    );

    expect(resolved).toEqual({
      provider: 'openai',
      apiKey: 'new-key',
      model: 'gpt-4o-mini',
      baseUrl: undefined,
    });
  });

  it('keeps the stored base URL when the provider stays the same', () => {
    const resolved = resolveConnectionSettings(
      {
        provider: 'ollama',
        apiKey: '',
        model: 'llama3.2',
        baseUrl: 'http://localhost:11434',
      },
      {
        provider: 'ollama',
        model: 'qwen2.5',
      },
    );

    expect(resolved).toEqual({
      provider: 'ollama',
      apiKey: '',
      model: 'qwen2.5',
      baseUrl: 'http://localhost:11434',
    });
  });

  it('drops the stored base URL when switching away from ollama', () => {
    const resolved = resolveConnectionSettings(
      {
        provider: 'ollama',
        apiKey: '',
        model: 'llama3.2',
        baseUrl: 'http://localhost:11434',
      },
      {
        provider: 'openai',
        apiKey: 'next-key',
      },
    );

    expect(resolved).toEqual({
      provider: 'openai',
      apiKey: 'next-key',
      model: undefined,
      baseUrl: undefined,
    });
  });
});

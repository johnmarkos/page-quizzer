import { describe, expect, it } from 'vitest';
import { resolveConnectionSettings } from '../../src/background/connection-settings.js';

describe('resolveConnectionSettings', () => {
  it('uses stored settings when no override is provided', () => {
    const resolved = resolveConnectionSettings({
      provider: 'anthropic',
      apiKey: 'stored-key',
      model: 'claude-haiku-4-5-20251001',
    });

    expect(resolved).toEqual({
      provider: 'anthropic',
      apiKey: 'stored-key',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('prefers current form values over stored settings', () => {
    const resolved = resolveConnectionSettings(
      {
        provider: 'anthropic',
        apiKey: 'old-key',
        model: 'claude-haiku-4-5-20251001',
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
    });
  });

  it('keeps the stored model when the provider stays the same', () => {
    const resolved = resolveConnectionSettings(
      {
        provider: 'openai',
        apiKey: 'old-key',
        model: 'gpt-4o-mini',
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
    });
  });
});

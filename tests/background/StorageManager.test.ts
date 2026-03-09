import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageManager } from '../../src/background/StorageManager.js';
import { STORAGE_KEYS, providerApiKeyStorageKey } from '../../src/shared/constants.js';

type StorageAreaState = Record<string, unknown>;

function readStorage(area: StorageAreaState, keys?: string | string[]) {
  if (keys === undefined) {
    return { ...area };
  }

  if (Array.isArray(keys)) {
    return Object.fromEntries(
      keys
        .filter((key) => key in area)
        .map((key) => [key, area[key]]),
    );
  }

  return keys in area ? { [keys]: area[keys] } : {};
}

describe('StorageManager settings', () => {
  const syncState: StorageAreaState = {};
  const localState: StorageAreaState = {};

  beforeEach(() => {
    for (const key of Object.keys(syncState)) {
      delete syncState[key];
    }
    for (const key of Object.keys(localState)) {
      delete localState[key];
    }

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn(async (keys?: string | string[]) => readStorage(syncState, keys)),
          set: vi.fn(async (value: StorageAreaState) => {
            Object.assign(syncState, value);
          }),
        },
        local: {
          get: vi.fn(async (keys?: string | string[]) => readStorage(localState, keys)),
          set: vi.fn(async (value: StorageAreaState) => {
            Object.assign(localState, value);
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              delete localState[key];
            }
          }),
        },
      },
    });
  });

  it('returns the API key for the active provider', async () => {
    syncState[STORAGE_KEYS.PROVIDER] = 'openai';
    localState[providerApiKeyStorageKey('anthropic')] = 'anthropic-key';
    localState[providerApiKeyStorageKey('openai')] = 'openai-key';

    const settings = await new StorageManager().getSettings();

    expect(settings.provider).toBe('openai');
    expect(settings.apiKey).toBe('openai-key');
  });

  it('writes API keys to the provider-specific storage key', async () => {
    const storage = new StorageManager();

    await storage.saveSettings({
      provider: 'gemini',
      apiKey: 'gemini-key',
    });

    expect(syncState[STORAGE_KEYS.PROVIDER]).toBe('gemini');
    expect(localState[providerApiKeyStorageKey('gemini')]).toBe('gemini-key');
    expect(localState[STORAGE_KEYS.API_KEY]).toBeUndefined();
  });

  it('uses the stored provider when saving only an API key', async () => {
    syncState[STORAGE_KEYS.PROVIDER] = 'openai';

    await new StorageManager().saveSettings({ apiKey: 'openai-key' });

    expect(localState[providerApiKeyStorageKey('openai')]).toBe('openai-key');
  });

  it('removes the legacy key when saving a provider-specific key', async () => {
    localState[STORAGE_KEYS.API_KEY] = 'legacy-key';

    await new StorageManager().saveSettings({
      provider: 'openai',
      apiKey: 'openai-key',
    });

    expect(localState[providerApiKeyStorageKey('openai')]).toBe('openai-key');
    expect(localState[STORAGE_KEYS.API_KEY]).toBeUndefined();
  });

  it('migrates the legacy API key into the active provider slot', async () => {
    syncState[STORAGE_KEYS.PROVIDER] = 'anthropic';
    localState[STORAGE_KEYS.API_KEY] = 'legacy-key';

    const settings = await new StorageManager().getSettings();

    expect(settings.apiKey).toBe('legacy-key');
    expect(localState[providerApiKeyStorageKey('anthropic')]).toBe('legacy-key');
    expect(localState[STORAGE_KEYS.API_KEY]).toBeUndefined();
  });

  it('prefers an existing provider-specific key over the legacy key during migration', async () => {
    syncState[STORAGE_KEYS.PROVIDER] = 'openai';
    localState[STORAGE_KEYS.API_KEY] = 'legacy-key';
    localState[providerApiKeyStorageKey('openai')] = 'provider-key';

    const settings = await new StorageManager().getSettings();

    expect(settings.apiKey).toBe('provider-key');
    expect(localState[providerApiKeyStorageKey('openai')]).toBe('provider-key');
    expect(localState[STORAGE_KEYS.API_KEY]).toBeUndefined();
  });

  it('does not overwrite an intentionally cleared provider key during migration', async () => {
    syncState[STORAGE_KEYS.PROVIDER] = 'gemini';
    localState[STORAGE_KEYS.API_KEY] = 'legacy-key';
    localState[providerApiKeyStorageKey('gemini')] = '';

    const settings = await new StorageManager().getSettings();

    expect(settings.apiKey).toBe('');
    expect(localState[providerApiKeyStorageKey('gemini')]).toBe('');
    expect(localState[STORAGE_KEYS.API_KEY]).toBeUndefined();
  });

  it('does not store API keys for ollama', async () => {
    await new StorageManager().saveSettings({
      provider: 'ollama',
      apiKey: 'ignored-key',
    });

    expect(localState[providerApiKeyStorageKey('ollama')]).toBeUndefined();
  });
});

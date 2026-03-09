import {
  STORAGE_KEYS,
  DEFAULT_DENSITY,
  DEFAULT_MAX_QUESTIONS,
  DEFAULT_TIMER_SECONDS,
  providerApiKeyStorageKey,
} from '../shared/constants.js';
import type { ProviderName } from '../providers/index.js';
import type { SessionSummary } from '../engine/types.js';
import { normalizeProviderModel } from '../providers/provider-models.js';
import {
  normalizeProviderBaseUrl,
  providerRequiresApiKey,
} from '../providers/provider-settings.js';

export type SessionRecord = SessionSummary & {
  id: string;
  url: string;
  title: string;
  date: number;
  topics?: string[];
};

export type Settings = {
  apiKey: string;
  provider: ProviderName;
  model?: string;
  baseUrl?: string;
  density: number;
  maxQuestions: number;
  timerSeconds: number;
};

export class StorageManager {
  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.sync.get([
      STORAGE_KEYS.PROVIDER,
      STORAGE_KEYS.MODEL,
      STORAGE_KEYS.BASE_URL,
      STORAGE_KEYS.DENSITY,
      STORAGE_KEYS.MAX_QUESTIONS,
      STORAGE_KEYS.TIMER_SECONDS,
    ]);
    const provider = (result[STORAGE_KEYS.PROVIDER] || 'anthropic') as ProviderName;
    const storedModel = result[STORAGE_KEYS.MODEL] as string | undefined;
    const storedBaseUrl = result[STORAGE_KEYS.BASE_URL] as string | undefined;
    const providerApiKeyKey = providerRequiresApiKey(provider)
      ? providerApiKeyStorageKey(provider)
      : null;
    const local = await chrome.storage.local.get(
      providerApiKeyKey
        ? [STORAGE_KEYS.API_KEY, providerApiKeyKey]
        : [STORAGE_KEYS.API_KEY],
    );
    const hasLegacyApiKey = Object.prototype.hasOwnProperty.call(local, STORAGE_KEYS.API_KEY);
    const legacyApiKey = this.#readStoredString(local[STORAGE_KEYS.API_KEY]);
    const hasStoredProviderApiKey = providerApiKeyKey
      ? Object.prototype.hasOwnProperty.call(local, providerApiKeyKey)
      : false;
    const storedProviderApiKey = providerApiKeyKey
      ? this.#readStoredString(local[providerApiKeyKey])
      : '';

    if (providerApiKeyKey && hasLegacyApiKey) {
      if (!hasStoredProviderApiKey) {
        await chrome.storage.local.set({ [providerApiKeyKey]: legacyApiKey });
      }
      await chrome.storage.local.remove(STORAGE_KEYS.API_KEY);
    }

    return {
      apiKey: providerApiKeyKey
        ? hasStoredProviderApiKey
          ? storedProviderApiKey
          : legacyApiKey
        : '',
      provider,
      model: storedModel ? normalizeProviderModel(provider, storedModel) : undefined,
      baseUrl: normalizeProviderBaseUrl(provider, storedBaseUrl),
      density: result[STORAGE_KEYS.DENSITY] ?? DEFAULT_DENSITY,
      maxQuestions: result[STORAGE_KEYS.MAX_QUESTIONS] ?? DEFAULT_MAX_QUESTIONS,
      timerSeconds: result[STORAGE_KEYS.TIMER_SECONDS] ?? DEFAULT_TIMER_SECONDS,
    };
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    const sync: Record<string, string | number> = {};
    const local: Record<string, string> = {};

    if (settings.provider !== undefined) sync[STORAGE_KEYS.PROVIDER] = settings.provider;
    if (settings.model !== undefined) sync[STORAGE_KEYS.MODEL] = settings.model;
    if (settings.baseUrl !== undefined) sync[STORAGE_KEYS.BASE_URL] = settings.baseUrl;
    if (settings.density !== undefined) sync[STORAGE_KEYS.DENSITY] = settings.density;
    if (settings.maxQuestions !== undefined) sync[STORAGE_KEYS.MAX_QUESTIONS] = settings.maxQuestions;
    if (settings.timerSeconds !== undefined) sync[STORAGE_KEYS.TIMER_SECONDS] = settings.timerSeconds;
    if (settings.apiKey !== undefined) {
      const provider = settings.provider ?? await this.#getStoredProvider();
      if (providerRequiresApiKey(provider)) {
        local[providerApiKeyStorageKey(provider)] = settings.apiKey;
      }
    }

    if (Object.keys(sync).length) await chrome.storage.sync.set(sync);
    if (Object.keys(local).length) await chrome.storage.local.set(local);
  }

  async saveSession(record: SessionRecord): Promise<void> {
    const { sessions = [] } = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
    sessions.push(record);

    // Keep storage manageable — summarize if over 500 sessions
    const trimmed = sessions.length > 500 ? sessions.slice(-400) : sessions;
    await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: trimmed });
  }

  async getSessions(): Promise<SessionRecord[]> {
    const { sessions = [] } = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
    return sessions;
  }

  async setSessions(records: SessionRecord[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: records });
  }

  async #getStoredProvider(): Promise<ProviderName> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.PROVIDER);
    return (result[STORAGE_KEYS.PROVIDER] || 'anthropic') as ProviderName;
  }

  #readStoredString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}

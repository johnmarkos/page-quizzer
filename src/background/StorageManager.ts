import {
  STORAGE_KEYS,
  DEFAULT_DENSITY,
  DEFAULT_MAX_QUESTIONS,
  DEFAULT_TIMER_SECONDS,
} from '../shared/constants.js';
import type { ProviderName } from '../providers/index.js';
import type { SessionSummary } from '../engine/types.js';
import { normalizeProviderModel } from '../providers/provider-models.js';

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
  density: number;
  maxQuestions: number;
  timerSeconds: number;
};

export class StorageManager {
  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.sync.get([
      STORAGE_KEYS.PROVIDER,
      STORAGE_KEYS.MODEL,
      STORAGE_KEYS.DENSITY,
      STORAGE_KEYS.MAX_QUESTIONS,
      STORAGE_KEYS.TIMER_SECONDS,
    ]);
    const local = await chrome.storage.local.get([STORAGE_KEYS.API_KEY]);
    const provider = (result[STORAGE_KEYS.PROVIDER] || 'anthropic') as ProviderName;
    const storedModel = result[STORAGE_KEYS.MODEL] as string | undefined;

    return {
      apiKey: local[STORAGE_KEYS.API_KEY] || '',
      provider,
      model: storedModel ? normalizeProviderModel(provider, storedModel) : undefined,
      density: result[STORAGE_KEYS.DENSITY] ?? DEFAULT_DENSITY,
      maxQuestions: result[STORAGE_KEYS.MAX_QUESTIONS] ?? DEFAULT_MAX_QUESTIONS,
      timerSeconds: result[STORAGE_KEYS.TIMER_SECONDS] ?? DEFAULT_TIMER_SECONDS,
    };
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    const sync: Record<string, any> = {};
    const local: Record<string, any> = {};

    if (settings.provider !== undefined) sync[STORAGE_KEYS.PROVIDER] = settings.provider;
    if (settings.model !== undefined) sync[STORAGE_KEYS.MODEL] = settings.model;
    if (settings.density !== undefined) sync[STORAGE_KEYS.DENSITY] = settings.density;
    if (settings.maxQuestions !== undefined) sync[STORAGE_KEYS.MAX_QUESTIONS] = settings.maxQuestions;
    if (settings.timerSeconds !== undefined) sync[STORAGE_KEYS.TIMER_SECONDS] = settings.timerSeconds;
    if (settings.apiKey !== undefined) local[STORAGE_KEYS.API_KEY] = settings.apiKey;

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
}

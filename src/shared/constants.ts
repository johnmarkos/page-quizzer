export const DEFAULT_DENSITY = 3; // questions per 100 words
export const DEFAULT_MAX_QUESTIONS = 50;
export const CHUNK_SIZE = 800; // words per chunk for LLM calls
export const STORAGE_KEYS = {
  API_KEY: 'apiKey',
  PROVIDER: 'provider',
  MODEL: 'model',
  DENSITY: 'density',
  MAX_QUESTIONS: 'maxQuestions',
  SESSIONS: 'sessions',
  ENGINE_SNAPSHOT: 'engineSnapshot',
  LAST_EXTRACTED: 'lastExtracted',
} as const;

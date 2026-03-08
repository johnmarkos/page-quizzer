export const DEFAULT_DENSITY = 3; // questions per 100 words
export const DEFAULT_MAX_QUESTIONS = 50;
export const DEFAULT_TIMER_SECONDS = 0;
export const CHUNK_SIZE = 800; // words per chunk for LLM calls
export const STORAGE_KEYS = {
  API_KEY: 'apiKey',
  PROVIDER: 'provider',
  MODEL: 'model',
  BASE_URL: 'baseUrl',
  DENSITY: 'density',
  MAX_QUESTIONS: 'maxQuestions',
  TIMER_SECONDS: 'timerSeconds',
  SESSIONS: 'sessions',
  TAB_QUIZ_SESSIONS: 'tabQuizSessions',
  QUESTION_PERFORMANCE: 'questionPerformance',
} as const;

import type { SessionRecord } from './StorageManager.js';

export type ImportResult = {
  importedCount: number;
  totalCount: number;
};

export function parseImportedSessions(json: string): SessionRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON file.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Imported history must be a JSON array.');
  }

  return parsed.map((item, index) => validateSessionRecord(item, index));
}

export function mergeSessionRecords(existing: SessionRecord[], imported: SessionRecord[]): SessionRecord[] {
  const byId = new Map<string, SessionRecord>();

  for (const record of existing) {
    byId.set(record.id, record);
  }

  for (const record of imported) {
    byId.set(record.id, record);
  }

  const merged = [...byId.values()].sort((left, right) => left.date - right.date);
  return trimSessions(merged);
}

function validateSessionRecord(value: unknown, index: number): SessionRecord {
  if (!isObject(value)) {
    throw new Error(`Imported session at index ${index} must be an object.`);
  }

  const score = value.score;
  const answers = value.answers;
  const topics = value.topics;

  if (!isNonEmptyString(value.id)) throw new Error(`Session ${index} is missing a valid id.`);
  if (!isNonEmptyString(value.url)) throw new Error(`Session ${index} is missing a valid url.`);
  if (!isNonEmptyString(value.title)) throw new Error(`Session ${index} is missing a valid title.`);
  if (!isFiniteNumber(value.date)) throw new Error(`Session ${index} is missing a valid date.`);
  if (!isFiniteNumber(value.startedAt)) throw new Error(`Session ${index} is missing a valid startedAt.`);
  if (!isFiniteNumber(value.completedAt)) throw new Error(`Session ${index} is missing a valid completedAt.`);

  if (!isObject(score)) {
    throw new Error(`Session ${index} is missing a valid score.`);
  }
  if (!Array.isArray(answers)) {
    throw new Error(`Session ${index} is missing valid answers.`);
  }
  if (topics !== undefined && (!Array.isArray(topics) || topics.some(topic => !isNonEmptyString(topic)))) {
    throw new Error(`Session ${index} has invalid topics.`);
  }

  const validatedAnswers = answers.map((answer, answerIndex) => validateAnswer(answer, index, answerIndex));
  const validatedScore = validateScore(score, index);

  return {
    id: value.id,
    url: value.url,
    title: value.title,
    date: value.date,
    topics,
    score: validatedScore,
    answers: validatedAnswers,
    startedAt: value.startedAt,
    completedAt: value.completedAt,
  };
}

function validateScore(value: unknown, sessionIndex: number): SessionRecord['score'] {
  if (!isObject(value)) {
    throw new Error(`Session ${sessionIndex} score is invalid.`);
  }

  const fields = ['correct', 'incorrect', 'skipped', 'total', 'percentage'] as const;
  for (const field of fields) {
    if (!isFiniteNumber(value[field])) {
      throw new Error(`Session ${sessionIndex} score.${field} is invalid.`);
    }
  }

  return {
    correct: value.correct,
    incorrect: value.incorrect,
    skipped: value.skipped,
    total: value.total,
    percentage: value.percentage,
  };
}

function validateAnswer(value: unknown, sessionIndex: number, answerIndex: number): SessionRecord['answers'][number] {
  if (!isObject(value)) {
    throw new Error(`Session ${sessionIndex} answer ${answerIndex} is invalid.`);
  }

  if (!isNonEmptyString(value.problemId)) {
    throw new Error(`Session ${sessionIndex} answer ${answerIndex} is missing a valid problemId.`);
  }
  if (!isFiniteNumber(value.selectedIndex)) {
    throw new Error(`Session ${sessionIndex} answer ${answerIndex} is missing a valid selectedIndex.`);
  }
  if (typeof value.correct !== 'boolean') {
    throw new Error(`Session ${sessionIndex} answer ${answerIndex} is missing a valid correct flag.`);
  }

  return {
    problemId: value.problemId,
    selectedIndex: value.selectedIndex,
    correct: value.correct,
  };
}

function trimSessions(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.length > 500 ? sessions.slice(-400) : sessions;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

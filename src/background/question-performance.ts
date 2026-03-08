import type { Problem } from '../engine/types.js';

export type QuestionPerformanceRecord = {
  seen: number;
  correct: number;
};

export type QuestionPerformanceMap = Record<string, QuestionPerformanceRecord>;

export function buildQuestionPerformanceKey(problem: Problem): string {
  const normalizedQuestion = normalizeText(problem.question);
  const normalizedOptions = problem.options
    .map((option) => `${option.correct ? '1' : '0'}:${normalizeText(option.text)}`)
    .sort()
    .join('|');

  return `q_${hashString(`${normalizedQuestion}::${normalizedOptions}`)}`;
}

export function recordQuestionPerformance(
  performance: QuestionPerformanceMap,
  problem: Problem,
  wasCorrect: boolean,
): QuestionPerformanceMap {
  const key = buildQuestionPerformanceKey(problem);
  const current = performance[key] ?? { seen: 0, correct: 0 };

  return {
    ...performance,
    [key]: {
      seen: current.seen + 1,
      correct: current.correct + (wasCorrect ? 1 : 0),
    },
  };
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function hashString(text: string): string {
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

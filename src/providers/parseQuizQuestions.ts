import type { Problem } from '../engine/types.js';
import { generateId } from '../engine/utils.js';
import type { RawQuizQuestion } from '../prompts/types.js';

export function parseQuizQuestions(raw: RawQuizQuestion[]): Problem[] {
  return raw
    .map(normalizeRawQuestion)
    .filter((question): question is RawQuizQuestion => question !== null)
    .map(question => ({
      id: generateId(),
      question: question.question,
      options: question.options.map((text, index) => ({
        text,
        correct: index === question.correctIndex,
      })),
      explanation: question.explanation,
    }));
}

function normalizeRawQuestion(question: RawQuizQuestion): RawQuizQuestion | null {
  if (!isRawQuizQuestion(question)) {
    return null;
  }

  if (question.options.length === 4) {
    return question.correctIndex >= 0 && question.correctIndex <= 3 ? question : null;
  }

  if (question.options.length !== 2 || question.correctIndex < 0 || question.correctIndex > 1) {
    return null;
  }

  const normalizedOptions = question.options.map(option => option.trim().toLowerCase());
  if (normalizedOptions[0] !== 'true' || normalizedOptions[1] !== 'false') {
    return null;
  }

  return {
    ...question,
    options: ['True', 'False'],
  };
}

function isRawQuizQuestion(value: unknown): value is RawQuizQuestion {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RawQuizQuestion>;
  return (
    typeof candidate.question === 'string'
    && Array.isArray(candidate.options)
    && candidate.options.every((option) => typeof option === 'string')
    && typeof candidate.correctIndex === 'number'
    && (candidate.explanation === undefined || typeof candidate.explanation === 'string')
  );
}

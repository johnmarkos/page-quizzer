import type { Problem } from '../engine/types.js';

export type QuizzerCoreProblem = {
  id: string;
  type: 'multiple-choice';
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
  tags?: string[];
};

export function toQuizzerCore(problem: Problem): QuizzerCoreProblem {
  const correctIndex = problem.options.findIndex(option => option.correct);

  if (correctIndex === -1) {
    throw new Error(`Problem "${problem.id}" must have at least one correct option`);
  }

  return {
    id: problem.id,
    type: 'multiple-choice',
    question: problem.question,
    options: problem.options.map(option => option.text),
    correct: correctIndex,
    ...(problem.explanation !== undefined ? { explanation: problem.explanation } : {}),
  };
}

export function fromQuizzerCore(problem: QuizzerCoreProblem): Problem {
  if (problem.correct < 0 || problem.correct >= problem.options.length) {
    throw new Error(
      `QuizzerCore problem "${problem.id}" has invalid correct index ${problem.correct}`,
    );
  }

  return {
    id: problem.id,
    question: problem.question,
    options: problem.options.map((optionText, index) => ({
      text: optionText,
      correct: index === problem.correct,
    })),
    ...(problem.explanation !== undefined ? { explanation: problem.explanation } : {}),
  };
}

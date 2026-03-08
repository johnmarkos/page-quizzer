import type { Answer, Problem } from '../engine/types.js';

export function cloneProblems(problems: Problem[]): Problem[] {
  return problems.map(problem => ({
    ...problem,
    options: problem.options.map(option => ({ ...option })),
  }));
}

export function getMissedProblems(problems: Problem[], answers: Answer[]): Problem[] {
  const missedIds = new Set(
    answers
      .filter(answer => !answer.correct)
      .map(answer => answer.problemId),
  );

  return cloneProblems(
    problems.filter(problem => missedIds.has(problem.id)),
  );
}

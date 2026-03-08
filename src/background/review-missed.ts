import type { Answer, Problem } from '../engine/types.js';
import type { ReviewItem } from '../shared/messages.js';
import { cloneProblems } from './retry-missed.js';

export function buildReviewItems(problems: Problem[], answers: Answer[]): ReviewItem[] {
  const answersByProblemId = new Map(
    answers.map(answer => [answer.problemId, answer]),
  );

  return cloneProblems(problems)
    .map((problem) => {
      const answer = answersByProblemId.get(problem.id);
      if (!answer || answer.correct) {
        return null;
      }

      const correctIndex = problem.options.findIndex(option => option.correct);
      return {
        problemId: problem.id,
        question: problem.question,
        explanation: problem.explanation,
        selectedIndex: answer.selectedIndex,
        correctIndex,
        options: problem.options.map((option, index) => ({
          text: option.text,
          correct: index === correctIndex,
          selected: index === answer.selectedIndex,
        })),
      };
    })
    .filter((item): item is ReviewItem => item !== null);
}

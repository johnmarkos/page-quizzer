import { describe, expect, it } from 'vitest';
import type { Answer, Problem } from '../../src/engine/types.js';
import { buildReviewItems } from '../../src/background/review-missed.js';

function mockProblem(id: string): Problem {
  return {
    id,
    question: `Question ${id}?`,
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: `Explanation for ${id}`,
  };
}

describe('buildReviewItems', () => {
  it('returns only incorrectly answered questions with correct and selected markers', () => {
    const problems = [mockProblem('1'), mockProblem('2'), mockProblem('3')];
    const answers: Answer[] = [
      { problemId: '1', selectedIndex: 0, correct: true },
      { problemId: '2', selectedIndex: 2, correct: false },
    ];

    const reviewItems = buildReviewItems(problems, answers);

    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].problemId).toBe('2');
    expect(reviewItems[0].correctIndex).toBe(0);
    expect(reviewItems[0].selectedIndex).toBe(2);
    expect(reviewItems[0].options[0].correct).toBe(true);
    expect(reviewItems[0].options[2].selected).toBe(true);
    expect(reviewItems[0].explanation).toBe('Explanation for 2');
  });

  it('returns defensive copies of question content', () => {
    const problems = [mockProblem('1')];
    const answers: Answer[] = [
      { problemId: '1', selectedIndex: 1, correct: false },
    ];

    const reviewItems = buildReviewItems(problems, answers);
    reviewItems[0].question = 'Mutated';
    reviewItems[0].options[0].text = 'Changed';

    expect(problems[0].question).toBe('Question 1?');
    expect(problems[0].options[0].text).toBe('A');
  });
});

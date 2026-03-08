import { describe, expect, it } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import {
  buildQuestionPerformanceKey,
  recordQuestionPerformance,
} from '../../src/background/question-performance.js';

function buildProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'problem-1',
    question: 'What is inertia?',
    options: [
      { text: 'Resistance to changes in motion', correct: true },
      { text: 'Stored heat', correct: false },
      { text: 'A path', correct: false },
      { text: 'A force', correct: false },
    ],
    ...overrides,
  };
}

describe('question performance tracking', () => {
  it('builds the same key for the same question despite option order differences', () => {
    const first = buildProblem();
    const second = buildProblem({
      id: 'problem-2',
      options: [
        { text: 'A force', correct: false },
        { text: 'Resistance to changes in motion', correct: true },
        { text: 'Stored heat', correct: false },
        { text: 'A path', correct: false },
      ],
    });

    expect(buildQuestionPerformanceKey(first)).toBe(buildQuestionPerformanceKey(second));
  });

  it('normalizes whitespace and casing in the key', () => {
    const first = buildProblem({
      question: 'What is inertia?',
      options: [
        { text: 'Resistance to changes in motion', correct: true },
        { text: 'Stored heat', correct: false },
        { text: 'A path', correct: false },
        { text: 'A force', correct: false },
      ],
    });
    const second = buildProblem({
      question: '  what IS   inertia? ',
      options: [
        { text: ' resistance to changes in motion ', correct: true },
        { text: 'stored HEAT', correct: false },
        { text: 'a PATH', correct: false },
        { text: 'a force', correct: false },
      ],
    });

    expect(buildQuestionPerformanceKey(first)).toBe(buildQuestionPerformanceKey(second));
  });

  it('increments seen and correct counts immutably', () => {
    const problem = buildProblem();
    const first = recordQuestionPerformance({}, problem, true);
    const second = recordQuestionPerformance(first, problem, false);
    const key = buildQuestionPerformanceKey(problem);

    expect(first[key]).toEqual({ seen: 1, correct: 1 });
    expect(second[key]).toEqual({ seen: 2, correct: 1 });
    expect(first[key]).toEqual({ seen: 1, correct: 1 });
  });

  it('tracks different questions separately', () => {
    const firstProblem = buildProblem();
    const secondProblem = buildProblem({
      question: 'What is momentum?',
      options: [
        { text: 'Mass times velocity', correct: true },
        { text: 'Stored heat', correct: false },
        { text: 'A path', correct: false },
        { text: 'A force', correct: false },
      ],
    });

    const performance = recordQuestionPerformance(
      recordQuestionPerformance({}, firstProblem, true),
      secondProblem,
      false,
    );

    expect(Object.keys(performance)).toHaveLength(2);
  });
});

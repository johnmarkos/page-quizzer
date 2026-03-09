import { describe, expect, it } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import {
  fromQuizzerCore,
  toQuizzerCore,
  type QuizzerCoreProblem,
} from '../../src/providers/quizzer-core-adapter.js';

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
    explanation: 'Inertia resists changes in motion.',
    ...overrides,
  };
}

function buildQuizzerCoreProblem(
  overrides: Partial<QuizzerCoreProblem> = {},
): QuizzerCoreProblem {
  return {
    id: 'mc-001',
    type: 'multiple-choice',
    question: 'What is inertia?',
    options: [
      'Resistance to changes in motion',
      'Stored heat',
      'A path',
      'A force',
    ],
    correct: 0,
    explanation: 'Inertia resists changes in motion.',
    ...overrides,
  };
}

describe('quizzer-core adapter', () => {
  it('converts a four-option PageQuizzer problem to quizzer-core format', () => {
    expect(toQuizzerCore(buildProblem())).toEqual({
      id: 'problem-1',
      type: 'multiple-choice',
      question: 'What is inertia?',
      options: [
        'Resistance to changes in motion',
        'Stored heat',
        'A path',
        'A force',
      ],
      correct: 0,
      explanation: 'Inertia resists changes in motion.',
    });
  });

  it('converts a true-false PageQuizzer problem to quizzer-core format', () => {
    expect(
      toQuizzerCore(
        buildProblem({
          id: 'problem-2',
          question: 'Energy can be created from nothing.',
          options: [
            { text: 'True', correct: false },
            { text: 'False', correct: true },
          ],
          explanation: undefined,
        }),
      ),
    ).toEqual({
      id: 'problem-2',
      type: 'multiple-choice',
      question: 'Energy can be created from nothing.',
      options: ['True', 'False'],
      correct: 1,
    });
  });

  it('throws when converting a PageQuizzer problem with multiple correct options', () => {
    expect(() =>
      toQuizzerCore(
        buildProblem({
          options: [
            { text: 'Option A', correct: false },
            { text: 'Option B', correct: true },
            { text: 'Option C', correct: true },
            { text: 'Option D', correct: false },
          ],
        }),
      ),
    ).toThrow('Problem "problem-1" must have exactly one correct option; found 2');
  });

  it('preserves a correct answer at the last option index', () => {
    const adaptedProblem = toQuizzerCore(
      buildProblem({
        options: [
          { text: 'Mercury', correct: false },
          { text: 'Venus', correct: false },
          { text: 'Earth', correct: false },
          { text: 'Mars', correct: true },
        ],
      }),
    );

    expect(adaptedProblem.correct).toBe(3);
  });

  it('throws when converting a PageQuizzer problem with no correct option', () => {
    expect(() =>
      toQuizzerCore(
        buildProblem({
          options: [
            { text: 'Mercury', correct: false },
            { text: 'Venus', correct: false },
            { text: 'Earth', correct: false },
            { text: 'Mars', correct: false },
          ],
        }),
      ),
    ).toThrow('Problem "problem-1" must have exactly one correct option; found 0');
  });

  it('converts a quizzer-core problem back to PageQuizzer format', () => {
    expect(fromQuizzerCore(buildQuizzerCoreProblem())).toEqual({
      id: 'mc-001',
      question: 'What is inertia?',
      options: [
        { text: 'Resistance to changes in motion', correct: true },
        { text: 'Stored heat', correct: false },
        { text: 'A path', correct: false },
        { text: 'A force', correct: false },
      ],
      explanation: 'Inertia resists changes in motion.',
    });
  });

  it('marks the first option correct when the quizzer-core correct index is zero', () => {
    const convertedProblem = fromQuizzerCore(
      buildQuizzerCoreProblem({
        correct: 0,
      }),
    );

    expect(convertedProblem.options[0]).toEqual({
      text: 'Resistance to changes in motion',
      correct: true,
    });
  });

  it('round-trips a PageQuizzer problem through quizzer-core format', () => {
    const originalProblem = buildProblem({
      id: 'problem-9',
      question: 'Which layer of Earth is liquid iron?',
      options: [
        { text: 'Crust', correct: false },
        { text: 'Mantle', correct: false },
        { text: 'Outer core', correct: true },
        { text: 'Inner core', correct: false },
      ],
    });

    expect(fromQuizzerCore(toQuizzerCore(originalProblem))).toEqual(originalProblem);
  });

  it('preserves an empty explanation string instead of dropping it', () => {
    const originalProblem = buildProblem({
      explanation: '',
    });

    expect(fromQuizzerCore(toQuizzerCore(originalProblem))).toEqual(originalProblem);
  });

  it('throws when converting a quizzer-core problem with an out-of-bounds correct index', () => {
    expect(() =>
      fromQuizzerCore(
        buildQuizzerCoreProblem({
          correct: 4,
        }),
      ),
    ).toThrow('QuizzerCore problem "mc-001" has invalid correct index 4');
  });

  it('throws when converting a quizzer-core problem with a non-integer correct index', () => {
    expect(() =>
      fromQuizzerCore(
        buildQuizzerCoreProblem({
          correct: 1.5,
        }),
      ),
    ).toThrow('QuizzerCore problem "mc-001" has invalid correct index 1.5');
  });

  it('does not mutate the source PageQuizzer problem', () => {
    const problem = buildProblem();
    const snapshot = structuredClone(problem);

    const adaptedProblem = toQuizzerCore(problem);

    expect(problem).toEqual(snapshot);
    expect(adaptedProblem.options).not.toBe(problem.options);
  });

  it('does not mutate the source quizzer-core problem', () => {
    const problem = buildQuizzerCoreProblem();
    const snapshot = structuredClone(problem);

    const adaptedProblem = fromQuizzerCore(problem);

    expect(problem).toEqual(snapshot);
    expect(adaptedProblem.options).not.toBe(problem.options);
  });
});

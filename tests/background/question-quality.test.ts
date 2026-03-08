import { describe, expect, it } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import {
  buildGenerationBuffer,
  filterLowQualityQuestions,
  getQuestionQualityIssues,
} from '../../src/background/question-quality.js';

function buildProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'problem-1',
    question: 'Which statement best explains inertia?',
    options: [
      { text: 'It is the tendency of matter to resist changes in motion', correct: true },
      { text: 'It is the amount of heat stored in an object', correct: false },
      { text: 'It is the force that creates gravity on Earth', correct: false },
      { text: 'It is the visible path drawn by a moving object', correct: false },
    ],
    ...overrides,
  };
}

describe('question quality heuristics', () => {
  it('keeps reasonable multiple-choice questions', () => {
    expect(getQuestionQualityIssues(buildProblem())).toEqual([]);
  });

  it('rejects duplicate options', () => {
    const problem = buildProblem({
      options: [
        { text: 'Resistance to changes in motion', correct: true },
        { text: 'Resistance to changes in motion', correct: false },
        { text: 'Thermal energy stored in matter', correct: false },
        { text: 'The path of a moving object', correct: false },
      ],
    });

    expect(getQuestionQualityIssues(problem)).toContain('duplicate-options');
  });

  it('rejects banned giveaway option patterns', () => {
    const problem = buildProblem({
      options: [
        { text: 'Resistance to changes in motion', correct: true },
        { text: 'All of the above', correct: false },
        { text: 'Thermal energy stored in matter', correct: false },
        { text: 'The path of a moving object', correct: false },
      ],
    });

    expect(getQuestionQualityIssues(problem)).toContain('banned-option-pattern');
  });

  it('rejects an obviously length-skewed correct answer', () => {
    const problem = buildProblem({
      options: [
        {
          text: 'It is the tendency of matter to maintain its current state of motion unless acted on by an external force that changes that state',
          correct: true,
        },
        { text: 'Stored heat', correct: false },
        { text: 'A push', correct: false },
        { text: 'A path', correct: false },
      ],
    });

    expect(getQuestionQualityIssues(problem)).toContain('correct-option-length-outlier');
  });

  it('rejects when only one option is a full sentence', () => {
    const problem = buildProblem({
      options: [
        {
          text: 'It is the tendency of matter to resist changes in motion.',
          correct: true,
        },
        { text: 'Stored heat', correct: false },
        { text: 'A push', correct: false },
        { text: 'A path', correct: false },
      ],
    });

    expect(getQuestionQualityIssues(problem)).toContain('single-sentence-like-option');
  });

  it('preserves true/false questions unless they have clear structural issues', () => {
    const problem = buildProblem({
      options: [
        { text: 'True', correct: true },
        { text: 'False', correct: false },
      ],
    });

    expect(getQuestionQualityIssues(problem)).toEqual([]);
  });

  it('filters out only low-quality questions', () => {
    const accepted = buildProblem({ id: 'accepted' });
    const rejected = buildProblem({
      id: 'rejected',
      options: [
        { text: 'Resistance to changes in motion', correct: true },
        { text: 'All of the above', correct: false },
        { text: 'Thermal energy stored in matter', correct: false },
        { text: 'The path of a moving object', correct: false },
      ],
    });

    expect(filterLowQualityQuestions([accepted, rejected]).map((problem) => problem.id)).toEqual(['accepted']);
  });

  it('rejects bibliographic trivia questions', () => {
    const problem = buildProblem({
      question: 'Which edition of the book was published in 1963?',
    });

    expect(getQuestionQualityIssues(problem)).toContain('bibliographic-trivia');
  });

  it('rejects questions where only the correct answer is domain-specific', () => {
    const problem = buildProblem({
      options: [
        { text: 'Conservation of momentum during collisions', correct: true },
        { text: 'A general idea about movement', correct: false },
        { text: 'Some kind of force', correct: false },
        { text: 'An important thing in physics', correct: false },
      ],
    });

    expect(getQuestionQualityIssues(problem)).toContain('correct-option-specificity-outlier');
  });

  it('rejects multiple vague distractors', () => {
    const problem = buildProblem({
      options: [
        { text: 'Resistance to changes in motion', correct: true },
        { text: 'A general idea about movement', correct: false },
        { text: 'Some kind of force', correct: false },
        { text: 'The path of a moving object', correct: false },
      ],
    });

    expect(getQuestionQualityIssues(problem)).toContain('vague-distractors');
  });

  it('adds a small generation buffer without overshooting too far', () => {
    expect(buildGenerationBuffer(1)).toBe(0);
    expect(buildGenerationBuffer(2)).toBe(1);
    expect(buildGenerationBuffer(5)).toBe(2);
    expect(buildGenerationBuffer(10)).toBe(3);
  });
});

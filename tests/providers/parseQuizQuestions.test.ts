import { describe, expect, it } from 'vitest';
import { parseQuizQuestions } from '../../src/providers/parseQuizQuestions.js';

describe('parseQuizQuestions', () => {
  it('accepts four-option questions', () => {
    const problems = parseQuizQuestions([
      {
        question: 'Which one is correct?',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 2,
        explanation: 'Because C is right.',
      },
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0].options).toHaveLength(4);
    expect(problems[0].options[2].correct).toBe(true);
  });

  it('accepts and normalizes true-false questions', () => {
    const problems = parseQuizQuestions([
      {
        question: 'True or false?',
        options: [' true ', ' false '],
        correctIndex: 1,
        explanation: 'False is correct here.',
      },
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0].options).toHaveLength(2);
    expect(problems[0].options[0].text).toBe('True');
    expect(problems[0].options[1].text).toBe('False');
    expect(problems[0].options[1].correct).toBe(true);
  });

  it('rejects invalid two-option questions that are not true-false', () => {
    const problems = parseQuizQuestions([
      {
        question: 'Pick one',
        options: ['Yes', 'No'],
        correctIndex: 0,
      },
    ]);

    expect(problems).toHaveLength(0);
  });
});

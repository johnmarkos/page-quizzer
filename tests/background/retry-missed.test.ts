import { describe, expect, it } from 'vitest';
import { QuizEngine } from '../../src/engine/QuizEngine.js';
import type { EngineEventPayloads, Problem } from '../../src/engine/types.js';
import { getMissedProblems } from '../../src/background/retry-missed.js';

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
  };
}

function collectCompletions(engine: QuizEngine): EngineEventPayloads['quizComplete'][] {
  const completions: EngineEventPayloads['quizComplete'][] = [];
  engine.on('quizComplete', (payload) => completions.push(payload));
  return completions;
}

describe('getMissedProblems', () => {
  it('returns only incorrectly answered problems for retry', () => {
    const problems = [mockProblem('1'), mockProblem('2'), mockProblem('3')];
    const engine = new QuizEngine();
    const completions = collectCompletions(engine);

    engine.loadProblems(problems);
    engine.start(false);
    engine.selectOption(0); // correct
    engine.next();
    engine.selectOption(1); // incorrect
    engine.next();
    engine.skip(); // skipped questions should not be retried

    const missed = getMissedProblems(problems, completions[0].answers);

    expect(missed).toHaveLength(1);
    expect(missed[0].id).toBe('2');

    const retryEngine = new QuizEngine();
    retryEngine.loadProblems(missed);
    retryEngine.start(false);

    expect(retryEngine.totalProblems).toBe(1);
    expect(retryEngine.currentProblem?.id).toBe('2');
  });

  it('returns defensive copies of retry problems', () => {
    const problems = [mockProblem('1')];
    const answers = [{ problemId: '1', selectedIndex: 2, correct: false }];

    const missed = getMissedProblems(problems, answers);
    missed[0].question = 'Mutated';
    missed[0].options[0].text = 'Changed';

    expect(problems[0].question).toBe('Question 1?');
    expect(problems[0].options[0].text).toBe('A');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { QuizEngine } from '../../src/engine/QuizEngine.js';
import type { Problem, EngineEvent, EngineEventPayloads } from '../../src/engine/types.js';
import sampleProblems from '../fixtures/sample-problems.json';

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

function collectEvents<E extends EngineEvent>(engine: QuizEngine, event: E) {
  const events: EngineEventPayloads[E][] = [];
  engine.on(event, (payload) => events.push(payload));
  return events;
}

describe('QuizEngine', () => {
  let engine: QuizEngine;

  beforeEach(() => {
    engine = new QuizEngine();
  });

  it('starts in idle state', () => {
    expect(engine.state).toBe('idle');
    expect(engine.currentProblem).toBeNull();
  });

  it('loads problems and stays idle', () => {
    engine.loadProblems([mockProblem('1'), mockProblem('2')]);
    expect(engine.state).toBe('idle');
    expect(engine.totalProblems).toBe(2);
  });

  it('does nothing if start called with no problems', () => {
    engine.start();
    expect(engine.state).toBe('idle');
  });

  it('transitions to practicing on start', () => {
    const stateChanges = collectEvents(engine, 'stateChange');
    engine.loadProblems([mockProblem('1')]);
    stateChanges.length = 0; // clear the idle transition from load

    engine.start(false);
    expect(engine.state).toBe('practicing');
    expect(stateChanges.length).toBe(1);
    expect(stateChanges[0]).toEqual({ from: 'idle', to: 'practicing' });
  });

  it('emits questionShow on start', () => {
    const questions = collectEvents(engine, 'questionShow');
    engine.loadProblems([mockProblem('1'), mockProblem('2')]);
    engine.start(false);

    expect(questions.length).toBe(1);
    expect(questions[0].index).toBe(0);
    expect(questions[0].total).toBe(2);
  });

  it('transitions to answered after selectOption', () => {
    engine.loadProblems([mockProblem('1')]);
    engine.start(false);

    const results = collectEvents(engine, 'answerResult');
    engine.selectOption(0); // correct answer

    expect(engine.state).toBe('answered');
    expect(results.length).toBe(1);
    expect(results[0].correct).toBe(true);
    expect(results[0].correctIndex).toBe(0);
  });

  it('marks incorrect answers', () => {
    engine.loadProblems([mockProblem('1')]);
    engine.start(false);

    const results = collectEvents(engine, 'answerResult');
    engine.selectOption(1); // incorrect

    expect(results[0].correct).toBe(false);
  });

  it('moves to next question', () => {
    const questions = collectEvents(engine, 'questionShow');
    engine.loadProblems([mockProblem('1'), mockProblem('2')]);
    engine.start(false);
    engine.selectOption(0);

    questions.length = 0;
    engine.next();

    expect(engine.state).toBe('practicing');
    expect(questions.length).toBe(1);
    expect(questions[0].index).toBe(1);
  });

  it('completes after last question', () => {
    const completions = collectEvents(engine, 'quizComplete');
    engine.loadProblems([mockProblem('1')]);
    engine.start(false);
    engine.selectOption(0);
    engine.next();

    expect(engine.state).toBe('complete');
    expect(completions.length).toBe(1);
    expect(completions[0].score.correct).toBe(1);
    expect(completions[0].score.total).toBe(1);
    expect(completions[0].score.percentage).toBe(100);
  });

  it('tracks score across multiple questions', () => {
    const completions = collectEvents(engine, 'quizComplete');
    engine.loadProblems([mockProblem('1'), mockProblem('2'), mockProblem('3')]);
    engine.start(false);

    engine.selectOption(0); // correct
    engine.next();
    engine.selectOption(1); // incorrect
    engine.next();
    engine.selectOption(0); // correct
    engine.next();

    expect(completions[0].score.correct).toBe(2);
    expect(completions[0].score.incorrect).toBe(1);
    expect(completions[0].score.percentage).toBe(67);
  });

  it('handles skip', () => {
    const completions = collectEvents(engine, 'quizComplete');
    engine.loadProblems([mockProblem('1'), mockProblem('2')]);
    engine.start(false);

    engine.skip(); // skip first
    engine.selectOption(0); // answer second correctly
    engine.next();

    expect(completions[0].score.skipped).toBe(1);
    expect(completions[0].score.correct).toBe(1);
  });

  it('ignores selectOption when not practicing', () => {
    engine.loadProblems([mockProblem('1')]);
    engine.selectOption(0); // idle state — should be ignored
    expect(engine.state).toBe('idle');
  });

  it('ignores next when not answered', () => {
    engine.loadProblems([mockProblem('1')]);
    engine.start(false);
    engine.next(); // practicing state — should be ignored
    expect(engine.state).toBe('practicing');
  });

  it('works with fixture data', () => {
    engine.loadProblems(sampleProblems as Problem[]);
    expect(engine.totalProblems).toBe(3);
    engine.start(false);
    expect(engine.state).toBe('practicing');
  });

  it('supports on/off for listeners', () => {
    const events: any[] = [];
    const listener = (p: any) => events.push(p);

    engine.on('stateChange', listener);
    engine.loadProblems([mockProblem('1')]);
    expect(events.length).toBe(1); // idle from load

    engine.off('stateChange', listener);
    engine.start(false);
    expect(events.length).toBe(1); // no new events after off
  });

  // --- Serialize / Restore ---

  it('serializes engine state', () => {
    engine.loadProblems([mockProblem('1'), mockProblem('2')]);
    engine.start(false);
    engine.selectOption(0);

    const snapshot = engine.serialize();
    expect(snapshot.state).toBe('answered');
    expect(snapshot.problems.length).toBe(2);
    expect(snapshot.currentIndex).toBe(0);
    expect(snapshot.answers.length).toBe(1);
    expect(snapshot.startedAt).toBeGreaterThan(0);
  });

  it('restores engine from snapshot', () => {
    engine.loadProblems([mockProblem('1'), mockProblem('2'), mockProblem('3')]);
    engine.start(false);
    engine.selectOption(0); // answer first correctly
    engine.next();

    // Snapshot mid-quiz at question 2
    const snapshot = engine.serialize();
    expect(snapshot.state).toBe('practicing');
    expect(snapshot.currentIndex).toBe(1);

    // Restore into a fresh engine
    const restored = new QuizEngine();
    restored.restore(snapshot);

    expect(restored.state).toBe('practicing');
    expect(restored.currentIndex).toBe(1);
    expect(restored.totalProblems).toBe(3);
    expect(restored.currentProblem?.id).toBe('2');

    // Continue the quiz
    const completions = collectEvents(restored, 'quizComplete');
    restored.selectOption(0);
    restored.next();
    restored.selectOption(0);
    restored.next();

    expect(completions.length).toBe(1);
    expect(completions[0].score.correct).toBe(3);
    expect(completions[0].score.total).toBe(3);
  });

  it('restore makes defensive copies', () => {
    engine.loadProblems([mockProblem('1')]);
    engine.start(false);
    const snapshot = engine.serialize();

    // Mutate the snapshot after restoring
    const restored = new QuizEngine();
    restored.restore(snapshot);
    snapshot.problems[0].question = 'Mutated!';

    expect(restored.currentProblem?.question).toBe('Question 1?');
  });

  it('makes defensive copies of problems', () => {
    const original = [mockProblem('1')];
    engine.loadProblems(original);
    original[0].question = 'Modified!';

    engine.start(false);
    // The engine's copy should not be affected
    expect(engine.currentProblem?.question).toBe('Question 1?');
  });
});

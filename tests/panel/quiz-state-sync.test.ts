import { describe, expect, it } from 'vitest';
import type { RestoredStateMessage } from '../../src/shared/messages.js';
import { getQuestionPayloadFromRestoredState } from '../../src/panel/quiz-state-sync.js';

describe('quiz state sync helpers', () => {
  it('returns the active question payload for practicing state', () => {
    const response: RestoredStateMessage = {
      type: 'RESTORED_STATE',
      payload: {
        state: 'practicing',
        problem: {
          id: 'problem-1',
          question: 'What is inertia?',
          options: [
            { text: 'Resistance to changes in motion', correct: true },
            { text: 'A type of force', correct: false },
          ],
        },
        index: 2,
        total: 5,
        title: 'Physics',
      },
    };

    expect(getQuestionPayloadFromRestoredState(response)).toEqual({
      problem: response.payload.problem,
      index: 2,
      total: 5,
    });
  });

  it('returns the active question payload for answered state', () => {
    const response: RestoredStateMessage = {
      type: 'RESTORED_STATE',
      payload: {
        state: 'answered',
        problem: {
          id: 'problem-1',
          question: 'What is inertia?',
          options: [
            { text: 'Resistance to changes in motion', correct: true },
            { text: 'A type of force', correct: false },
          ],
        },
        index: 1,
        total: 4,
        title: 'Physics',
      },
    };

    expect(getQuestionPayloadFromRestoredState(response)).toEqual({
      problem: response.payload.problem,
      index: 1,
      total: 4,
    });
  });

  it('ignores idle, ready, and complete states', () => {
    const idleResponse: RestoredStateMessage = {
      type: 'RESTORED_STATE',
      payload: { state: 'idle' },
    };

    expect(getQuestionPayloadFromRestoredState(idleResponse)).toBeNull();

    const readyResponse: RestoredStateMessage = {
      type: 'RESTORED_STATE',
      payload: {
        state: 'ready',
        title: 'Physics',
        total: 4,
      },
    };

    expect(getQuestionPayloadFromRestoredState(readyResponse)).toBeNull();
  });
});

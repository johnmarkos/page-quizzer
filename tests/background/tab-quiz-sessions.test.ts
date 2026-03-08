import { describe, expect, it } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import {
  createEmptySession,
  getTabQuizSession,
  hasSessionData,
  removeTabQuizSession,
  setTabQuizSession,
  type TabQuizSessionMap,
} from '../../src/background/tab-quiz-sessions.js';

function mockProblem(id: string): Problem {
  return {
    id,
    question: `Question ${id}?`,
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
    ],
  };
}

describe('tab quiz sessions', () => {
  it('returns a defensive copy of the requested tab session', () => {
    const sessions: TabQuizSessionMap = {
      '42': {
        snapshot: {
          state: 'practicing',
          problems: [mockProblem('1')],
          currentIndex: 0,
          answers: [],
          startedAt: 123,
        },
        lastExtracted: {
          title: 'Physics',
          content: '<p>Atoms</p>',
          textContent: 'Atoms in motion',
          wordCount: 120,
          excerpt: 'Atoms',
          url: 'https://example.com/physics',
          pageTexts: ['Atoms in motion'],
        },
        pendingSections: [
          {
            index: 0,
            title: 'Chapter 1',
            wordCount: 800,
            preview: 'Atoms are moving',
          },
        ],
        currentTopics: ['Physics'],
        lastCompletedQuiz: null,
        generationWarning: 'Stopped early',
      },
    };

    const session = getTabQuizSession(sessions, 42);
    session.snapshot.problems[0].question = 'Mutated';
    session.currentTopics[0] = 'Changed';
    session.pendingSections?.[0] && (session.pendingSections[0].title = 'Changed');
    session.lastExtracted?.pageTexts && (session.lastExtracted.pageTexts[0] = 'Changed');

    expect(sessions['42'].snapshot.problems[0].question).toBe('Question 1?');
    expect(sessions['42'].currentTopics[0]).toBe('Physics');
    expect(sessions['42'].pendingSections?.[0]?.title).toBe('Chapter 1');
    expect(sessions['42'].lastExtracted?.pageTexts?.[0]).toBe('Atoms in motion');
  });

  it('removes empty sessions from storage decisions', () => {
    expect(hasSessionData(createEmptySession())).toBe(false);

    const readySession = createEmptySession();
    readySession.snapshot.problems = [mockProblem('1')];

    expect(hasSessionData(readySession)).toBe(true);

    const sectionSession = createEmptySession();
    sectionSession.pendingSections = [
      { index: 0, title: 'Part 1', wordCount: 700, preview: 'Atoms' },
    ];

    expect(hasSessionData(sectionSession)).toBe(true);
  });

  it('sets and removes sessions by tab id', () => {
    const stored = setTabQuizSession({}, 7, createEmptySession());
    expect(getTabQuizSession(stored, 7).snapshot.state).toBe('idle');

    const removed = removeTabQuizSession(stored, 7);
    expect(getTabQuizSession(removed, 7)).toEqual(createEmptySession());
  });
});

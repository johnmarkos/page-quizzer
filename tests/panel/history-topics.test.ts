import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/background/StorageManager.js';
import { filterSessionsByTopic, getHistoryTopics } from '../../src/panel/history-topics.js';

function mockSession(id: string, topics?: string[]): SessionRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Session ${id}`,
    date: 1_000,
    topics,
    score: {
      correct: 2,
      incorrect: 1,
      skipped: 0,
      total: 3,
      percentage: 67,
    },
    answers: [{ problemId: `${id}-problem`, selectedIndex: 0, correct: true }],
    startedAt: 500,
    completedAt: 1_000,
  };
}

describe('history topic helpers', () => {
  it('collects unique sorted topics across sessions', () => {
    const topics = getHistoryTopics([
      mockSession('one', ['physics', 'science']),
      mockSession('two', ['science', 'history']),
      mockSession('three'),
    ]);

    expect(topics).toEqual(['history', 'physics', 'science']);
  });

  it('filters sessions by a selected topic', () => {
    const sessions = [
      mockSession('one', ['physics']),
      mockSession('two', ['history']),
      mockSession('three', ['physics', 'history']),
    ];

    expect(filterSessionsByTopic(sessions, null)).toHaveLength(3);
    expect(filterSessionsByTopic(sessions, 'physics').map(session => session.id)).toEqual(['one', 'three']);
  });
});

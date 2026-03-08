import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/background/StorageManager.js';
import { mergeSessionRecords, parseImportedSessions } from '../../src/background/history-import.js';
import { serializeHistoryRecords } from '../../src/panel/history-export.js';

function mockSession(id: string, date: number): SessionRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Session ${id}`,
    date,
    score: {
      correct: 2,
      incorrect: 1,
      skipped: 0,
      total: 3,
      percentage: 67,
    },
    answers: [
      { problemId: `problem-${id}`, selectedIndex: 1, correct: false },
    ],
    startedAt: date - 60_000,
    completedAt: date,
  };
}

describe('history import helpers', () => {
  it('parses exported sessions back into validated session records', () => {
    const original = [mockSession('one', 1000), mockSession('two', 2000)];
    const json = serializeHistoryRecords(original);

    const parsed = parseImportedSessions(json);

    expect(parsed).toEqual(original);
  });

  it('rejects invalid session payloads', () => {
    const invalidJson = JSON.stringify([{ id: 'bad', title: 'Missing fields' }]);
    expect(() => parseImportedSessions(invalidJson)).toThrow('missing a valid url');
  });

  it('merges imported sessions by id and keeps date order', () => {
    const existing = [mockSession('one', 1000), mockSession('two', 2000)];
    const imported = [mockSession('two', 3000), mockSession('three', 1500)];

    const merged = mergeSessionRecords(existing, imported);

    expect(merged.map(record => record.id)).toEqual(['one', 'three', 'two']);
    expect(merged[2].date).toBe(3000);
  });

  it('accepts imported topic tags', () => {
    const json = serializeHistoryRecords([
      {
        ...mockSession('one', 1000),
        topics: ['physics', 'science'],
      },
    ]);

    const [parsed] = parseImportedSessions(json);
    expect(parsed.topics).toEqual(['physics', 'science']);
  });
});

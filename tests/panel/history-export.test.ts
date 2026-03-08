import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/background/StorageManager.js';
import { buildHistoryExportFilename, serializeHistoryRecords } from '../../src/panel/history-export.js';

function mockSession(id: string): SessionRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Session ${id}`,
    date: Date.UTC(2026, 2, 8),
    topics: ['topic-a'],
    score: {
      correct: 3,
      incorrect: 1,
      skipped: 0,
      total: 4,
      percentage: 75,
    },
    answers: [
      { problemId: `problem-${id}`, selectedIndex: 1, correct: false },
    ],
    startedAt: Date.UTC(2026, 2, 8, 12, 0, 0),
    completedAt: Date.UTC(2026, 2, 8, 12, 5, 0),
  };
}

describe('history export helpers', () => {
  it('builds a date-stamped export filename', () => {
    const filename = buildHistoryExportFilename(new Date('2026-03-08T10:00:00Z'));
    expect(filename).toBe('pagequizzer-history-2026-03-08.json');
  });

  it('serializes history records as pretty-printed JSON', () => {
    const json = serializeHistoryRecords([mockSession('one')]);
    const parsed = JSON.parse(json) as SessionRecord[];

    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Session one');
    expect(json).toContain('\n  {');
  });
});

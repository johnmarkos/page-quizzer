import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentSection } from '../../src/shared/messages.js';
import { STORAGE_KEYS } from '../../src/shared/constants.js';
import {
  ProgressManager,
  buildProgressSummary,
  mergeSectionProgress,
  updateDocumentProgressRecord,
} from '../../src/background/ProgressManager.js';

function buildSection(index: number, overrides: Partial<ContentSection> = {}): ContentSection {
  return {
    index,
    title: `Part ${index + 1}`,
    wordCount: 900,
    preview: `Preview ${index + 1}`,
    ...overrides,
  };
}

describe('ProgressManager', () => {
  const storageState: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(storageState)) {
      delete storageState[key];
    }

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[]) => {
            if (Array.isArray(keys)) {
              return Object.fromEntries(
                keys
                  .filter((key) => key in storageState)
                  .map((key) => [key, storageState[key]]),
              );
            }

            return keys in storageState ? { [keys]: storageState[keys] } : {};
          }),
          set: vi.fn(async (value: Record<string, unknown>) => {
            Object.assign(storageState, value);
          }),
        },
      },
    });
  });

  it('merges stored progress onto fresh section definitions', () => {
    const sections = [buildSection(0), buildSection(1)];
    const merged = mergeSectionProgress(sections, {
      url: 'https://example.com/book',
      title: 'Example Book',
      sections: [
        {
          index: 1,
          title: 'Part 2',
          wordCount: 900,
          quizzed: true,
          scorePercentage: 80,
          lastQuizzed: 123,
        },
      ],
    });

    expect(merged).toEqual([
      {
        index: 0,
        title: 'Part 1',
        wordCount: 900,
        quizzed: false,
        scorePercentage: undefined,
        lastQuizzed: undefined,
      },
      {
        index: 1,
        title: 'Part 2',
        wordCount: 900,
        quizzed: true,
        scorePercentage: 80,
        lastQuizzed: 123,
      },
    ]);
  });

  it('builds a progress summary from completed sections only', () => {
    expect(buildProgressSummary([
      { quizzed: true, scorePercentage: 60 },
      { quizzed: true, scorePercentage: 80 },
      { quizzed: false, scorePercentage: undefined },
    ])).toEqual({
      completedCount: 2,
      totalCount: 3,
      averageScorePercentage: 70,
    });
  });

  it('records the completed section and persists it', async () => {
    const manager = new ProgressManager();
    const sections = [buildSection(0), buildSection(1)];

    const record = await manager.recordSectionResult(
      'https://example.com/book',
      'Example Book',
      sections,
      1,
      { correct: 4, total: 5, percentage: 80 },
      456,
    );

    expect(record.sections[1]).toMatchObject({
      index: 1,
      quizzed: true,
      scorePercentage: 80,
      lastQuizzed: 456,
    });

    expect(storageState[STORAGE_KEYS.DOCUMENT_PROGRESS]).toEqual({
      'https://example.com/book': {
        url: 'https://example.com/book',
        title: 'Example Book',
        sections: [
          {
            index: 0,
            title: 'Part 1',
            wordCount: 900,
            quizzed: false,
            scorePercentage: undefined,
            lastQuizzed: undefined,
          },
          {
            index: 1,
            title: 'Part 2',
            wordCount: 900,
            quizzed: true,
            scorePercentage: 80,
            lastQuizzed: 456,
          },
        ],
      },
    });
  });

  it('returns progress-aware sections with summary data', async () => {
    storageState[STORAGE_KEYS.DOCUMENT_PROGRESS] = {
      'https://example.com/book': updateDocumentProgressRecord(
        null,
        'https://example.com/book',
        'Example Book',
        [buildSection(0), buildSection(1)],
        0,
        { correct: 3, total: 5, percentage: 60 },
        789,
      ),
    };

    const manager = new ProgressManager();
    const result = await manager.buildSectionProgress(
      'https://example.com/book',
      [buildSection(0), buildSection(1), buildSection(2)],
    );

    expect(result.sections[0]).toMatchObject({
      index: 0,
      quizzed: true,
      scorePercentage: 60,
      lastQuizzed: 789,
    });
    expect(result.sections[2]).toMatchObject({
      index: 2,
      quizzed: false,
    });
    expect(result.summary).toEqual({
      completedCount: 1,
      totalCount: 3,
      averageScorePercentage: 60,
    });
  });
});

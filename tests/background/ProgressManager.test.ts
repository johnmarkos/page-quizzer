import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentSection } from '../../src/shared/messages.js';
import { STORAGE_KEYS } from '../../src/shared/constants.js';
import {
  buildDocumentLibraryItems,
  buildDocumentResumeState,
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
    startPage: index + 1,
    endPage: index + 1,
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
        preview: 'Preview 1',
        startPage: 1,
        endPage: 1,
        quizzed: false,
        scorePercentage: undefined,
        lastQuizzed: undefined,
      },
      {
        index: 1,
        title: 'Part 2',
        wordCount: 900,
        preview: 'Preview 2',
        startPage: 2,
        endPage: 2,
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

  it('builds resume state with the next unquizzed section', () => {
    const resumeState = buildDocumentResumeState({
      url: 'https://example.com/book',
      title: 'Example Book',
      sections: [
        {
          index: 0,
          title: 'Part 1',
          wordCount: 900,
          quizzed: true,
          scorePercentage: 70,
          lastQuizzed: 100,
        },
        {
          index: 1,
          title: 'Part 2',
          wordCount: 900,
          quizzed: false,
        },
        {
          index: 2,
          title: 'Part 3',
          wordCount: 900,
          quizzed: false,
        },
      ],
    });

    expect(resumeState).toEqual({
      title: 'Example Book',
      completedCount: 1,
      totalCount: 3,
      averageScorePercentage: 70,
      nextSectionIndex: 1,
      nextSectionTitle: 'Part 2',
      allSectionsCompleted: false,
    });
  });

  it('builds library items sorted by last activity', () => {
    const items = buildDocumentLibraryItems([
      {
        url: 'https://example.com/older',
        title: 'Older Book',
        sections: [
          { index: 0, title: 'Part 1', wordCount: 900, quizzed: true, scorePercentage: 60, lastQuizzed: 100 },
          { index: 1, title: 'Part 2', wordCount: 900, quizzed: false },
        ],
      },
      {
        url: 'https://example.com/newer',
        title: 'Newer Book',
        sections: [
          { index: 0, title: 'Part 1', wordCount: 900, quizzed: true, scorePercentage: 90, lastQuizzed: 300 },
        ],
      },
    ]);

    expect(items.map((item) => item.url)).toEqual([
      'https://example.com/newer',
      'https://example.com/older',
    ]);
    expect(items[0]).toMatchObject({
      title: 'Newer Book',
      completedCount: 1,
      totalCount: 1,
      averageScorePercentage: 90,
      allSectionsCompleted: true,
      lastActivity: 300,
    });
    expect(items[1]).toMatchObject({
      title: 'Older Book',
      nextSectionIndex: 1,
      nextSectionTitle: 'Part 2',
      lastActivity: 100,
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
      preview: 'Preview 1',
      startPage: 1,
      endPage: 1,
      quizzed: true,
      scorePercentage: 60,
      lastQuizzed: 789,
    });
    expect(result.sections[2]).toMatchObject({
      index: 2,
      preview: 'Preview 3',
      startPage: 3,
      endPage: 3,
      quizzed: false,
    });
    expect(result.summary).toEqual({
      completedCount: 1,
      totalCount: 3,
      averageScorePercentage: 60,
    });
  });
});

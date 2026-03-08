import { describe, expect, it } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import type { ExtractedContent } from '../../src/shared/messages.js';
import { resolveExportQuizData } from '../../src/background/export-quiz-data.js';

function buildProblem(id: string): Problem {
  return {
    id,
    question: `Question ${id}?`,
    options: [
      { text: 'Correct', correct: true },
      { text: 'Wrong', correct: false },
    ],
    explanation: `Explanation ${id}`,
  };
}

function buildExtractedContent(): ExtractedContent {
  return {
    title: 'Example Source',
    content: '<p>Example</p>',
    textContent: 'Example text content',
    wordCount: 120,
    excerpt: 'Example text content',
    url: 'https://example.com/source',
  };
}

describe('resolveExportQuizData', () => {
  it('uses the active quiz problems before completion', () => {
    const exportData = resolveExportQuizData({
      lastExtracted: buildExtractedContent(),
      currentProblems: [buildProblem('a'), buildProblem('b')],
      lastCompletedQuiz: null,
      engineState: 'practicing',
    });

    expect(exportData?.problems.map((problem) => problem.id)).toEqual(['a', 'b']);
  });

  it('uses the completed quiz problems when the engine is complete', () => {
    const exportData = resolveExportQuizData({
      lastExtracted: buildExtractedContent(),
      currentProblems: [buildProblem('retry-only')],
      lastCompletedQuiz: {
        problems: [buildProblem('full-1'), buildProblem('full-2'), buildProblem('full-3')],
        summary: {
          score: { correct: 2, incorrect: 1, skipped: 0, total: 3, percentage: 67 },
          answers: [],
          startedAt: 1,
          completedAt: 2,
        },
      },
      engineState: 'complete',
    });

    expect(exportData?.problems.map((problem) => problem.id)).toEqual([
      'full-1',
      'full-2',
      'full-3',
    ]);
  });

  it('returns null when there is no quiz to export', () => {
    expect(resolveExportQuizData({
      lastExtracted: null,
      currentProblems: [buildProblem('a')],
      lastCompletedQuiz: null,
      engineState: 'practicing',
    })).toBeNull();

    expect(resolveExportQuizData({
      lastExtracted: buildExtractedContent(),
      currentProblems: [],
      lastCompletedQuiz: null,
      engineState: 'idle',
    })).toBeNull();
  });

  it('returns cloned problems so export data cannot mutate runtime state', () => {
    const currentProblems = [buildProblem('a')];
    const exportData = resolveExportQuizData({
      lastExtracted: buildExtractedContent(),
      currentProblems,
      lastCompletedQuiz: null,
      engineState: 'practicing',
    });

    exportData?.problems[0]?.options[0] && (exportData.problems[0].options[0].text = 'Changed');

    expect(currentProblems[0].options[0].text).toBe('Correct');
  });
});

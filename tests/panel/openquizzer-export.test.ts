import { describe, expect, it } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import {
  buildOpenQuizzerExportFilename,
  convertToOpenQuizzerFormat,
} from '../../src/panel/openquizzer-export.js';

function buildProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'problem-1',
    question: 'What is inertia?',
    options: [
      { text: 'Resistance to changes in motion', correct: true },
      { text: 'Stored heat', correct: false },
      { text: 'A path', correct: false },
      { text: 'A force', correct: false },
    ],
    explanation: 'Inertia describes resistance to changes in motion.',
    ...overrides,
  };
}

describe('OpenQuizzer export helpers', () => {
  it('converts PageQuizzer problems into OpenQuizzer chapter format', () => {
    const chapter = convertToOpenQuizzerFormat({
      title: 'Physics Basics',
      sourceUrl: 'https://example.com/physics',
      problems: [buildProblem()],
    });

    expect(chapter).toEqual({
      chapterTitle: 'Physics Basics',
      chapterDescription: 'Generated from: https://example.com/physics',
      problems: [
        {
          id: 'mc-001',
          type: 'multiple-choice',
          question: 'What is inertia?',
          options: [
            'Resistance to changes in motion',
            'Stored heat',
            'A path',
            'A force',
          ],
          correct: 0,
          explanation: 'Inertia describes resistance to changes in motion.',
        },
      ],
    });
  });

  it('assigns sequential problem ids and correct-answer indexes', () => {
    const chapter = convertToOpenQuizzerFormat({
      title: 'Physics Basics',
      sourceUrl: 'https://example.com/physics',
      problems: [
        buildProblem(),
        buildProblem({
          id: 'problem-2',
          question: 'Which law states F = ma?',
          options: [
            { text: 'First law', correct: false },
            { text: 'Second law', correct: true },
            { text: 'Third law', correct: false },
            { text: 'Zeroth law', correct: false },
          ],
        }),
      ],
    });

    expect(chapter.problems.map(problem => problem.id)).toEqual(['mc-001', 'mc-002']);
    expect(chapter.problems.map(problem => problem.correct)).toEqual([0, 1]);
  });

  it('omits explanation when the source problem has none', () => {
    const chapter = convertToOpenQuizzerFormat({
      title: 'Physics Basics',
      sourceUrl: 'https://example.com/physics',
      problems: [
        buildProblem({
          explanation: undefined,
        }),
      ],
    });

    expect(chapter.problems[0]).not.toHaveProperty('explanation');
  });

  it('does not mutate the input problems array or option objects', () => {
    const problems = [buildProblem()];
    const snapshot = JSON.parse(JSON.stringify(problems)) as Problem[];

    const chapter = convertToOpenQuizzerFormat({
      title: 'Physics Basics',
      sourceUrl: 'https://example.com/physics',
      problems,
    });

    expect(problems).toEqual(snapshot);
    expect(chapter.problems[0].options).not.toBe(problems[0].options);
  });

  it('builds a dated JSON filename with a slugified title', () => {
    const filename = buildOpenQuizzerExportFilename(
      'The Feynman Lectures on Physics',
      new Date('2026-03-08T12:00:00Z'),
    );

    expect(filename).toBe('openquizzer-2026-03-08-the-feynman-lectures-on-physics.json');
  });

  it('falls back to a generic slug when the title has no slug characters', () => {
    expect(buildOpenQuizzerExportFilename('!!!', new Date('2026-03-08T12:00:00Z')))
      .toBe('openquizzer-2026-03-08-quiz.json');
  });

  it('round-trips through JSON parse into a valid chapter structure', () => {
    const chapter = convertToOpenQuizzerFormat({
      title: 'Physics Basics',
      sourceUrl: 'https://example.com/physics',
      problems: [buildProblem()],
    });

    const parsed = JSON.parse(JSON.stringify(chapter)) as typeof chapter;

    expect(parsed.chapterTitle).toBe('Physics Basics');
    expect(parsed.chapterDescription).toBe('Generated from: https://example.com/physics');
    expect(parsed.problems[0].type).toBe('multiple-choice');
    expect(parsed.problems[0].options).toEqual([
      'Resistance to changes in motion',
      'Stored heat',
      'A path',
      'A force',
    ]);
    expect(parsed.problems[0].correct).toBe(0);
  });
});

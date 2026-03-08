import { describe, expect, it } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import {
  buildQuizExportFilename,
  buildQuizExportHtml,
} from '../../src/panel/quiz-export.js';

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

describe('quiz export helpers', () => {
  it('builds a dated HTML filename with a title slug', () => {
    const filename = buildQuizExportFilename(
      'The Feynman Lectures on Physics',
      new Date('2026-03-08T12:00:00Z'),
    );

    expect(filename).toBe('pagequizzer-quiz-2026-03-08-the-feynman-lectures-on-physics.html');
  });

  it('falls back to a generic slug when the title has no slug characters', () => {
    expect(buildQuizExportFilename('!!!', new Date('2026-03-08T12:00:00Z')))
      .toBe('pagequizzer-quiz-2026-03-08-quiz.html');
  });

  it('embeds escaped quiz data in a standalone HTML document', () => {
    const html = buildQuizExportHtml({
      title: 'Physics <Basics>',
      sourceUrl: 'https://example.com/feynman?chapter=1',
      problems: [buildProblem()],
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Physics &lt;Basics&gt; - PageQuizzer Export');
    expect(html).toContain('https://example.com/feynman?chapter=1');
    expect(html).toContain('Exported from PageQuizzer for offline practice.');
    expect(html).toContain('"question":"What is inertia?"');
  });

  it('escapes script-breaking content inside the embedded quiz JSON', () => {
    const html = buildQuizExportHtml({
      title: 'Safe Export',
      sourceUrl: 'https://example.com',
      problems: [
        buildProblem({
          question: '</script><script>alert("xss")</script>',
        }),
      ],
    });

    expect(html).not.toContain('</script><script>alert("xss")</script>');
    expect(html).toContain('\\u003c/script>\\u003cscript>alert(\\"xss\\")\\u003c/script>');
  });

  it('does not create a clickable link for an unsafe source URL', () => {
    const html = buildQuizExportHtml({
      title: 'Safe Export',
      sourceUrl: 'javascript:alert(1)',
      problems: [buildProblem()],
    });

    expect(html).toContain('<span>javascript:alert(1)</span>');
    expect(html).not.toContain('<a href="javascript:alert(1)">');
  });
});

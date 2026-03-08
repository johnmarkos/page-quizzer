import { describe, expect, it } from 'vitest';
import {
  buildManualExtractedContent,
  buildManualGeneratePayload,
} from '../../src/panel/manual-content.js';

describe('manual content helpers', () => {
  it('builds extracted content from pasted text', () => {
    const content = buildManualExtractedContent(
      'Atoms are always moving, even in solids.',
      'Feynman Notes',
    );

    expect(content).toEqual({
      title: 'Feynman Notes',
      content: 'Atoms are always moving, even in solids.',
      textContent: 'Atoms are always moving, even in solids.',
      wordCount: 7,
      excerpt: 'Atoms are always moving, even in solids.',
      url: 'pagequizzer://pasted-text',
    });
  });

  it('normalizes whitespace-only titles to the default title', () => {
    const content = buildManualExtractedContent('  text here  ', '   ');

    expect(content.title).toBe('Pasted Text');
    expect(content.textContent).toBe('text here');
    expect(content.wordCount).toBe(2);
  });

  it('truncates long excerpts without changing the stored text content', () => {
    const longText = 'word '.repeat(80).trim();
    const content = buildManualExtractedContent(longText);

    expect(content.textContent).toBe(longText);
    expect(content.excerpt.length).toBeLessThanOrEqual(200);
  });

  it('builds an inline generate payload only when manual mode is enabled', () => {
    expect(buildManualGeneratePayload(false, 'Atoms move', 'Physics')).toBeUndefined();
    expect(buildManualGeneratePayload(true, 'Atoms move', 'Physics')).toEqual({
      content: buildManualExtractedContent('Atoms move', 'Physics'),
    });
  });

  it('rejects empty manual text when manual mode is enabled', () => {
    expect(() => buildManualGeneratePayload(true, '   ', 'Physics'))
      .toThrow('Paste some text before generating a manual quiz.');
  });
});

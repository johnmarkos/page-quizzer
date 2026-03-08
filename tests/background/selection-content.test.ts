import { describe, expect, it } from 'vitest';
import {
  buildSelectionContent,
  normalizeSelectionText,
  resolveSelectedText,
} from '../../src/background/selection-content.js';

describe('selection content', () => {
  it('normalizes whitespace in selected text', () => {
    expect(normalizeSelectionText('  atoms\n\n move\tfast  ')).toBe('atoms move fast');
  });

  it('builds extracted content from a text selection', () => {
    const content = buildSelectionContent(
      'Atoms are always moving.',
      'https://example.com/chapter-1',
      'Feynman',
    );

    expect(content).toEqual({
      title: 'Feynman (Selection)',
      content: 'Atoms are always moving.',
      textContent: 'Atoms are always moving.',
      wordCount: 4,
      excerpt: 'Atoms are always moving.',
      url: 'https://example.com/chapter-1',
    });
  });

  it('falls back to the context-menu selection text when the page selection is empty', () => {
    expect(resolveSelectedText('', '  atoms\n move  ')).toBe('atoms move');
  });
});

import { describe, expect, it } from 'vitest';
import {
  derivePdfTitle,
  looksLikePdfUrl,
  resolvePdfUrl,
  textContentToString,
} from '../../src/shared/pdf.js';

describe('PdfExtractor helpers', () => {
  it('detects direct PDF URLs', () => {
    expect(looksLikePdfUrl('https://example.com/file.pdf')).toBe(true);
    expect(looksLikePdfUrl('https://example.com/file.pdf?download=1')).toBe(true);
    expect(looksLikePdfUrl('https://example.com/file.html')).toBe(false);
  });

  it('resolves viewer-style file parameters to the underlying PDF URL', () => {
    const url = 'chrome-extension://viewer/index.html?file=https%3A%2F%2Fexample.com%2Fpaper.pdf';
    expect(resolvePdfUrl(url)).toBe('https://example.com/paper.pdf');
  });

  it('resolves chrome pdf viewer src parameters to the underlying PDF URL', () => {
    const url = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html?src=https%3A%2F%2Fexample.com%2Fbook.pdf';
    expect(resolvePdfUrl(url)).toBe('https://example.com/book.pdf');
  });

  it('falls back to content type when the URL does not end with pdf', () => {
    expect(resolvePdfUrl('https://example.com/download?id=123', 'application/pdf')).toBe(
      'https://example.com/download?id=123',
    );
  });

  it('derives a readable title from metadata or the PDF filename', () => {
    expect(derivePdfTitle('https://example.com/papers/test-paper.pdf', 'Metadata Title')).toBe(
      'Metadata Title',
    );
    expect(derivePdfTitle('https://example.com/papers/test-paper.pdf')).toBe('test-paper');
  });

  it('normalizes text items into readable page text', () => {
    const text = textContentToString([
      {
        str: 'Hello',
        dir: 'ltr',
        transform: [],
        width: 10,
        height: 10,
        fontName: 'f1',
        hasEOL: false,
      },
      {
        str: 'world',
        dir: 'ltr',
        transform: [],
        width: 10,
        height: 10,
        fontName: 'f1',
        hasEOL: true,
      },
      {
        type: 'beginMarkedContent',
        id: '1',
      },
      {
        str: 'Again',
        dir: 'ltr',
        transform: [],
        width: 10,
        height: 10,
        fontName: 'f1',
        hasEOL: false,
      },
    ]);

    expect(text).toBe('Hello world\nAgain');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildSectionExtractedContent,
  getContentSections,
  shouldOfferSectionChoice,
} from '../../src/background/content-sections.js';
import type { ExtractedContent } from '../../src/shared/messages.js';

function makeContent(overrides: Partial<ExtractedContent> = {}): ExtractedContent {
  return {
    title: 'Physics Book',
    content: '<h1>One</h1><p>alpha beta gamma</p><h1>Two</h1><p>delta epsilon zeta</p>',
    textContent: 'alpha beta gamma delta epsilon zeta',
    wordCount: 6,
    excerpt: 'alpha beta gamma',
    url: 'https://example.com/book',
    ...overrides,
  };
}

describe('content sections', () => {
  it('uses HTML headings as section titles when available', () => {
    const content = makeContent({
      content: `
        <h1>Chapter 1</h1><p>${'alpha '.repeat(700)}</p>
        <h2>Chapter 2</h2><p>${'beta '.repeat(700)}</p>
      `,
      textContent: `${'alpha '.repeat(700)} ${'beta '.repeat(700)}`.trim(),
      wordCount: 1400,
    });

    const sections = getContentSections(content);
    expect(sections.map(section => section.title)).toEqual(['Chapter 1', 'Chapter 2']);
  });

  it('falls back to arbitrary chunking for long flat text', () => {
    const textContent = 'word '.repeat(3600).trim();
    const sections = getContentSections(makeContent({
      content: '',
      textContent,
      wordCount: 3600,
    }));

    expect(sections.length).toBeGreaterThan(1);
    expect(sections.map(section => section.title)).toEqual(
      sections.map((_, index) => `Part ${index + 1}`),
    );
  });

  it('builds section-specific extracted content and long-content detection', () => {
    const textContent = 'word '.repeat(3600).trim();
    const content = makeContent({
      content: '',
      textContent,
      wordCount: 3600,
    });

    expect(shouldOfferSectionChoice(content)).toBe(true);

    const firstSection = buildSectionExtractedContent(content, 0);
    expect(firstSection?.title).toContain('Physics Book');
    expect(firstSection?.wordCount).toBeGreaterThan(0);
    expect(firstSection?.wordCount).toBeLessThan(content.wordCount);
  });

  it('builds page-range sections for PDFs and preserves page slices', () => {
    const pageTexts = Array.from({ length: 12 }, (_, index) => `Page ${index + 1} ${'word '.repeat(220)}`.trim());
    const content = makeContent({
      content: '',
      textContent: pageTexts.join('\n\n'),
      wordCount: pageTexts.join(' ').split(/\s+/).length,
      pageTexts,
    });

    const sections = getContentSections(content);
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].title).toMatch(/^Pages 1-/);
    expect(sections[0].startPage).toBe(1);
    expect(sections[0].endPage).toBeGreaterThan(1);

    const firstSectionContent = buildSectionExtractedContent(content, 0);
    expect(firstSectionContent?.title).toContain('Pages');
    expect(firstSectionContent?.pageTexts?.length).toBe(sections[0].endPage! - sections[0].startPage! + 1);
  });

  it('skips obvious front matter when building PDF page ranges', () => {
    const pageTexts = [
      'Second edition copyright 2024 all rights reserved',
      'Table of contents chapter 1 chapter 2 chapter 3',
      `Chapter 1 ${'word '.repeat(260)}`.trim(),
      `Body ${'word '.repeat(260)}`.trim(),
    ];

    const sections = getContentSections(makeContent({
      content: '',
      textContent: pageTexts.join('\n\n'),
      wordCount: pageTexts.join(' ').split(/\s+/).length,
      pageTexts,
    }));

    expect(sections[0].startPage).toBe(3);
  });

  it('skips praise and preface pages before the PDF body starts', () => {
    const pageTexts = [
      'Praise for this classic work. "A masterpiece" says a reviewer on the back cover.',
      'Preface acknowledgments dedication about the author and advance praise',
      `Chapter 1 ${'word '.repeat(260)}`.trim(),
      `Body ${'word '.repeat(260)}`.trim(),
    ];

    const sections = getContentSections(makeContent({
      content: '',
      textContent: pageTexts.join('\n\n'),
      wordCount: pageTexts.join(' ').split(/\s+/).length,
      pageTexts,
    }));

    expect(sections[0].startPage).toBe(3);
  });
});

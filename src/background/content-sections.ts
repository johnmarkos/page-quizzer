import type { ContentSection, ExtractedContent } from '../shared/messages.js';

export const SECTIONING_WORD_THRESHOLD = 3000;
const TARGET_SECTION_WORDS = 1200;
const MIN_SECTION_WORDS = 500;
const MAX_SECTION_WORDS = 1800;
const MAX_PDF_SECTION_PAGES = 10;
const PDF_FRONT_MATTER_SCAN_LIMIT = 8;
const PDF_FRONT_MATTER_MARKERS = [
  'copyright',
  'all rights reserved',
  'isbn',
  'library of congress',
  'second edition',
  'third edition',
  'fourth edition',
  'printing',
  'published by',
  'table of contents',
  'contents',
];

type SectionChunk = {
  title: string;
  textContent: string;
  startPage?: number;
  endPage?: number;
};

export function shouldOfferSectionChoice(content: ExtractedContent): boolean {
  return content.wordCount > SECTIONING_WORD_THRESHOLD && getContentSections(content).length > 1;
}

export function getContentSections(content: ExtractedContent): ContentSection[] {
  return buildSectionChunks(content).map((section, index) => ({
    index,
    title: section.title,
    wordCount: countWords(section.textContent),
    preview: section.textContent.slice(0, 140),
    startPage: section.startPage,
    endPage: section.endPage,
  }));
}

export function buildSectionExtractedContent(
  content: ExtractedContent,
  sectionIndex: number,
): ExtractedContent | null {
  const section = buildSectionChunks(content)[sectionIndex];
  if (!section) {
    return null;
  }

  const textContent = section.textContent.trim();
  const pageTexts = section.startPage && section.endPage && content.pageTexts
    ? content.pageTexts.slice(section.startPage - 1, section.endPage)
    : undefined;

  return {
    ...content,
    title: `${content.title} — ${section.title}`,
    content: textContent,
    textContent,
    wordCount: countWords(textContent),
    excerpt: textContent.slice(0, 200),
    pageTexts,
  };
}

function buildSectionChunks(content: ExtractedContent): SectionChunk[] {
  if (content.pageTexts && content.pageTexts.length > 1) {
    return buildPdfPageSections(content.pageTexts);
  }

  const headingSections = buildHeadingSections(content.content);
  if (headingSections.length > 1) {
    return rebalanceSections(headingSections, content.title);
  }

  return renameSequentialParts(
    rebalanceSections(buildFallbackSections(content.textContent, content.title), content.title),
  );
}

function buildHeadingSections(html: string): SectionChunk[] {
  const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches = [...html.matchAll(headingRegex)];
  if (matches.length < 2) {
    return [];
  }

  const sections: SectionChunk[] = [];
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const currentIndex = match.index ?? 0;
    const nextIndex = matches[index + 1]?.index ?? html.length;
    const headingHtml = match[2] ?? '';
    const title = stripHtml(headingHtml) || `Section ${index + 1}`;
    const sectionHtml = html.slice(currentIndex, nextIndex);
    const textContent = normalizeText(stripHtml(sectionHtml));

    if (!textContent) {
      continue;
    }

    sections.push({ title, textContent });
  }

  return sections;
}

function buildFallbackSections(text: string, title: string): SectionChunk[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(normalizeText)
    .filter(Boolean);

  if (paragraphs.length >= 2) {
    return paragraphs.map((paragraph, index) => ({
      title: `Part ${index + 1}`,
      textContent: paragraph,
    }));
  }

  return splitOversizedChunk({
    title: title || 'Part 1',
    textContent: normalizeText(text),
  });
}

function buildPdfPageSections(pageTexts: string[]): SectionChunk[] {
  const startPage = findPdfBodyStartPage(pageTexts);
  const bodyPages = pageTexts.slice(startPage - 1);
  const sections: SectionChunk[] = [];
  let bufferStartPage: number | null = null;
  let bufferEndPage: number | null = null;
  let bufferWords = 0;
  let bufferTexts: string[] = [];

  const flushBuffer = () => {
    if (bufferStartPage === null || bufferEndPage === null) {
      return;
    }

    const textContent = normalizeText(bufferTexts.filter(Boolean).join('\n\n'));
    if (!textContent) {
      bufferStartPage = null;
      bufferEndPage = null;
      bufferWords = 0;
      bufferTexts = [];
      return;
    }

    sections.push({
      title: bufferStartPage === bufferEndPage
        ? `Page ${bufferStartPage}`
        : `Pages ${bufferStartPage}-${bufferEndPage}`,
      textContent,
      startPage: bufferStartPage,
      endPage: bufferEndPage,
    });
    bufferStartPage = null;
    bufferEndPage = null;
    bufferWords = 0;
    bufferTexts = [];
  };

  for (let pageIndex = 0; pageIndex < bodyPages.length; pageIndex++) {
    const pageNumber = startPage + pageIndex;
    const pageText = normalizeText(bodyPages[pageIndex] || '');
    const pageWords = countWords(pageText);
    const pageCount = bufferStartPage === null || bufferEndPage === null
      ? 0
      : bufferEndPage - bufferStartPage + 1;
    const wouldExceedWordTarget =
      bufferWords >= MIN_SECTION_WORDS && bufferWords + pageWords > TARGET_SECTION_WORDS;
    const wouldExceedPageTarget = pageCount >= MAX_PDF_SECTION_PAGES;

    if (bufferTexts.length > 0 && (wouldExceedWordTarget || wouldExceedPageTarget)) {
      flushBuffer();
    }

    if (bufferStartPage === null) {
      bufferStartPage = pageNumber;
    }

    bufferEndPage = pageNumber;
    bufferWords += pageWords;
    bufferTexts.push(pageText);
  }

  flushBuffer();

  if (sections.length > 1) {
    const lastSection = sections[sections.length - 1];
    if (countWords(lastSection.textContent) < MIN_SECTION_WORDS) {
      const previousSection = sections[sections.length - 2];
      previousSection.textContent = normalizeText(`${previousSection.textContent}\n\n${lastSection.textContent}`);
      previousSection.endPage = lastSection.endPage;
      previousSection.title = previousSection.startPage === previousSection.endPage
        ? `Page ${previousSection.startPage}`
        : `Pages ${previousSection.startPage}-${previousSection.endPage}`;
      sections.pop();
    }
  }

  return sections;
}

function findPdfBodyStartPage(pageTexts: string[]): number {
  for (let pageIndex = 0; pageIndex < Math.min(pageTexts.length, PDF_FRONT_MATTER_SCAN_LIMIT); pageIndex++) {
    const pageText = normalizeText(pageTexts[pageIndex] || '');
    const lower = pageText.toLowerCase();
    const wordCount = countWords(pageText);

    if (wordCount >= 250) {
      return pageIndex + 1;
    }

    if (wordCount >= 120 && /chapter|prologue|introduction/i.test(pageText)) {
      return pageIndex + 1;
    }

    const markerCount = PDF_FRONT_MATTER_MARKERS.filter(marker => lower.includes(marker)).length;
    if (markerCount >= 2 || (wordCount > 0 && wordCount < 120)) {
      continue;
    }

    if (wordCount > 120) {
      return pageIndex + 1;
    }
  }

  return 1;
}

function rebalanceSections(sections: SectionChunk[], baseTitle: string): SectionChunk[] {
  const output: SectionChunk[] = [];
  let bufferTitle = '';
  let bufferText = '';

  for (const section of sections) {
    const normalizedText = normalizeText(section.textContent);
    if (!normalizedText) {
      continue;
    }

    const sectionWordCount = countWords(normalizedText);
    if (sectionWordCount > MAX_SECTION_WORDS) {
      flushBuffer(output);
      output.push(...splitOversizedChunk(section));
      continue;
    }

    if (!bufferText) {
      bufferTitle = section.title;
      bufferText = normalizedText;
      continue;
    }

    const bufferedWordCount = countWords(bufferText);
    if (bufferedWordCount < MIN_SECTION_WORDS || bufferedWordCount + sectionWordCount <= TARGET_SECTION_WORDS) {
      bufferText = `${bufferText}\n\n${normalizedText}`.trim();
      continue;
    }

    output.push({ title: bufferTitle || baseTitle || `Part ${output.length + 1}`, textContent: bufferText });
    bufferTitle = section.title;
    bufferText = normalizedText;
  }

  flushBuffer(output);
  return output.length > 0 ? output : splitOversizedChunk({ title: baseTitle || 'Part 1', textContent: '' });

  function flushBuffer(target: SectionChunk[]) {
    if (!bufferText) {
      return;
    }

    target.push({
      title: bufferTitle || baseTitle || `Part ${target.length + 1}`,
      textContent: bufferText,
    });
    bufferTitle = '';
    bufferText = '';
  }
}

function splitOversizedChunk(section: SectionChunk): SectionChunk[] {
  const words = section.textContent.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: SectionChunk[] = [];
  for (let start = 0; start < words.length; start += TARGET_SECTION_WORDS) {
    const chunkWords = words.slice(start, start + TARGET_SECTION_WORDS);
    const suffix = words.length > TARGET_SECTION_WORDS ? ` (Part ${chunks.length + 1})` : '';
    chunks.push({
      title: `${section.title}${suffix}`,
      textContent: chunkWords.join(' '),
    });
  }

  return chunks;
}

function renameSequentialParts(sections: SectionChunk[]): SectionChunk[] {
  return sections.map((section, index) => ({
    ...section,
    title: `Part ${index + 1}`,
  }));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

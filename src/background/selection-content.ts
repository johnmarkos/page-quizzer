import type { ExtractedContent } from '../shared/messages.js';
import { countWords } from '../shared/text-utils.js';

export function buildSelectionContent(
  selectionText: string,
  url: string,
  title?: string | null,
): ExtractedContent {
  const normalizedText = normalizeSelectionText(selectionText);
  const selectionTitle = title?.trim() || 'Selected Text';

  return {
    title: `${selectionTitle} (Selection)`,
    content: normalizedText,
    textContent: normalizedText,
    wordCount: countWords(normalizedText),
    excerpt: normalizedText.slice(0, 200),
    url,
  };
}

export function normalizeSelectionText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveSelectedText(
  contentScriptText: string,
  fallbackSelectionText?: string | null,
): string {
  return normalizeSelectionText(contentScriptText) || normalizeSelectionText(fallbackSelectionText || '');
}

import type { ExtractedContent } from '../shared/messages.js';
import { countWords } from '../shared/text-utils.js';

const DEFAULT_MANUAL_TITLE = 'Pasted Text';
const DEFAULT_MANUAL_URL = 'pagequizzer://pasted-text';

export function buildManualExtractedContent(text: string, title = DEFAULT_MANUAL_TITLE): ExtractedContent {
  const normalizedText = text.trim();

  return {
    title: title.trim() || DEFAULT_MANUAL_TITLE,
    content: normalizedText,
    textContent: normalizedText,
    wordCount: countWords(normalizedText),
    excerpt: normalizedText.slice(0, 200),
    url: DEFAULT_MANUAL_URL,
  };
}

export function buildManualGeneratePayload(
  manualInputMode: boolean,
  text: string,
  title = DEFAULT_MANUAL_TITLE,
): { content: ExtractedContent } | undefined {
  if (!manualInputMode) {
    return undefined;
  }

  if (!text.trim()) {
    throw new Error('Paste some text before generating a manual quiz.');
  }

  return {
    content: buildManualExtractedContent(text, title),
  };
}

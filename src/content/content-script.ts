import { extractContent } from './ReadabilityExtractor.js';
import { detectOpenQuizzer } from './OpenQuizzerDetector.js';
import type { Message } from '../shared/messages.js';

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.type === 'EXTRACT_CONTENT') {
      try {
        const content = extractContent();
        sendResponse({ type: 'EXTRACT_CONTENT_RESULT', payload: content });
      } catch (err) {
        sendResponse({
          type: 'EXTRACT_CONTENT_RESULT',
          payload: { error: err instanceof Error ? err.message : 'Extraction failed' },
        });
      }
      return true; // keep channel open for async response
    }

    if (message.type === 'DETECT_OPENQUIZZER' as any) {
      const result = detectOpenQuizzer();
      sendResponse({ type: 'OPENQUIZZER_RESULT', payload: result });
      return true;
    }
  }
);

import { extractContent as extractReadableContent } from './ReadabilityExtractor.js';
import { extractPdfContent } from './PdfExtractor.js';
import type { Message } from '../shared/messages.js';

const CONTENT_SCRIPT_READY_FLAG = '__pageQuizzerContentScriptReady';
const contentScriptGlobal = globalThis as typeof globalThis & {
  [CONTENT_SCRIPT_READY_FLAG]?: boolean;
};

if (!contentScriptGlobal[CONTENT_SCRIPT_READY_FLAG]) {
  contentScriptGlobal[CONTENT_SCRIPT_READY_FLAG] = true;

  chrome.runtime.onMessage.addListener(
    (message: Message, _sender, sendResponse) => {
      if (message.type === 'EXTRACT_CONTENT') {
        extractCurrentPageContent()
          .then((content) => {
            sendResponse({ type: 'EXTRACT_CONTENT_RESULT', payload: content });
          })
          .catch((err) => {
            sendResponse({
              type: 'EXTRACT_CONTENT_RESULT',
              payload: { error: err instanceof Error ? err.message : 'Extraction failed' },
            });
          });
        return true; // keep channel open for async response
      }

      if (message.type === 'GET_SELECTION_TEXT') {
        sendResponse({
          type: 'GET_SELECTION_TEXT_RESULT',
          payload: { text: getSelectedText() },
        });
      }
    }
  );
}

async function extractCurrentPageContent() {
  const pdfContent = await extractPdfContent();
  if (pdfContent) {
    return pdfContent;
  }

  return extractReadableContent();
}

function getSelectedText(): string {
  return globalThis.getSelection?.()?.toString().trim() || '';
}

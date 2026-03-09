import type { ExtractedContent } from '../shared/messages.js';
import type {
  DocumentInitParameters,
  PDFDocumentProxy,
  TextItem,
  TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api';
import {
  derivePdfTitle,
  normalizePdfText,
  resolvePdfUrl,
  textContentToString,
  type PdfMetadata,
} from '../shared/pdf.js';
import { countWords } from '../shared/text-utils.js';

const PDF_JS_MODULE_PATH = 'dist/pdfjs.js';
const PDF_WORKER_PATH = 'dist/pdf.worker.js';

export async function extractPdfContent(
  locationHref = window.location.href,
  contentType = document.contentType,
  documentTitle = document.title,
): Promise<ExtractedContent | null> {
  const pdfUrl = resolvePdfUrl(locationHref, contentType);
  if (!pdfUrl) {
    return null;
  }

  const response = await fetch(pdfUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status})`);
  }

  const pdfBytes = new Uint8Array(await response.arrayBuffer());
  const pdfjs = await import(chrome.runtime.getURL(PDF_JS_MODULE_PATH));
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(PDF_WORKER_PATH);

  const loadingTask = pdfjs.getDocument(buildPdfDocumentParams(pdfBytes));
  let pdfDocument: PDFDocumentProxy | null = null;

  try {
    pdfDocument = await loadingTask.promise;
    const metadata = await getPdfMetadata(pdfDocument);
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContentToString(textContent.items);
      pageTexts.push(pageText);
      page.cleanup();
    }

    const textContent = normalizePdfText(pageTexts.filter(Boolean).join('\n\n'));
    if (!textContent) {
      throw new Error('PDF contains no extractable text');
    }

    return {
      title: derivePdfTitle(pdfUrl, metadata.title, documentTitle),
      content: textContent,
      textContent,
      wordCount: countWords(textContent),
      excerpt: textContent.slice(0, 200),
      url: pdfUrl,
      pageTexts,
    };
  } finally {
    if (pdfDocument) {
      await pdfDocument.destroy();
    } else {
      await loadingTask.destroy();
    }
  }
}

function buildPdfDocumentParams(data: Uint8Array): DocumentInitParameters {
  return {
    data,
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: false,
    useSystemFonts: false,
    useWorkerFetch: false,
  };
}

async function getPdfMetadata(pdfDocument: PDFDocumentProxy): Promise<PdfMetadata> {
  try {
    const metadata = await pdfDocument.getMetadata();
    const info = metadata.info as Record<string, unknown>;
    return {
      title: typeof info.Title === 'string' ? info.Title : undefined,
    };
  } catch {
    return {};
  }
}

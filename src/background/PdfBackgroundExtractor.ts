import type { ExtractedContent } from '../shared/messages.js';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';
import type {
  DocumentInitParameters,
  PDFDocumentProxy,
} from 'pdfjs-dist/types/src/display/api';
import {
  derivePdfTitle,
  normalizePdfText,
  resolvePdfUrl,
  textContentToString,
  type PdfMetadata,
} from '../shared/pdf.js';
import { countWords } from '../shared/text-utils.js';
import {
  buildLocalPdfAccessError,
  buildLocalPdfReadError,
  hasAllowedFileSchemeAccess,
  isLocalFilePdfUrl,
} from './pdf-source.js';

const globalPdfjsWorker = globalThis as typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
};

globalPdfjsWorker.pdfjsWorker ||= { WorkerMessageHandler };

export async function extractPdfContentFromTabUrl(
  tabUrl: string,
  tabTitle?: string,
): Promise<ExtractedContent | null> {
  const pdfUrl = resolvePdfUrl(tabUrl);
  if (!pdfUrl) {
    return null;
  }

  const isLocalPdf = isLocalFilePdfUrl(pdfUrl);
  if (isLocalPdf && !(await hasAllowedFileSchemeAccess())) {
    throw buildLocalPdfAccessError();
  }

  let response: Response;

  try {
    response = await fetch(pdfUrl, { credentials: 'include' });
  } catch (error) {
    if (isLocalPdf) {
      throw buildLocalPdfReadError();
    }
    throw error;
  }

  if (!response.ok) {
    if (isLocalPdf) {
      throw buildLocalPdfReadError();
    }
    throw new Error(`Failed to fetch PDF (${response.status})`);
  }

  const pdfBytes = new Uint8Array(await response.arrayBuffer());
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
      title: derivePdfTitle(pdfUrl, metadata.title, tabTitle),
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
    disableWorker: true,
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

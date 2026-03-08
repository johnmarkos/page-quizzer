import type { ExtractedContent } from '../shared/messages.js';
import type {
  DocumentInitParameters,
  PDFDocumentProxy,
  TextItem,
  TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api';

const PDF_CONTENT_TYPE = 'application/pdf';
const PDF_JS_MODULE_PATH = 'dist/pdfjs.js';
const PDF_WORKER_PATH = 'dist/pdf.worker.js';

type PdfMetadata = {
  title?: string;
};

export function looksLikePdfUrl(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url);
}

export function resolvePdfUrl(locationHref: string, contentType?: string): string | null {
  let url: URL;
  try {
    url = new URL(locationHref);
  } catch {
    return null;
  }

  const fileParam = url.searchParams.get('file');
  if (fileParam) {
    try {
      const resolvedFileUrl = new URL(fileParam, locationHref).href;
      if (looksLikePdfUrl(resolvedFileUrl)) {
        return resolvedFileUrl;
      }
    } catch {
      // Invalid viewer-style file parameter — fall through to direct URL checks.
    }
  }

  if (looksLikePdfUrl(url.href) || contentType?.includes(PDF_CONTENT_TYPE)) {
    return url.href;
  }

  return null;
}

export function derivePdfTitle(pdfUrl: string, metadataTitle?: string, documentTitle?: string): string {
  const trimmedMetadataTitle = metadataTitle?.trim();
  if (trimmedMetadataTitle) {
    return trimmedMetadataTitle;
  }

  const trimmedDocumentTitle = documentTitle?.trim();
  if (trimmedDocumentTitle && !trimmedDocumentTitle.toLowerCase().includes('pdf viewer')) {
    return trimmedDocumentTitle;
  }

  try {
    const url = new URL(pdfUrl);
    const filename = decodeURIComponent(url.pathname.split('/').pop() || '').trim();
    if (filename) {
      return filename.replace(/\.pdf$/i, '');
    }
  } catch {
    // Ignore URL parsing failure and fall back to generic title below.
  }

  return 'PDF Document';
}

export function textContentToString(items: Array<TextItem | TextMarkedContent>): string {
  let text = '';

  for (const item of items) {
    if (!('str' in item)) {
      continue;
    }

    const value = item.str.trim();
    if (!value) {
      if (item.hasEOL && !text.endsWith('\n')) {
        text += '\n';
      }
      continue;
    }

    if (text && !text.endsWith('\n')) {
      text += ' ';
    }

    text += value;

    if (item.hasEOL && !text.endsWith('\n')) {
      text += '\n';
    }
  }

  return normalizePdfText(text);
}

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
      if (pageText) {
        pageTexts.push(pageText);
      }
      page.cleanup();
    }

    const textContent = normalizePdfText(pageTexts.join('\n\n'));
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

function normalizePdfText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

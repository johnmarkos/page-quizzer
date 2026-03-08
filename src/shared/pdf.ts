import type {
  TextItem,
  TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api';

const PDF_CONTENT_TYPE = 'application/pdf';

export type PdfMetadata = {
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

  for (const paramName of ['src', 'file']) {
    const paramValue = url.searchParams.get(paramName);
    if (!paramValue) {
      continue;
    }

    try {
      const resolvedFileUrl = new URL(paramValue, locationHref).href;
      if (looksLikePdfUrl(resolvedFileUrl)) {
        return resolvedFileUrl;
      }
    } catch {
      // Invalid viewer-style parameter — keep checking other options.
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

export function normalizePdfText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

import { resolvePdfUrl } from './pdf.js';

export function buildOriginPermissionPattern(url?: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(resolvePdfUrl(url) || url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}

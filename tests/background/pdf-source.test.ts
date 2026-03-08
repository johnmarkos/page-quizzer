import { describe, expect, it } from 'vitest';
import {
  buildLocalPdfAccessError,
  buildLocalPdfReadError,
  hasAllowedFileSchemeAccess,
  isLocalFilePdfUrl,
} from '../../src/background/pdf-source.js';

describe('pdf source helpers', () => {
  it('detects local file pdf urls', () => {
    expect(isLocalFilePdfUrl('file:///home/nhoj/Downloads/test.pdf')).toBe(true);
    expect(isLocalFilePdfUrl('https://example.com/test.pdf')).toBe(false);
    expect(isLocalFilePdfUrl('not a url')).toBe(false);
  });

  it('builds an actionable local pdf access error', () => {
    expect(buildLocalPdfAccessError().message).toContain('Allow access to file URLs');
  });

  it('reports when local pdfs remain unreadable after file access is enabled', () => {
    expect(buildLocalPdfReadError().message).toContain('could not read this local PDF');
  });

  it('resolves allowed file-scheme access through the Chrome callback shape', async () => {
    const access = await hasAllowedFileSchemeAccess((callback) => callback(true));
    expect(access).toBe(true);
  });

  it('treats callback failures as blocked file-scheme access', async () => {
    const access = await hasAllowedFileSchemeAccess(() => {
      throw new Error('boom');
    });

    expect(access).toBe(false);
  });
});

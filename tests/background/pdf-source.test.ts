import { describe, expect, it } from 'vitest';
import { buildLocalPdfAccessError, isLocalFilePdfUrl } from '../../src/background/pdf-source.js';

describe('pdf source helpers', () => {
  it('detects local file pdf urls', () => {
    expect(isLocalFilePdfUrl('file:///home/nhoj/Downloads/test.pdf')).toBe(true);
    expect(isLocalFilePdfUrl('https://example.com/test.pdf')).toBe(false);
    expect(isLocalFilePdfUrl('not a url')).toBe(false);
  });

  it('builds an actionable local pdf access error', () => {
    expect(buildLocalPdfAccessError().message).toContain('Allow access to file URLs');
  });
});

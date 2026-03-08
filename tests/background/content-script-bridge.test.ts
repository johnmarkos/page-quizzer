import { describe, expect, it } from 'vitest';
import {
  buildContentScriptAccessError,
  hasUnsupportedInjectionProtocol,
  isMissingContentScriptError,
} from '../../src/background/content-script-bridge.js';

describe('content script bridge helpers', () => {
  it('detects the missing receiver error from chrome.tabs.sendMessage', () => {
    expect(isMissingContentScriptError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(true);
    expect(isMissingContentScriptError(new Error('Some other failure'))).toBe(false);
  });

  it('flags only clearly unsupported page protocols up front', () => {
    expect(hasUnsupportedInjectionProtocol('https://www.feynmanlectures.caltech.edu/I_01.html')).toBe(false);
    expect(hasUnsupportedInjectionProtocol('file:///tmp/test.html')).toBe(false);
    expect(hasUnsupportedInjectionProtocol('chrome://extensions')).toBe(true);
    expect(hasUnsupportedInjectionProtocol('chrome-extension://abc/page.html')).toBe(true);
    expect(hasUnsupportedInjectionProtocol(undefined)).toBe(false);
  });

  it('maps injection failures to a clearer access error', () => {
    expect(
      buildContentScriptAccessError(new Error('Cannot access contents of url "https://example.com/"'))
        .message,
    ).toBe('PageQuizzer cannot access this page. Chrome blocks extension scripts here.');

    expect(
      buildContentScriptAccessError(new Error('Unexpected failure')).message,
    ).toBe('Failed to attach PageQuizzer to this tab: Unexpected failure');
  });
});

import { describe, expect, it } from 'vitest';
import { buildOriginPermissionPattern } from '../../src/shared/site-access.js';
import {
  buildContentScriptAccessError,
  hasUnsupportedInjectionProtocol,
  isHostPermissionInjectionError,
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

  it('detects host-permission injection failures', () => {
    expect(
      isHostPermissionInjectionError(
        new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.'),
      ),
    ).toBe(true);
    expect(isHostPermissionInjectionError(new Error('Unexpected failure'))).toBe(false);
  });

  it('builds an origin permission pattern only for web origins', () => {
    expect(buildOriginPermissionPattern('https://www.feynmanlectures.caltech.edu/I_01.html')).toBe(
      'https://www.feynmanlectures.caltech.edu/*',
    );
    expect(buildOriginPermissionPattern('http://example.com/path')).toBe('http://example.com/*');
    expect(buildOriginPermissionPattern('file:///tmp/test.html')).toBeNull();
    expect(buildOriginPermissionPattern(undefined)).toBeNull();
  });
});

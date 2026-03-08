import { describe, expect, it } from 'vitest';
import {
  canInjectContentScript,
  isMissingContentScriptError,
} from '../../src/background/content-script-bridge.js';

describe('content script bridge helpers', () => {
  it('detects the missing receiver error from chrome.tabs.sendMessage', () => {
    expect(isMissingContentScriptError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(true);
    expect(isMissingContentScriptError(new Error('Some other failure'))).toBe(false);
  });

  it('allows programmatic injection only for supported page protocols', () => {
    expect(canInjectContentScript('https://www.feynmanlectures.caltech.edu/I_01.html')).toBe(true);
    expect(canInjectContentScript('file:///tmp/test.html')).toBe(true);
    expect(canInjectContentScript('chrome://extensions')).toBe(false);
    expect(canInjectContentScript('chrome-extension://abc/page.html')).toBe(false);
    expect(canInjectContentScript(undefined)).toBe(false);
  });
});

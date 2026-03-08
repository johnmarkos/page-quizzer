import { describe, expect, it } from 'vitest';
import { parseProviderJson } from '../../src/providers/parseProviderJson.js';

describe('parseProviderJson', () => {
  it('parses valid JSON and returns the result', () => {
    const result = parseProviderJson<{ ok: boolean }>('{"ok": true}', 'test');
    expect(result).toEqual({ ok: true });
  });

  it('throws a descriptive error naming the provider on invalid JSON', () => {
    expect(() => parseProviderJson('not json', 'OpenAI quiz')).toThrow(
      'Failed to parse OpenAI quiz response as JSON',
    );
  });

  it('throws a descriptive error for empty string input', () => {
    expect(() => parseProviderJson('', 'Gemini')).toThrow(
      'Failed to parse Gemini response as JSON',
    );
  });

  it('parses arrays', () => {
    const result = parseProviderJson<string[]>('["a", "b"]', 'test');
    expect(result).toEqual(['a', 'b']);
  });
});

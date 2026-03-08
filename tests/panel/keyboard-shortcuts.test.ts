import { describe, expect, it } from 'vitest';
import {
  buildShortcutHelpText,
  getOptionShortcutIndex,
  shouldIgnoreShortcutTarget,
} from '../../src/panel/keyboard-shortcuts.js';

describe('keyboard shortcuts helpers', () => {
  it('builds dynamic help text for four-option questions', () => {
    expect(buildShortcutHelpText(4)).toBe('1-4: select answer, Enter: next question, S: skip');
  });

  it('builds dynamic help text for true-false questions', () => {
    expect(buildShortcutHelpText(2)).toBe('1-2: select answer, Enter: next question, S: skip');
  });

  it('maps number keys to available option indexes only', () => {
    expect(getOptionShortcutIndex('1', 4)).toBe(0);
    expect(getOptionShortcutIndex('4', 4)).toBe(3);
    expect(getOptionShortcutIndex('3', 2)).toBeNull();
    expect(getOptionShortcutIndex('s', 4)).toBeNull();
  });

  it('ignores shortcuts while focus is inside interactive controls', () => {
    expect(shouldIgnoreShortcutTarget('INPUT', false)).toBe(true);
    expect(shouldIgnoreShortcutTarget('BUTTON', false)).toBe(true);
    expect(shouldIgnoreShortcutTarget('DIV', true)).toBe(true);
    expect(shouldIgnoreShortcutTarget('DIV', false)).toBe(false);
  });
});

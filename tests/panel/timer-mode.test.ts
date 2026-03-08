import { describe, expect, it } from 'vitest';
import {
  buildTimerProgressPercent,
  formatTimerCountdown,
  normalizeTimerSeconds,
} from '../../src/panel/timer-mode.js';

describe('timer mode helpers', () => {
  it('normalizes timer settings to supported values', () => {
    expect(normalizeTimerSeconds(0)).toBe(0);
    expect(normalizeTimerSeconds('15')).toBe(15);
    expect(normalizeTimerSeconds(30)).toBe(30);
    expect(normalizeTimerSeconds(60)).toBe(60);
    expect(normalizeTimerSeconds(45)).toBe(0);
    expect(normalizeTimerSeconds('abc')).toBe(0);
  });

  it('formats countdown display with minute and second padding', () => {
    expect(formatTimerCountdown(15000)).toBe('0:15');
    expect(formatTimerCountdown(61000)).toBe('1:01');
    expect(formatTimerCountdown(0)).toBe('0:00');
  });

  it('builds a clamped timer progress percentage', () => {
    expect(buildTimerProgressPercent(15000, 15)).toBe(100);
    expect(buildTimerProgressPercent(7500, 15)).toBe(50);
    expect(buildTimerProgressPercent(-100, 15)).toBe(0);
    expect(buildTimerProgressPercent(5000, 0)).toBe(0);
  });
});

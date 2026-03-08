import { describe, expect, it } from 'vitest';
import { buildQuizBadgeText, shouldClearQuizBadge } from '../../src/background/quiz-badge.js';

describe('quiz badge helpers', () => {
  it('formats the current question progress for the badge', () => {
    expect(buildQuizBadgeText(0, 10)).toBe('1/10');
    expect(buildQuizBadgeText(2, 10)).toBe('3/10');
  });

  it('clears the badge only for idle and complete states', () => {
    expect(shouldClearQuizBadge('idle')).toBe(true);
    expect(shouldClearQuizBadge('complete')).toBe(true);
    expect(shouldClearQuizBadge('practicing')).toBe(false);
    expect(shouldClearQuizBadge('answered')).toBe(false);
  });
});

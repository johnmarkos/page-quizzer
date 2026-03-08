import type { EngineState } from '../engine/types.js';

export function buildQuizBadgeText(index: number, total: number): string {
  return `${index + 1}/${total}`;
}

export function shouldClearQuizBadge(state: EngineState): boolean {
  return state === 'idle' || state === 'complete';
}

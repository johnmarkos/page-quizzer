import { clamp } from '../engine/utils.js';

export const TIMER_SECONDS_OPTIONS = [0, 15, 30, 60] as const;

export type TimerSeconds = (typeof TIMER_SECONDS_OPTIONS)[number];

export function normalizeTimerSeconds(value: unknown): TimerSeconds {
  const parsed = Number(value);
  return TIMER_SECONDS_OPTIONS.includes(parsed as TimerSeconds) ? parsed as TimerSeconds : 0;
}

export function formatTimerCountdown(remainingMs: number): string {
  const clampedMs = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function buildTimerProgressPercent(remainingMs: number, totalSeconds: number): number {
  if (totalSeconds <= 0) {
    return 0;
  }

  return clamp((Math.max(0, remainingMs) / (totalSeconds * 1000)) * 100, 0, 100);
}

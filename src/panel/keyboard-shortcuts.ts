const MAX_OPTION_SHORTCUT = 4;

export function buildShortcutHelpText(optionCount: number): string {
  const boundedOptionCount = Math.max(1, Math.min(optionCount, MAX_OPTION_SHORTCUT));
  const optionRange = boundedOptionCount === 1 ? '1' : `1-${boundedOptionCount}`;

  return `${optionRange}: select answer, Enter: next question, S: skip`;
}

export function getOptionShortcutIndex(key: string, optionCount: number): number | null {
  if (!/^[1-4]$/.test(key)) {
    return null;
  }

  const index = Number(key) - 1;
  return index < optionCount ? index : null;
}

export function shouldIgnoreShortcutTarget(tagName: string, isContentEditable: boolean): boolean {
  if (isContentEditable) {
    return true;
  }

  return ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tagName);
}

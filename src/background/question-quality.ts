import type { Problem } from '../engine/types.js';

const BANNED_OPTION_PATTERNS = [
  /^all of the above$/i,
  /^none of the above$/i,
  /^all of these$/i,
  /^none of these$/i,
  /^both [a-d] and [a-d]$/i,
];

export function filterLowQualityQuestions(problems: Problem[]): Problem[] {
  return problems.filter((problem) => getQuestionQualityIssues(problem).length === 0);
}

export function getQuestionQualityIssues(problem: Problem): string[] {
  const issues: string[] = [];
  const optionTexts = problem.options.map((option) => option.text.trim());
  const normalizedOptions = optionTexts.map(normalizeOptionText);

  if (normalizedOptions.some((option) => option.length === 0)) {
    issues.push('empty-option');
  }

  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    issues.push('duplicate-options');
  }

  if (normalizedOptions.some((option) => BANNED_OPTION_PATTERNS.some((pattern) => pattern.test(option)))) {
    issues.push('banned-option-pattern');
  }

  if (problem.options.length !== 4) {
    return issues;
  }

  const correctIndex = problem.options.findIndex((option) => option.correct);
  if (correctIndex === -1) {
    issues.push('missing-correct-option');
    return issues;
  }

  const wordCounts = optionTexts.map(countWords);
  const correctWordCount = wordCounts[correctIndex];
  const distractorWordCounts = wordCounts.filter((_, index) => index !== correctIndex);
  const medianDistractorWordCount = median(distractorWordCounts);

  if (
    medianDistractorWordCount >= 2
    && (
      correctWordCount >= Math.ceil(medianDistractorWordCount * 2.5)
      || correctWordCount <= Math.floor(medianDistractorWordCount * 0.4)
    )
  ) {
    issues.push('correct-option-length-outlier');
  }

  const sentenceLikeOptions = optionTexts.map(isSentenceLikeOption);
  if (sentenceLikeOptions.filter(Boolean).length === 1) {
    issues.push('single-sentence-like-option');
  }

  return issues;
}

export function buildGenerationBuffer(remainingQuestions: number): number {
  if (remainingQuestions <= 1) {
    return 0;
  }

  return Math.min(3, Math.max(1, Math.ceil(remainingQuestions * 0.4)));
}

function normalizeOptionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isSentenceLikeOption(text: string): boolean {
  const trimmed = text.trim();
  return countWords(trimmed) >= 7 && /[.!?]$/.test(trimmed);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

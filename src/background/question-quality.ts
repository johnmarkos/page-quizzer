import type { Problem } from '../engine/types.js';
import { countWords } from '../shared/text-utils.js';

// --- Quality Patterns ---
const BANNED_OPTION_PATTERNS = [
  /^all of the above$/i,
  /^none of the above$/i,
  /^all of these$/i,
  /^none of these$/i,
  /^both [a-d] and [a-d]$/i,
];

const FRONT_MATTER_QUESTION_PATTERNS = [
  /\bcopyright\b/i,
  /\bedition\b/i,
  /\bpublisher\b/i,
  /\bisbn\b/i,
  /\blibrary of congress\b/i,
  /\btable of contents\b/i,
  /\bprinted\b/i,
  /\bprinting\b/i,
  /\ball rights reserved\b/i,
  /\bforeword\b/i,
  /\bpreface\b/i,
  /\backnowledg(e)?ments?\b/i,
  /\bdedication\b/i,
  /\bblurb\b/i,
  /\bpraise\b/i,
  /\bdust jacket\b/i,
  /\bback cover\b/i,
  /\bcover copy\b/i,
  /\babout the author\b/i,
];

const VAGUE_OPTION_PATTERNS = [
  /\bsomething\b/i,
  /\bsome kind of\b/i,
  /\ba general (idea|concept|principle|property|factor|thing)\b/i,
  /\ban important (thing|factor|idea)\b/i,
  /\bthe main point\b/i,
  /\boverall meaning\b/i,
];

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'for', 'from', 'how', 'if', 'in',
  'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'there', 'these', 'they',
  'this', 'those', 'to', 'was', 'were', 'what', 'when', 'which', 'who', 'why', 'with',
]);

// --- Quality Filter ---
export function filterLowQualityQuestions(problems: Problem[]): Problem[] {
  return problems.filter((problem) => getQuestionQualityIssues(problem).length === 0);
}

// --- Issue Detection ---
export function getQuestionQualityIssues(problem: Problem): string[] {
  const issues: string[] = [];
  const optionTexts = problem.options.map((option) => option.text.trim());
  const normalizedOptions = optionTexts.map(normalizeOptionText);
  const questionText = problem.question.trim();

  if (isFrontMatterQuestion(questionText)) {
    issues.push('front-matter-trivia');
  }

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

  const normalizedOptionLengths = normalizedOptions.map((option) => option.length);
  const correctNormalizedLength = normalizedOptionLengths[correctIndex];
  const longestOptionLength = Math.max(...normalizedOptionLengths);
  const secondLongestOptionLength = [...normalizedOptionLengths]
    .sort((left, right) => right - left)[1] ?? 0;
  const correctIsUniqueLongest =
    correctNormalizedLength === longestOptionLength
    && normalizedOptionLengths.filter((length) => length === longestOptionLength).length === 1;

  const correctSpecificity = countContentTokens(optionTexts[correctIndex]);
  const distractorSpecificity = optionTexts
    .filter((_, index) => index !== correctIndex)
    .map(countContentTokens);
  const maxDistractorSpecificity = Math.max(...distractorSpecificity);
  const lowSpecificityDistractors = distractorSpecificity.filter((count) => count <= 1).length;
  if (correctSpecificity >= 3 && lowSpecificityDistractors >= 2 && median(distractorSpecificity) <= 1) {
    issues.push('correct-option-specificity-outlier');
  }

  if (
    correctIsUniqueLongest
    && secondLongestOptionLength >= 18
    && correctNormalizedLength >= Math.ceil(secondLongestOptionLength * 1.45)
    && correctSpecificity >= maxDistractorSpecificity + 2
  ) {
    issues.push('correct-option-detail-outlier');
  }

  const vagueDistractorCount = optionTexts
    .filter((_, index) => index !== correctIndex)
    .filter((option) => VAGUE_OPTION_PATTERNS.some((pattern) => pattern.test(option)))
    .length;
  if (
    correctSpecificity >= 3
    && vagueDistractorCount >= 2
    && median(distractorSpecificity) <= correctSpecificity
  ) {
    issues.push('correct-option-specificity-outlier');
  }
  if (vagueDistractorCount >= 2) {
    issues.push('vague-distractors');
  }

  return issues;
}

// --- Generation Buffer ---
export function buildGenerationBuffer(remainingQuestions: number): number {
  if (remainingQuestions <= 1) {
    return 0;
  }

  return Math.min(3, Math.max(1, Math.ceil(remainingQuestions * 0.4)));
}

// --- Utilities ---
function normalizeOptionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isFrontMatterQuestion(questionText: string): boolean {
  if (FRONT_MATTER_QUESTION_PATTERNS.some((pattern) => pattern.test(questionText))) {
    return true;
  }

  return (
    /\bwho (described|praised|called|endorsed|recommended|wrote)\b/i.test(questionText)
    && /\b(book|volume|text|work)\b/i.test(questionText)
  );
}

function isSentenceLikeOption(text: string): boolean {
  const trimmed = text.trim();
  return countWords(trimmed) >= 7 && /[.!?]$/.test(trimmed);
}

function countContentTokens(text: string): number {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length >= 5)
    .filter((token) => !STOPWORDS.has(token))
    .length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

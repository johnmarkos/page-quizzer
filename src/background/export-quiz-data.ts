import type { Problem } from '../engine/types.js';
import type { ExtractedContent } from '../shared/messages.js';
import type { CompletedQuizData } from './tab-quiz-sessions.js';

export type ExportQuizData = {
  title: string;
  sourceUrl: string;
  problems: Problem[];
};

export function resolveExportQuizData(params: {
  lastExtracted: ExtractedContent | null;
  currentProblems: Problem[];
  lastCompletedQuiz: CompletedQuizData | null;
  engineState: 'idle' | 'practicing' | 'answered' | 'complete';
}): ExportQuizData | null {
  if (!params.lastExtracted) {
    return null;
  }

  const problems = params.engineState === 'complete' && params.lastCompletedQuiz
    ? params.lastCompletedQuiz.problems
    : params.currentProblems;

  if (problems.length === 0) {
    return null;
  }

  return {
    title: params.lastExtracted.title,
    sourceUrl: params.lastExtracted.url,
    problems: cloneProblems(problems),
  };
}

function cloneProblems(problems: Problem[]): Problem[] {
  return problems.map((problem) => ({
    ...problem,
    options: problem.options.map((option) => ({ ...option })),
  }));
}

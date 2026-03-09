import type { Problem } from '../engine/types.js';

export type OpenQuizzerProblem = {
  id: string;
  type: 'multiple-choice';
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
};

export type OpenQuizzerChapter = {
  chapterTitle: string;
  chapterDescription: string;
  problems: OpenQuizzerProblem[];
};

export function convertToOpenQuizzerFormat(params: {
  title: string;
  sourceUrl: string;
  problems: Problem[];
}): OpenQuizzerChapter {
  return {
    chapterTitle: params.title,
    chapterDescription: `Generated from: ${params.sourceUrl}`,
    problems: params.problems.map((problem, index) => ({
      id: `mc-${String(index + 1).padStart(3, '0')}`,
      type: 'multiple-choice',
      question: problem.question,
      options: problem.options.map(option => option.text),
      correct: problem.options.findIndex(option => option.correct),
      ...(problem.explanation ? { explanation: problem.explanation } : {}),
    })),
  };
}

export function buildOpenQuizzerExportFilename(title: string, date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'quiz';

  return `openquizzer-${year}-${month}-${day}-${slug}.json`;
}

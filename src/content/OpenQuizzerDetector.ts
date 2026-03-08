import type { Problem, Option } from '../engine/types.js';
import { generateId } from '../engine/utils.js';

type RawOpenQuizzerProblem = {
  question?: string;
  q?: string;
  options?: unknown[];
  choices?: unknown[];
  answer?: number;
  correctIndex?: number;
  explanation?: string;
};

export type DetectionResult = {
  detected: boolean;
  problems: Problem[];
};

export function detectOpenQuizzer(): DetectionResult {
  // Look for OpenQuizzer's characteristic DOM structure
  const quizzerEl = document.querySelector('#openquizzer, [data-openquizzer]');
  if (!quizzerEl) {
    return { detected: false, problems: [] };
  }

  // Try to find problems in script tags or data attributes
  const problems = parseOpenQuizzerProblems();
  return { detected: true, problems };
}

function parseOpenQuizzerProblems(): Problem[] {
  // Look for config script or inline data
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || '';
    // Look for problems array in OpenQuizzer config
    const match = text.match(/problems\s*[:=]\s*(\[[\s\S]*?\])\s*[,;}\n]/);
    if (match) {
      try {
        const raw: unknown[] = JSON.parse(match[1]);
        if (!Array.isArray(raw)) continue;
        return raw
          .filter((item): item is RawOpenQuizzerProblem =>
            typeof item === 'object' && item !== null &&
            (typeof (item as RawOpenQuizzerProblem).question === 'string' ||
             typeof (item as RawOpenQuizzerProblem).q === 'string'))
          .map((p: RawOpenQuizzerProblem): Problem => {
            const choices = (p.options || p.choices || [])
              .filter((c): c is string => typeof c === 'string');
            const correctIdx = p.answer ?? p.correctIndex ?? 0;
            return {
              id: generateId(),
              question: (p.question || p.q) as string,
              options: choices.map((text: string, i: number): Option => ({
                text,
                correct: i === correctIdx,
              })),
              explanation: p.explanation,
            };
          });
      } catch {
        // Parse failed, continue looking
      }
    }
  }
  return [];
}

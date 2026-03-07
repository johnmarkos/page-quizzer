import type { Problem } from '../engine/types.js';
import { generateId } from '../engine/utils.js';

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
        const raw = JSON.parse(match[1]);
        return raw.map((p: any) => ({
          id: generateId(),
          question: p.question || p.q,
          options: (p.options || p.choices || []).map((text: string, i: number) => ({
            text,
            correct: i === (p.answer ?? p.correctIndex ?? 0),
          })),
          explanation: p.explanation,
        }));
      } catch {
        // Parse failed, continue looking
      }
    }
  }
  return [];
}

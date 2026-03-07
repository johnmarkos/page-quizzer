import type { Problem } from '../engine/types.js';
import type { BaseProvider } from '../providers/BaseProvider.js';
import type { ExtractedContent } from '../shared/messages.js';
import { CHUNK_SIZE } from '../shared/constants.js';

export type GenerationOptions = {
  density: number;
  maxQuestions: number;
};

export class QuizGenerator {
  #provider: BaseProvider;

  constructor(provider: BaseProvider) {
    this.#provider = provider;
  }

  async generate(
    content: ExtractedContent,
    options: GenerationOptions,
    onStatus?: (status: string) => void,
  ): Promise<Problem[]> {
    const chunks = this.#chunkContent(content.textContent);
    onStatus?.(`Generating questions from ${chunks.length} chunk(s)...`);

    const allProblems: Problem[] = [];

    for (let i = 0; i < chunks.length; i++) {
      onStatus?.(`Processing chunk ${i + 1}/${chunks.length}...`);
      const problems = await this.#provider.generateQuiz({
        content: chunks[i],
        density: options.density,
        maxQuestions: options.maxQuestions - allProblems.length,
        title: content.title,
      });
      allProblems.push(...problems);

      if (allProblems.length >= options.maxQuestions) break;
    }

    return allProblems.slice(0, options.maxQuestions);
  }

  #chunkContent(text: string): string[] {
    const words = text.split(/\s+/);
    if (words.length <= CHUNK_SIZE) return [text];

    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    let current = '';
    let currentWordCount = 0;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).length;
      if (currentWordCount + paraWords > CHUNK_SIZE && current) {
        chunks.push(current.trim());
        current = '';
        currentWordCount = 0;
      }
      current += para + '\n\n';
      currentWordCount += paraWords;
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }
}

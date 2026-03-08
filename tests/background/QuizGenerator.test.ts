import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import { QuizGenerator } from '../../src/background/QuizGenerator.js';
import { BaseProvider, type ProviderConfig } from '../../src/providers/BaseProvider.js';
import type { QuizGenerationParams } from '../../src/prompts/types.js';

class StubProvider extends BaseProvider {
  readonly #topics: string[];
  readonly #topicError: Error | null;
  readonly #problems: Problem[];
  readonly #problemsByCall: Problem[][] | null;
  readonly #failAtCall: number | null;
  readonly #generationError: Error;
  readonly calls: Array<{ maxQuestions: number; density: number; title?: string }> = [];

  constructor(
    config: ProviderConfig,
    options: {
      topics?: string[];
      topicError?: Error | null;
      problems?: Problem[];
      problemsByCall?: Problem[][];
      failAtCall?: number | null;
      generationError?: Error;
    } = {},
  ) {
    super(config);
    this.#topics = options.topics ?? ['science'];
    this.#topicError = options.topicError ?? null;
    this.#problems = options.problems ?? [
      {
        id: 'problem-1',
        question: 'What is energy?',
        options: [
          { text: 'Capacity to do work', correct: true },
          { text: 'A physical object', correct: false },
          { text: 'A type of atom', correct: false },
          { text: 'A weather pattern', correct: false },
        ],
      },
    ];
    this.#problemsByCall = options.problemsByCall ?? null;
    this.#failAtCall = options.failAtCall ?? null;
    this.#generationError = options.generationError ?? new Error('generation failed');
  }

  get name(): string {
    return 'stub';
  }

  get defaultModel(): string {
    return 'stub-model';
  }

  get models(): string[] {
    return ['stub-model'];
  }

  async generateQuiz(params: QuizGenerationParams): Promise<Problem[]> {
    this.calls.push({
      maxQuestions: params.maxQuestions,
      density: params.density,
      title: params.title,
    });
    const callIndex = this.calls.length;
    if (this.#failAtCall === callIndex) {
      throw this.#generationError;
    }

    return this.#problemsByCall?.[callIndex - 1] ?? this.#problems;
  }

  async categorizeTopics(): Promise<string[]> {
    if (this.#topicError) {
      throw this.#topicError;
    }
    return this.#topics;
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

describe('QuizGenerator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns generated problems and topics together', async () => {
    const provider = new StubProvider({ apiKey: 'test' }, { topics: ['physics', 'science'] });
    const generator = new QuizGenerator(provider);

    const result = await generator.generate({
      title: 'Feynman',
      content: 'Energy is the capacity to do work.',
      textContent: 'Energy is the capacity to do work.',
      wordCount: 7,
      excerpt: 'Energy is the capacity to do work.',
      url: 'https://example.com/feynman',
    }, {
      density: 3,
      maxQuestions: 5,
    });

    expect(result.problems).toHaveLength(1);
    expect(result.topics).toEqual(['physics', 'science']);
  });

  it('keeps quiz generation working when topic categorization fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new StubProvider({ apiKey: 'test' }, { topicError: new Error('topic fail') });
    const generator = new QuizGenerator(provider);

    const result = await generator.generate({
      title: 'Feynman',
      content: 'Energy is the capacity to do work.',
      textContent: 'Energy is the capacity to do work.',
      wordCount: 7,
      excerpt: 'Energy is the capacity to do work.',
      url: 'https://example.com/feynman',
    }, {
      density: 3,
      maxQuestions: 5,
    });

    expect(result.problems).toHaveLength(1);
    expect(result.topics).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('Topic categorization failed', 'topic fail');
  });

  it('filters low-quality questions and requests a small buffer', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new StubProvider(
      { apiKey: 'test' },
      {
        problems: [
          {
            id: 'accepted',
            question: 'What is energy?',
            options: [
              { text: 'Capacity to do work', correct: true },
              { text: 'Stored heat only', correct: false },
              { text: 'A physical object', correct: false },
              { text: 'A weather pattern', correct: false },
            ],
          },
          {
            id: 'rejected',
            question: 'What is inertia?',
            options: [
              { text: 'Resistance to changes in motion', correct: true },
              { text: 'All of the above', correct: false },
              { text: 'Stored heat', correct: false },
              { text: 'A path', correct: false },
            ],
          },
        ],
      },
    );
    const generator = new QuizGenerator(provider);

    const result = await generator.generate({
      title: 'Feynman',
      content: 'Energy is the capacity to do work and inertia resists changes in motion.',
      textContent: 'Energy is the capacity to do work and inertia resists changes in motion.',
      wordCount: 13,
      excerpt: 'Energy is the capacity to do work.',
      url: 'https://example.com/feynman',
    }, {
      density: 3,
      maxQuestions: 5,
    });

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].id).toBe('accepted');
    expect(provider.calls[0].maxQuestions).toBeGreaterThan(1);
    expect(warnSpy).toHaveBeenCalledWith('Filtered low-quality questions', '1/2');
  });

  it('returns partial quiz data when a later chunk fails after accepted questions exist', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new StubProvider(
      { apiKey: 'test' },
      {
        problemsByCall: [
          [
            {
              id: 'chunk-1-problem',
              question: 'What is energy?',
              options: [
                { text: 'Capacity to do work', correct: true },
                { text: 'Stored heat only', correct: false },
                { text: 'A physical object', correct: false },
                { text: 'A weather pattern', correct: false },
              ],
            },
          ],
        ],
        failAtCall: 2,
        generationError: new Error('rate limit'),
      },
    );
    const generator = new QuizGenerator(provider);
    const text = buildChunkedText([500, 500]);

    const result = await generator.generate({
      title: 'Feynman',
      content: text,
      textContent: text,
      wordCount: 1000,
      excerpt: 'Energy is the capacity to do work.',
      url: 'https://example.com/feynman',
    }, {
      density: 3,
      maxQuestions: 5,
    });

    expect(result.problems).toHaveLength(1);
    expect(result.warning).toContain('Generation stopped early on chunk 2 of 2: rate limit');
    expect(warnSpy).toHaveBeenCalledWith('Quiz generation stopped early', 'chunk 2/2', 'rate limit');
  });

  it('throws when generation fails before any usable questions are created', async () => {
    const provider = new StubProvider(
      { apiKey: 'test' },
      {
        failAtCall: 1,
        generationError: new Error('provider down'),
      },
    );
    const generator = new QuizGenerator(provider);

    await expect(generator.generate({
      title: 'Feynman',
      content: buildChunkedText([500, 500]),
      textContent: buildChunkedText([500, 500]),
      wordCount: 1000,
      excerpt: 'Energy is the capacity to do work.',
      url: 'https://example.com/feynman',
    }, {
      density: 3,
      maxQuestions: 5,
    })).rejects.toThrow('provider down');
  });
});

function buildChunkedText(paragraphWords: number[]): string {
  return paragraphWords
    .map((count, index) => Array.from({ length: count }, () => `word${index}`).join(' '))
    .join('\n\n');
}

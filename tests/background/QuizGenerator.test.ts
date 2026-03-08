import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Problem } from '../../src/engine/types.js';
import { QuizGenerator } from '../../src/background/QuizGenerator.js';
import { BaseProvider, type ProviderConfig } from '../../src/providers/BaseProvider.js';
import type { QuizGenerationParams } from '../../src/prompts/types.js';

class StubProvider extends BaseProvider {
  readonly #topics: string[];
  readonly #topicError: Error | null;
  readonly #problems: Problem[];
  readonly calls: Array<{ maxQuestions: number; density: number; title?: string }> = [];

  constructor(config: ProviderConfig, options: { topics?: string[]; topicError?: Error | null; problems?: Problem[] } = {}) {
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
    return this.#problems;
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
});

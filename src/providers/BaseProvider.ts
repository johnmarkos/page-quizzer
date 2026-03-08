import type { Problem } from '../engine/types.js';
import type { QuizGenerationParams } from '../prompts/types.js';

export type ProviderConfig = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
};

export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract get name(): string;
  abstract get defaultModel(): string;
  abstract get models(): string[];

  get model(): string {
    return this.config.model ?? this.defaultModel;
  }

  abstract generateQuiz(params: QuizGenerationParams): Promise<Problem[]>;
  abstract categorizeTopics(content: string, title?: string): Promise<string[]>;
  abstract testConnection(): Promise<boolean>;

  protected parseTopicsResponse(value: unknown): string[] {
    if (!isObject(value) || !Array.isArray(value.topics)) {
      throw new Error('No topic tags in provider response');
    }

    const normalizedTopics = value.topics
      .filter((topic): topic is string => typeof topic === 'string')
      .map(topic => topic.trim().toLowerCase())
      .filter(Boolean)
      .filter((topic, index, allTopics) => allTopics.indexOf(topic) === index)
      .slice(0, 3);

    if (normalizedTopics.length === 0) {
      throw new Error('No topic tags in provider response');
    }

    return normalizedTopics;
  }
}

function isObject(value: unknown): value is { topics?: unknown } {
  return typeof value === 'object' && value !== null;
}

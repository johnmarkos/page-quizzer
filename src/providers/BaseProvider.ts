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
  abstract testConnection(): Promise<boolean>;
}

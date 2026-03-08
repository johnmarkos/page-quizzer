import { BaseProvider } from './BaseProvider.js';
import type { Problem } from '../engine/types.js';
import type { QuizGenerationParams, QuizGenerationSchema, RawQuizQuestion } from '../prompts/types.js';
import { QUIZ_RESPONSE_JSON_SCHEMA, buildSystemPrompt, buildUserPrompt } from '../prompts/quiz-generation.js';
import { TOPIC_RESPONSE_JSON_SCHEMA, buildTopicPrompt } from '../prompts/topic-categorization.js';
import { parseQuizQuestions } from './parseQuizQuestions.js';
import { parseProviderJson } from './parseProviderJson.js';
import { getDefaultProviderModel, getProviderModels } from './provider-models.js';
import { normalizeProviderBaseUrl } from './provider-settings.js';

type OllamaGenerateResponse = {
  response?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
  }>;
};

export class OllamaProvider extends BaseProvider {
  get name(): string {
    return 'ollama';
  }

  get defaultModel(): string {
    return getDefaultProviderModel('ollama');
  }

  get models(): string[] {
    return getProviderModels('ollama');
  }

  async generateQuiz(params: QuizGenerationParams): Promise<Problem[]> {
    const data = await this.#generateJson<QuizGenerationSchema>({
      prompt: `${buildSystemPrompt()}\n\n${buildUserPrompt(params)}`,
      format: QUIZ_RESPONSE_JSON_SCHEMA,
    });

    if (!data.questions) {
      throw new Error('No quiz questions in Ollama response');
    }

    return this.#parseQuestions(data.questions);
  }

  async categorizeTopics(content: string, title?: string): Promise<string[]> {
    const data = await this.#generateJson({
      prompt: buildTopicPrompt(content, title),
      format: TOPIC_RESPONSE_JSON_SCHEMA,
    });

    return this.parseTopicsResponse(data);
  }

  async testConnection(): Promise<boolean> {
    const response = await fetch(this.#buildUrl('/api/tags'));
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${err}`);
    }

    await response.json() as OllamaTagsResponse;
    return true;
  }

  async #generateJson<T>(body: { prompt: string; format: object }): Promise<T> {
    const response = await fetch(this.#buildUrl('/api/generate'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: body.prompt,
        format: body.format,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${err}`);
    }

    const data = await response.json() as OllamaGenerateResponse;
    if (!data.response) {
      throw new Error('No response content from Ollama');
    }

    return parseProviderJson<T>(data.response, 'Ollama');
  }

  #buildUrl(path: string): string {
    const baseUrl = normalizeProviderBaseUrl('ollama', this.config.baseUrl);
    return `${baseUrl}${path}`;
  }

  #parseQuestions(raw: RawQuizQuestion[]): Problem[] {
    return parseQuizQuestions(raw);
  }
}

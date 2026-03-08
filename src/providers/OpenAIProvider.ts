import { BaseProvider } from './BaseProvider.js';
import type { Problem } from '../engine/types.js';
import type { QuizGenerationParams, RawQuizQuestion, QuizGenerationSchema } from '../prompts/types.js';
import { buildSystemPrompt, buildUserPrompt } from '../prompts/quiz-generation.js';
import { parseQuizQuestions } from './parseQuizQuestions.js';
import { getDefaultProviderModel, getProviderModels } from './provider-models.js';

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export class OpenAIProvider extends BaseProvider {
  get name(): string {
    return 'openai';
  }

  get defaultModel(): string {
    return getDefaultProviderModel('openai');
  }

  get models(): string[] {
    return getProviderModels('openai');
  }

  async generateQuiz(params: QuizGenerationParams): Promise<Problem[]> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(params) },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = await response.json() as OpenAIChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No quiz questions in OpenAI response');
    }

    let parsed: QuizGenerationSchema;
    try {
      parsed = JSON.parse(content) as QuizGenerationSchema;
    } catch {
      throw new Error('Failed to parse OpenAI quiz response as JSON');
    }

    if (!parsed.questions) {
      throw new Error('No quiz questions in OpenAI response');
    }

    return this.#parseQuestions(parsed.questions);
  }

  async testConnection(): Promise<boolean> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        max_completion_tokens: 16,
        messages: [
          { role: 'system', content: 'Respond with a JSON object.' },
          { role: 'user', content: 'Return {"ok": true}' },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    return true;
  }

  #parseQuestions(raw: RawQuizQuestion[]): Problem[] {
    return parseQuizQuestions(raw);
  }
}

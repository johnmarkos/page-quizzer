import { BaseProvider } from './BaseProvider.js';
import type { Problem } from '../engine/types.js';
import type { QuizGenerationParams, RawQuizQuestion } from '../prompts/types.js';
import { buildSystemPrompt, buildUserPrompt, QUIZ_TOOL_SCHEMA } from '../prompts/quiz-generation.js';
import { parseQuizQuestions } from './parseQuizQuestions.js';

export class AnthropicProvider extends BaseProvider {
  get name(): string {
    return 'anthropic';
  }

  get defaultModel(): string {
    return 'claude-haiku-4-5-20251001';
  }

  async generateQuiz(params: QuizGenerationParams): Promise<Problem[]> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: buildSystemPrompt(),
        tools: [QUIZ_TOOL_SCHEMA],
        tool_choice: { type: 'tool', name: 'generate_quiz' },
        messages: [
          { role: 'user', content: buildUserPrompt(params) },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const toolBlock = data.content?.find(
      (b: any) => b.type === 'tool_use' && b.name === 'generate_quiz'
    );

    if (!toolBlock?.input?.questions) {
      throw new Error('No quiz questions in API response');
    }

    return this.#parseQuestions(toolBlock.input.questions);
  }

  async testConnection(): Promise<boolean> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      }),
    });
    return response.ok;
  }

  #parseQuestions(raw: RawQuizQuestion[]): Problem[] {
    return parseQuizQuestions(raw);
  }
}

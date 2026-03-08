import { BaseProvider } from './BaseProvider.js';
import type { Problem } from '../engine/types.js';
import type { QuizGenerationParams, RawQuizQuestion } from '../prompts/types.js';
import { buildSystemPrompt, buildUserPrompt, QUIZ_TOOL_SCHEMA } from '../prompts/quiz-generation.js';
import { buildTopicPrompt } from '../prompts/topic-categorization.js';
import { parseQuizQuestions } from './parseQuizQuestions.js';
import { parseTopicResponse } from './parseTopics.js';
import { getDefaultProviderModel, getProviderModels } from './provider-models.js';

type AnthropicContentBlock = {
  type: string;
  name?: string;
  text?: string;
  input?: { questions?: RawQuizQuestion[] };
};

type AnthropicMessagesResponse = {
  content?: AnthropicContentBlock[];
};

export class AnthropicProvider extends BaseProvider {
  get name(): string {
    return 'anthropic';
  }

  get defaultModel(): string {
    return getDefaultProviderModel('anthropic');
  }

  get models(): string[] {
    return getProviderModels('anthropic');
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

    const data: AnthropicMessagesResponse = await response.json();
    const toolBlock = data.content?.find(
      (b: AnthropicContentBlock) => b.type === 'tool_use' && b.name === 'generate_quiz'
    );

    if (!toolBlock?.input?.questions) {
      throw new Error('No quiz questions in API response');
    }

    return this.#parseQuestions(toolBlock.input.questions);
  }

  async categorizeTopics(content: string, title?: string): Promise<string[]> {
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
        max_tokens: 256,
        messages: [{ role: 'user', content: buildTopicPrompt(content, title) }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data: AnthropicMessagesResponse = await response.json();
    const textBlock = data.content?.find((block: AnthropicContentBlock) => block.type === 'text');
    if (!textBlock?.text) {
      throw new Error('No topic tags in Anthropic response');
    }

    return this.parseTopicsResponse(parseTopicResponse(textBlock.text));
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

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    return true;
  }

  #parseQuestions(raw: RawQuizQuestion[]): Problem[] {
    return parseQuizQuestions(raw);
  }
}

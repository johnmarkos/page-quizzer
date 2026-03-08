import { BaseProvider } from './BaseProvider.js';
import type { Problem } from '../engine/types.js';
import type { QuizGenerationParams, QuizGenerationSchema, RawQuizQuestion } from '../prompts/types.js';
import {
  QUIZ_RESPONSE_JSON_SCHEMA,
  buildSystemPrompt,
  buildUserPrompt,
} from '../prompts/quiz-generation.js';
import { TOPIC_RESPONSE_JSON_SCHEMA, buildTopicPrompt } from '../prompts/topic-categorization.js';
import { parseQuizQuestions } from './parseQuizQuestions.js';
import { parseTopicResponse } from './parseTopics.js';
import { getDefaultProviderModel, getProviderModels } from './provider-models.js';

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider extends BaseProvider {
  get name(): string {
    return 'gemini';
  }

  get defaultModel(): string {
    return getDefaultProviderModel('gemini');
  }

  get models(): string[] {
    return getProviderModels('gemini');
  }

  async generateQuiz(params: QuizGenerationParams): Promise<Problem[]> {
    const response = await fetch(`${GEMINI_API_BASE_URL}/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt() }],
        },
        contents: [
          {
            parts: [{ text: buildUserPrompt(params) }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: QUIZ_RESPONSE_JSON_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    const data = await response.json() as GeminiGenerateContentResponse;
    const content = getTextResponse(data);

    if (!content) {
      throw new Error('No quiz questions in Gemini response');
    }

    let parsed: QuizGenerationSchema;
    try {
      parsed = JSON.parse(content) as QuizGenerationSchema;
    } catch {
      throw new Error('Failed to parse Gemini quiz response as JSON');
    }

    if (!parsed.questions) {
      throw new Error('No quiz questions in Gemini response');
    }

    return this.#parseQuestions(parsed.questions);
  }

  async testConnection(): Promise<boolean> {
    const response = await fetch(`${GEMINI_API_BASE_URL}/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Return {"ok": true} as JSON.' }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
            },
            required: ['ok'],
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    return true;
  }

  async categorizeTopics(content: string, title?: string): Promise<string[]> {
    const response = await fetch(`${GEMINI_API_BASE_URL}/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildTopicPrompt(content, title) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: TOPIC_RESPONSE_JSON_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    const data = await response.json() as GeminiGenerateContentResponse;
    const contentText = getTextResponse(data);
    if (!contentText) {
      throw new Error('No topic tags in Gemini response');
    }

    return this.parseTopicsResponse(parseTopicResponse(contentText));
  }

  #parseQuestions(raw: RawQuizQuestion[]): Problem[] {
    return parseQuizQuestions(raw);
  }
}

function getTextResponse(response: GeminiGenerateContentResponse): string | null {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    return null;
  }

  const text = parts
    .map(part => part.text ?? '')
    .join('')
    .trim();

  return text || null;
}

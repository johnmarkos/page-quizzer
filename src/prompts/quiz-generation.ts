import type { QuizGenerationParams } from './types.js';

export const QUIZ_GENERATION_VERSION = '1.0';

export function buildSystemPrompt(): string {
  return `You are a quiz question generator for retrieval practice. Your job is to create multiple-choice questions from the provided text content.

Rules:
- Questions should test comprehension of key concepts, not trivial details
- Each question must have exactly 4 options
- Exactly one option must be correct
- Wrong options should be plausible but clearly incorrect
- Questions should be self-contained (understandable without the source text)
- Vary question types: factual recall, conceptual understanding, application
- Avoid "all of the above" or "none of the above" options
- Keep questions concise and clear`;
}

export function buildUserPrompt(params: QuizGenerationParams): string {
  const wordCount = params.content.split(/\s+/).length;
  const targetCount = Math.min(
    Math.max(1, Math.round((wordCount / 100) * params.density)),
    params.maxQuestions
  );

  return `Generate ${targetCount} multiple-choice questions from the following text.${
    params.title ? ` The text is from: "${params.title}".` : ''
  }

TEXT:
${params.content}

Return your response as a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "What is...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of why the answer is correct"
    }
  ]
}`;
}

export const QUIZ_TOOL_SCHEMA = {
  name: 'generate_quiz',
  description: 'Generate multiple-choice quiz questions from text content',
  input_schema: {
    type: 'object' as const,
    properties: {
      questions: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            question: { type: 'string' as const },
            options: {
              type: 'array' as const,
              items: { type: 'string' as const },
              minItems: 4,
              maxItems: 4,
            },
            correctIndex: { type: 'integer' as const, minimum: 0, maximum: 3 },
            explanation: { type: 'string' as const },
          },
          required: ['question', 'options', 'correctIndex'],
        },
      },
    },
    required: ['questions'],
  },
};

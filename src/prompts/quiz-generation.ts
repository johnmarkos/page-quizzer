import type { QuizGenerationParams } from './types.js';

export const QUIZ_GENERATION_VERSION = '1.4';

export function buildSystemPrompt(): string {
  return `You are a quiz question generator for retrieval practice. Your job is to create multiple-choice questions from the provided text content.

Rules:
- Questions should test comprehension of key concepts, not trivial details
- Each question must have exactly 4 options, or exactly 2 options for true/false questions
- For true/false questions, the options must be exactly ["True", "False"]
- Exactly one option must be correct
- Wrong options should be plausible and based on realistic misunderstandings of the text
- For 4-option questions, all four options should be the same kind of thing: similar category, specificity, tone, and length
- Avoid giveaway distractors: joke answers, obviously vague answers, answers that are much shorter or longer than the others, or options that repeat the question wording in an unnatural way
- Questions should be self-contained (understandable without the source text)
- Prefer conceptual understanding, comparison, cause/effect, and application over trivial fact recall
- For long-form books, papers, and chapters, prefer mechanism, implication, comparison, and scope questions over date/edition/publisher trivia
- When possible, make the wrong answers reflect likely confusions a reader could have after skimming the text
- Include some true/false questions when the content supports concise binary claims, but keep most questions as 4-option multiple choice
- Avoid "all of the above" or "none of the above" options
- Avoid questions whose answer is obvious from tone alone or because one option sounds noticeably more sophisticated than the others
- If three options can be rejected immediately as vague, generic, or from the wrong conceptual category, rewrite or skip the question
- Make wrong answers share domain vocabulary with the correct answer when the text supports that, so the choice requires discrimination rather than spotting the only specific option
- Avoid publication-metadata questions (edition, publisher, copyright, ISBN, table of contents) unless that metadata is itself central to the passage
- Also avoid front matter such as blurbs, reviewer praise, acknowledgments, dedications, forewords, prefaces, and cover-copy unless that material is itself the subject of the passage
- Do not make the correct answer the obviously longest, most qualified, most technical, or most detailed option
- If the source text does not support a strong question, skip it rather than inventing weak options
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
    },
    {
      "question": "True or false: ...?",
      "options": ["True", "False"],
      "correctIndex": 1,
      "explanation": "Brief explanation of why the answer is correct"
    }
  ]
}

Additional quality requirements:
- Write questions that reward understanding, not just keyword matching
- For 4-option questions, make all options parallel in style and detail so the correct answer does not stand out
- Use distractors that are close enough to tempt an attentive but imperfect reader
- Avoid options that are silly, extreme, generic, or obviously unrelated to the passage
- For long-form expository text, avoid bibliographic/front-matter trivia unless it is genuinely part of the argument
- If one option is much more precise or domain-specific than the others, rewrite the question so all choices are similarly specific
- Do not let the correct answer stand out because it is the longest, most detailed, or only clause-heavy option
- Avoid questions about blurbs, praise quotes, copyright pages, publisher names, or edition metadata unless the passage is explicitly about that material`;
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
              anyOf: [
                {
                  type: 'array' as const,
                  items: { type: 'string' as const },
                  minItems: 2,
                  maxItems: 2,
                },
                {
                  type: 'array' as const,
                  items: { type: 'string' as const },
                  minItems: 4,
                  maxItems: 4,
                },
              ],
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

export const QUIZ_RESPONSE_JSON_SCHEMA = {
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
            minItems: 2,
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
};

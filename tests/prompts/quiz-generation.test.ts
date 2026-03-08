import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  buildUserPrompt,
  QUIZ_RESPONSE_JSON_SCHEMA,
  QUIZ_TOOL_SCHEMA,
  QUIZ_GENERATION_VERSION,
} from '../../src/prompts/quiz-generation.js';

describe('quiz-generation prompts', () => {
  it('builds a system prompt with key instructions', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('multiple-choice');
    expect(prompt).toContain('4 options');
    expect(prompt).toContain('true/false');
    expect(prompt).toContain('retrieval practice');
    expect(prompt).toContain('same kind of thing');
    expect(prompt).toContain('realistic misunderstandings');
    expect(prompt).toContain('one option sounds noticeably more sophisticated');
    expect(prompt).toContain('date/edition/publisher trivia');
    expect(prompt).toContain('wrong conceptual category');
    expect(prompt).toContain('blurbs, reviewer praise, acknowledgments');
    expect(prompt).toContain('obviously longest, most qualified, most technical');
  });

  it('calculates target question count from density', () => {
    const prompt = buildUserPrompt({
      content: 'word '.repeat(200), // 200 words
      density: 3,
      maxQuestions: 50,
    });
    // 200 words * 3/100 = 6 questions
    expect(prompt).toContain('Generate 6 multiple-choice questions');
  });

  it('respects maxQuestions cap', () => {
    const prompt = buildUserPrompt({
      content: 'word '.repeat(10000), // 10000 words
      density: 5,
      maxQuestions: 20,
    });
    expect(prompt).toContain('Generate 20 multiple-choice questions');
  });

  it('includes title when provided', () => {
    const prompt = buildUserPrompt({
      content: 'word '.repeat(100),
      density: 3,
      maxQuestions: 50,
      title: 'Test Article',
    });
    expect(prompt).toContain('Test Article');
  });

  it('adds distractor quality instructions to the user prompt', () => {
    const prompt = buildUserPrompt({
      content: 'word '.repeat(150),
      density: 3,
      maxQuestions: 50,
      title: 'Test Article',
    });

    expect(prompt).toContain('Additional quality requirements');
    expect(prompt).toContain('parallel in style and detail');
    expect(prompt).toContain('close enough to tempt an attentive but imperfect reader');
    expect(prompt).toContain('silly, extreme, generic, or obviously unrelated');
    expect(prompt).toContain('bibliographic/front-matter trivia');
    expect(prompt).toContain('much more precise or domain-specific');
    expect(prompt).toContain('longest, most detailed, or only clause-heavy option');
    expect(prompt).toContain('blurbs, praise quotes, copyright pages');
  });

  it('ensures minimum of 1 question', () => {
    const prompt = buildUserPrompt({
      content: 'short', // ~1 word
      density: 3,
      maxQuestions: 50,
    });
    expect(prompt).toContain('Generate 1 multiple-choice question');
  });

  it('tool schema has required fields', () => {
    expect(QUIZ_TOOL_SCHEMA.name).toBe('generate_quiz');
    expect(QUIZ_TOOL_SCHEMA.input_schema.properties.questions).toBeDefined();
    const itemProps = QUIZ_TOOL_SCHEMA.input_schema.properties.questions.items.properties;
    expect(itemProps.question).toBeDefined();
    expect(itemProps.options).toBeDefined();
    expect(itemProps.correctIndex).toBeDefined();
    expect(itemProps.options.anyOf).toHaveLength(2);
    expect(itemProps.options.anyOf[0].maxItems).toBe(2);
    expect(itemProps.options.anyOf[1].maxItems).toBe(4);
  });

  it('structured output schema supports 2 to 4 options', () => {
    const questionSchema = QUIZ_RESPONSE_JSON_SCHEMA.properties.questions.items;
    expect(questionSchema.properties.options.minItems).toBe(2);
    expect(questionSchema.properties.options.maxItems).toBe(4);
    expect(questionSchema.required).toContain('correctIndex');
  });

  it('bumps the prompt version when quiz-quality instructions change', () => {
    expect(QUIZ_GENERATION_VERSION).toBe('1.4');
  });
});

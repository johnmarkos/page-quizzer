import { describe, expect, it } from 'vitest';
import {
  TOPIC_CATEGORIZATION_VERSION,
  TOPIC_RESPONSE_JSON_SCHEMA,
  buildTopicPrompt,
} from '../../src/prompts/topic-categorization.js';

describe('topic categorization prompt', () => {
  it('includes the prompt version and JSON response instructions', () => {
    expect(TOPIC_CATEGORIZATION_VERSION).toBe('1.0');
    const prompt = buildTopicPrompt('word '.repeat(600), 'Physics');
    expect(prompt).toContain('1-3 topic tags');
    expect(prompt).toContain('Physics');
    expect(prompt).toContain('Return JSON');
  });

  it('limits the embedded text preview to the first 500 words', () => {
    const prompt = buildTopicPrompt(Array.from({ length: 520 }, (_, index) => `word${index}`).join(' '));
    expect(prompt).toContain('word499');
    expect(prompt).not.toContain('word500');
  });

  it('defines a schema with a required topics array', () => {
    expect(TOPIC_RESPONSE_JSON_SCHEMA.required).toContain('topics');
    expect(TOPIC_RESPONSE_JSON_SCHEMA.properties.topics.minItems).toBe(1);
    expect(TOPIC_RESPONSE_JSON_SCHEMA.properties.topics.maxItems).toBe(3);
  });
});

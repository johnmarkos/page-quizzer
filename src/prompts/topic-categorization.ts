export const TOPIC_CATEGORIZATION_VERSION = '1.0';

export function buildTopicPrompt(content: string, title?: string): string {
  return `Categorize the following text into 1-3 topic tags. Use short, lowercase labels like "technology", "science", "history", "programming", "mathematics", "biology", etc.${
    title ? ` Title: "${title}".` : ''
  }

TEXT (first 500 words):
${content.split(/\s+/).slice(0, 500).join(' ')}

Return JSON: {"topics": ["tag1", "tag2"]}`;
}

export const TOPIC_RESPONSE_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    topics: {
      type: 'array' as const,
      items: { type: 'string' as const },
      minItems: 1,
      maxItems: 3,
    },
  },
  required: ['topics'],
};

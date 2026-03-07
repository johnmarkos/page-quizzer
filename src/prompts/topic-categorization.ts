export const TOPIC_CATEGORIZATION_VERSION = '1.0';

export function buildTopicPrompt(content: string, title?: string): string {
  return `Categorize the following text into 1-3 topic tags. Use short, lowercase labels like "technology", "science", "history", "programming", "mathematics", "biology", etc.${
    title ? ` Title: "${title}".` : ''
  }

TEXT (first 500 words):
${content.split(/\s+/).slice(0, 500).join(' ')}

Return JSON: {"topics": ["tag1", "tag2"]}`;
}

export function parseTopicResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Failed to parse topic response as JSON');
  }
}

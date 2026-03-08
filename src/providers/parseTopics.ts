import { parseProviderJson } from './parseProviderJson.js';

export function parseTopicResponse(content: string): unknown {
  return parseProviderJson<unknown>(content, 'topic');
}

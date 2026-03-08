import type { SessionRecord } from '../background/StorageManager.js';

export function getHistoryTopics(records: SessionRecord[]): string[] {
  const topicSet = new Set<string>();

  for (const record of records) {
    for (const topic of record.topics ?? []) {
      topicSet.add(topic);
    }
  }

  return [...topicSet].sort((left, right) => left.localeCompare(right));
}

export function filterSessionsByTopic(records: SessionRecord[], topic: string | null): SessionRecord[] {
  if (!topic) {
    return records;
  }

  return records.filter(record => record.topics?.includes(topic));
}

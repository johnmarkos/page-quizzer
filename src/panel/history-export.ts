import type { SessionRecord } from '../background/StorageManager.js';

export function buildHistoryExportFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `pagequizzer-history-${year}-${month}-${day}.json`;
}

export function serializeHistoryRecords(records: SessionRecord[]): string {
  return JSON.stringify(records, null, 2);
}

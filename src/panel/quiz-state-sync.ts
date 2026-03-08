import type { Problem } from '../engine/types.js';
import type { RestoredStateMessage } from '../shared/messages.js';

export type QuestionStatePayload = {
  problem: Problem;
  index: number;
  total: number;
};

export function getQuestionPayloadFromRestoredState(
  message: RestoredStateMessage | null | undefined,
): QuestionStatePayload | null {
  if (!message || message.type !== 'RESTORED_STATE') {
    return null;
  }

  const payload = message.payload;
  if ((payload.state === 'practicing' || payload.state === 'answered') && payload.problem) {
    return {
      problem: payload.problem,
      index: payload.index,
      total: payload.total,
    };
  }

  return null;
}

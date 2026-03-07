export type Option = {
  text: string;
  correct: boolean;
};

export type Problem = {
  id: string;
  question: string;
  options: Option[];
  explanation?: string;
};

export type Answer = {
  problemId: string;
  selectedIndex: number;
  correct: boolean;
};

export type Score = {
  correct: number;
  incorrect: number;
  skipped: number;
  total: number;
  percentage: number;
};

export type SessionSummary = {
  score: Score;
  answers: Answer[];
  startedAt: number;
  completedAt: number;
};

export type EngineState = 'idle' | 'practicing' | 'answered' | 'complete';

export type EngineEvent =
  | 'stateChange'
  | 'questionShow'
  | 'answerResult'
  | 'quizComplete';

/** Serializable snapshot of engine state for persistence across service worker restarts */
export type EngineSnapshot = {
  state: EngineState;
  problems: Problem[];
  currentIndex: number;
  answers: Answer[];
  startedAt: number;
};

export type EngineEventPayloads = {
  stateChange: { from: EngineState; to: EngineState };
  questionShow: { problem: Problem; index: number; total: number };
  answerResult: { correct: boolean; correctIndex: number; explanation?: string };
  quizComplete: SessionSummary;
};

import type { Problem, SessionSummary } from '../engine/types.js';

// Content script ↔ Background
export type ExtractContentRequest = {
  type: 'EXTRACT_CONTENT';
};

export type ExtractContentResponse = {
  type: 'EXTRACT_CONTENT_RESULT';
  payload: ExtractedContent | { error: string };
};

export type ExtractedContent = {
  title: string;
  content: string;
  textContent: string;
  wordCount: number;
  excerpt: string;
  url: string;
};

// Panel → Background
export type GenerateQuizRequest = {
  type: 'GENERATE_QUIZ';
};

export type StartQuizRequest = {
  type: 'START_QUIZ';
};

export type AnswerQuestionRequest = {
  type: 'ANSWER_QUESTION';
  payload: { optionIndex: number };
};

export type NextQuestionRequest = {
  type: 'NEXT_QUESTION';
};

export type SkipQuestionRequest = {
  type: 'SKIP_QUESTION';
};

export type RetryMissedRequest = {
  type: 'RETRY_MISSED';
};

export type GetReviewRequest = {
  type: 'GET_REVIEW';
};

export type ReviewItemOption = {
  text: string;
  correct: boolean;
  selected: boolean;
};

export type ReviewItem = {
  problemId: string;
  question: string;
  explanation?: string;
  selectedIndex: number;
  correctIndex: number;
  options: ReviewItemOption[];
};

// Background → Panel
export type QuizGeneratedMessage = {
  type: 'QUIZ_GENERATED';
  payload: { problems: Problem[]; title: string };
};

export type QuizErrorMessage = {
  type: 'QUIZ_ERROR';
  payload: { error: string };
};

export type QuestionShowMessage = {
  type: 'QUESTION_SHOW';
  payload: {
    problem: Problem;
    index: number;
    total: number;
  };
};

export type AnswerResultMessage = {
  type: 'ANSWER_RESULT';
  payload: {
    correct: boolean;
    correctIndex: number;
    explanation?: string;
  };
};

export type QuizCompleteMessage = {
  type: 'QUIZ_COMPLETE';
  payload: SessionSummary;
};

export type GeneratingStatusMessage = {
  type: 'GENERATING_STATUS';
  payload: { status: string };
};

export type ReviewDataMessage = {
  type: 'REVIEW_DATA';
  payload: { items: ReviewItem[] };
};

export type SettingsMessage = {
  type: 'SETTINGS';
  payload: {
    provider: string;
    apiKey: string;
    density: number;
    maxQuestions: number;
    model?: string;
  };
};

export type ConnectionResultMessage = {
  type: 'CONNECTION_RESULT';
  payload: { success: boolean };
};

export type SessionsMessage = {
  type: 'SESSIONS';
  payload: Array<{
    id: string;
    url: string;
    title: string;
    date: number;
    topics?: string[];
    score: SessionSummary['score'];
    answers: SessionSummary['answers'];
    startedAt: number;
    completedAt: number;
  }>;
};

export type RestoredStateMessage = {
  type: 'RESTORED_STATE';
  payload:
    | { state: 'idle' | 'complete' }
    | {
        state: 'practicing' | 'answered';
        problem: Problem | null;
        index: number;
        total: number;
        title: string;
      };
};

// Settings messages
export type GetSettingsRequest = {
  type: 'GET_SETTINGS';
};

export type SaveSettingsRequest = {
  type: 'SAVE_SETTINGS';
  payload: {
    provider: string;
    apiKey: string;
    density: number;
    maxQuestions: number;
  };
};

export type TestConnectionRequest = {
  type: 'TEST_CONNECTION';
};

export type GetSessionsRequest = {
  type: 'GET_SESSIONS';
};

export type ImportSessionsRequest = {
  type: 'IMPORT_SESSIONS';
  payload: { json: string };
};

export type GetStateRequest = {
  type: 'GET_STATE';
};

export type ImportSessionsResultMessage = {
  type: 'IMPORT_RESULT';
  payload: {
    importedCount: number;
    totalCount: number;
  };
};

export type Message =
  | ExtractContentRequest
  | ExtractContentResponse
  | GenerateQuizRequest
  | StartQuizRequest
  | AnswerQuestionRequest
  | NextQuestionRequest
  | SkipQuestionRequest
  | RetryMissedRequest
  | GetReviewRequest
  | QuizGeneratedMessage
  | QuizErrorMessage
  | QuestionShowMessage
  | AnswerResultMessage
  | QuizCompleteMessage
  | GeneratingStatusMessage
  | ReviewDataMessage
  | SettingsMessage
  | ConnectionResultMessage
  | SessionsMessage
  | RestoredStateMessage
  | ImportSessionsResultMessage
  | GetSettingsRequest
  | SaveSettingsRequest
  | TestConnectionRequest
  | GetSessionsRequest
  | ImportSessionsRequest
  | GetStateRequest;

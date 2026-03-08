import type { Problem, SessionSummary } from '../engine/types.js';
import type { ProviderName } from '../providers/index.js';

// Content script ↔ Background
export type ExtractContentRequest = {
  type: 'EXTRACT_CONTENT';
};

export type GetSelectionTextRequest = {
  type: 'GET_SELECTION_TEXT';
};

export type ExtractContentResponse = {
  type: 'EXTRACT_CONTENT_RESULT';
  payload: ExtractedContent | { error: string };
};

export type GetSelectionTextResponse = {
  type: 'GET_SELECTION_TEXT_RESULT';
  payload: { text: string } | { error: string };
};

export type ExtractedContent = {
  title: string;
  content: string;
  textContent: string;
  wordCount: number;
  excerpt: string;
  url: string;
  pageTexts?: string[];
};

export type ContentSection = {
  index: number;
  title: string;
  wordCount: number;
  preview: string;
  startPage?: number;
  endPage?: number;
  quizzed?: boolean;
  scorePercentage?: number;
  lastQuizzed?: number;
};

// Panel → Background
export type GenerateQuizRequest = {
  type: 'GENERATE_QUIZ';
  payload?: {
    content?: ExtractedContent;
  };
};

export type GenerateSectionQuizRequest = {
  type: 'GENERATE_SECTION_QUIZ';
  payload?: {
    sectionIndex?: number;
  };
};

export type DismissSectionsRequest = {
  type: 'DISMISS_SECTIONS';
};

export type ReturnToSectionsRequest = {
  type: 'RETURN_TO_SECTIONS';
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

export type GetExportQuizRequest = {
  type: 'GET_EXPORT_QUIZ';
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
  payload: { problems: Problem[]; title: string; warning?: string };
};

export type ContentSectionsMessage = {
  type: 'CONTENT_SECTIONS';
  payload: {
    title: string;
    totalWords: number;
    sections: ContentSection[];
    completedCount: number;
    averageScorePercentage?: number;
  };
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

export type ExportQuizDataMessage = {
  type: 'EXPORT_QUIZ_DATA';
  payload: {
    title: string;
    sourceUrl: string;
    problems: Problem[];
  };
};

export type SettingsMessage = {
  type: 'SETTINGS';
  payload: {
    provider: ProviderName;
    apiKey: string;
    density: number;
    maxQuestions: number;
    timerSeconds: number;
    model?: string;
    baseUrl?: string;
  };
};

export type ConnectionResultMessage = {
  type: 'CONNECTION_RESULT';
  payload: { success: boolean; error?: string };
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
    | { state: 'idle' }
    | {
        state: 'sections';
        title: string;
        totalWords: number;
        sections: ContentSection[];
        completedCount: number;
        averageScorePercentage?: number;
      }
    | {
        state: 'ready';
        title: string;
        total: number;
        warning?: string;
      }
    | {
        state: 'complete';
        summary: SessionSummary;
      }
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
    provider: ProviderName;
    apiKey: string;
    model: string;
    baseUrl?: string;
    density: number;
    maxQuestions: number;
    timerSeconds: number;
  };
};

export type TestConnectionRequest = {
  type: 'TEST_CONNECTION';
  payload?: {
    provider: ProviderName;
    apiKey: string;
    model?: string;
    baseUrl?: string;
  };
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
  | GetSelectionTextRequest
  | ExtractContentResponse
  | GetSelectionTextResponse
  | GenerateQuizRequest
  | GenerateSectionQuizRequest
  | DismissSectionsRequest
  | ReturnToSectionsRequest
  | StartQuizRequest
  | AnswerQuestionRequest
  | NextQuestionRequest
  | SkipQuestionRequest
  | RetryMissedRequest
  | GetReviewRequest
  | GetExportQuizRequest
  | QuizGeneratedMessage
  | ContentSectionsMessage
  | QuizErrorMessage
  | QuestionShowMessage
  | AnswerResultMessage
  | QuizCompleteMessage
  | GeneratingStatusMessage
  | ReviewDataMessage
  | ExportQuizDataMessage
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

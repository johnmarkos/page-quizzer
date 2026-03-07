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

export type Message =
  | ExtractContentRequest
  | ExtractContentResponse
  | GenerateQuizRequest
  | StartQuizRequest
  | AnswerQuestionRequest
  | NextQuestionRequest
  | SkipQuestionRequest
  | QuizGeneratedMessage
  | QuizErrorMessage
  | QuestionShowMessage
  | AnswerResultMessage
  | QuizCompleteMessage
  | GeneratingStatusMessage;

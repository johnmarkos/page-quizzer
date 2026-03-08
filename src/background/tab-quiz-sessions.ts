import type { EngineSnapshot, Problem, SessionSummary } from '../engine/types.js';
import type { ContentSection, ExtractedContent } from '../shared/messages.js';

export type CompletedQuizData = {
  problems: Problem[];
  summary: SessionSummary;
};

export type TabQuizSession = {
  snapshot: EngineSnapshot;
  lastExtracted: ExtractedContent | null;
  sectionSource: ExtractedContent | null;
  pendingSections: ContentSection[] | null;
  activeSectionIndex: number | null;
  currentTopics: string[];
  lastCompletedQuiz: CompletedQuizData | null;
  generationWarning: string | null;
};

export type TabQuizSessionMap = Record<string, TabQuizSession>;

export function createEmptySession(): TabQuizSession {
  return {
    snapshot: {
      state: 'idle',
      problems: [],
      currentIndex: 0,
      answers: [],
      startedAt: 0,
    },
    lastExtracted: null,
    sectionSource: null,
    pendingSections: null,
    activeSectionIndex: null,
    currentTopics: [],
    lastCompletedQuiz: null,
    generationWarning: null,
  };
}

export function getTabQuizSession(sessions: TabQuizSessionMap, tabId: number): TabQuizSession {
  return cloneTabQuizSession(sessions[String(tabId)] ?? createEmptySession());
}

export function setTabQuizSession(
  sessions: TabQuizSessionMap,
  tabId: number,
  session: TabQuizSession,
): TabQuizSessionMap {
  return {
    ...sessions,
    [String(tabId)]: cloneTabQuizSession(session),
  };
}

export function removeTabQuizSession(sessions: TabQuizSessionMap, tabId: number): TabQuizSessionMap {
  const nextSessions = { ...sessions };
  delete nextSessions[String(tabId)];
  return nextSessions;
}

export function hasSessionData(session: TabQuizSession): boolean {
  return (
    session.snapshot.problems.length > 0 ||
    session.lastCompletedQuiz !== null ||
    (session.pendingSections?.length ?? 0) > 0
  );
}

export function cloneTabQuizSession(session: TabQuizSession): TabQuizSession {
  return {
    snapshot: {
      ...session.snapshot,
      problems: session.snapshot.problems.map(problem => ({
        ...problem,
        options: problem.options.map(option => ({ ...option })),
      })),
      answers: session.snapshot.answers.map(answer => ({ ...answer })),
    },
    lastExtracted: session.lastExtracted
      ? {
          ...session.lastExtracted,
          pageTexts: session.lastExtracted.pageTexts ? [...session.lastExtracted.pageTexts] : undefined,
        }
      : null,
    sectionSource: session.sectionSource
      ? {
          ...session.sectionSource,
          pageTexts: session.sectionSource.pageTexts ? [...session.sectionSource.pageTexts] : undefined,
        }
      : null,
    pendingSections: session.pendingSections
      ? session.pendingSections.map(section => ({ ...section }))
      : null,
    activeSectionIndex: session.activeSectionIndex ?? null,
    currentTopics: [...session.currentTopics],
    lastCompletedQuiz: session.lastCompletedQuiz
      ? {
          problems: session.lastCompletedQuiz.problems.map(problem => ({
            ...problem,
            options: problem.options.map(option => ({ ...option })),
          })),
          summary: {
            ...session.lastCompletedQuiz.summary,
            score: { ...session.lastCompletedQuiz.summary.score },
            answers: session.lastCompletedQuiz.summary.answers.map(answer => ({ ...answer })),
          },
        }
      : null,
    generationWarning: session.generationWarning ?? null,
  };
}

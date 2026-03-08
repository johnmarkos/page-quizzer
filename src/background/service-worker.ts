import { QuizEngine } from '../engine/QuizEngine.js';
import { QuizGenerator } from './QuizGenerator.js';
import { StorageManager, type SessionRecord } from './StorageManager.js';
import { createProvider, type ProviderName } from '../providers/index.js';
import type { Message, ExtractedContent } from '../shared/messages.js';
import type { Problem, SessionSummary } from '../engine/types.js';
import { generateId } from '../engine/utils.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { cloneProblems, getMissedProblems } from './retry-missed.js';
import { buildReviewItems } from './review-missed.js';
import { mergeSessionRecords, parseImportedSessions } from './history-import.js';
import { buildQuizBadgeText, shouldClearQuizBadge } from './quiz-badge.js';
import { resolveConnectionSettings } from './connection-settings.js';
import {
  recordQuestionPerformance,
  type QuestionPerformanceMap,
} from './question-performance.js';
import {
  createEmptySession,
  hasSessionData,
  getTabQuizSession,
  removeTabQuizSession,
  setTabQuizSession,
  type CompletedQuizData,
  type TabQuizSessionMap,
} from './tab-quiz-sessions.js';
import { buildOriginPermissionPattern } from '../shared/site-access.js';
import { resolvePdfUrl } from '../shared/pdf.js';
import {
  buildContentScriptAccessError,
  hasUnsupportedInjectionProtocol,
  isHostPermissionInjectionError,
} from './content-script-bridge.js';
import { extractPdfContentFromTabUrl } from './PdfBackgroundExtractor.js';

const CONTENT_SCRIPT_PATH = 'dist/content.js';

const storage = new StorageManager();
const engine = new QuizEngine();

let activeTabId: number | null = null;
let tabSessions: TabQuizSessionMap = {};
let lastExtracted: ExtractedContent | null = null;
let currentProblems: Problem[] = [];
let currentTopics: string[] = [];
let lastCompletedQuiz: CompletedQuizData | null = null;
let currentGenerationWarning: string | null = null;
let questionPerformance: QuestionPerformanceMap = {};

engine.on('stateChange', async () => {
  await persistState();
  await syncBadgeFromEngineState();
});

engine.on('questionShow', (payload) => {
  setQuizBadge(payload.index, payload.total);
  broadcast({ type: 'QUESTION_SHOW', payload });
});

engine.on('answerResult', (payload) => {
  broadcast({ type: 'ANSWER_RESULT', payload });
  const problem = engine.currentProblem;
  if (!problem) {
    return;
  }

  questionPerformance = recordQuestionPerformance(questionPerformance, problem, payload.correct);
  void chrome.storage.local.set({
    [STORAGE_KEYS.QUESTION_PERFORMANCE]: questionPerformance,
  });
});

engine.on('quizComplete', async (payload) => {
  lastCompletedQuiz = {
    problems: cloneProblems(currentProblems),
    summary: cloneSummary(payload),
  };
  await persistState();
  broadcast({ type: 'QUIZ_COMPLETE', payload });

  if (lastExtracted) {
    const record: SessionRecord = {
      ...payload,
      id: generateId(),
      url: lastExtracted.url,
      title: lastExtracted.title,
      date: Date.now(),
      topics: cloneTopics(currentTopics),
    };
    await storage.saveSession(record);
  }
});

clearQuizBadge();
const restorePromise = restoreState();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!(String(tabId) in tabSessions)) {
    return;
  }

  tabSessions = removeTabQuizSession(tabSessions, tabId);
  if (activeTabId === tabId) {
    applyTabSession(createEmptySession(), null);
  }
  void chrome.storage.local.set({ [STORAGE_KEYS.TAB_QUIZ_SESSIONS]: tabSessions });
  clearQuizBadge(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || !(String(tabId) in tabSessions)) {
    return;
  }

  tabSessions = removeTabQuizSession(tabSessions, tabId);
  if (activeTabId === tabId) {
    applyTabSession(createEmptySession(), tabId);
  }
  void chrome.storage.local.set({ [STORAGE_KEYS.TAB_QUIZ_SESSIONS]: tabSessions });
  clearQuizBadge(tabId);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await restorePromise;
  await ensureActiveTabSession(tabId);
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  restorePromise
    .then(() => handleMessage(message, sender))
    .then(sendResponse)
    .catch((err) => {
    sendResponse({ type: 'QUIZ_ERROR', payload: { error: err.message } });
  });
  return true;
});

async function persistState() {
  if (activeTabId === null) {
    return;
  }

  const session = {
    snapshot: engine.serialize(),
    lastExtracted,
    currentTopics: cloneTopics(currentTopics),
    lastCompletedQuiz: lastCompletedQuiz
      ? {
          problems: cloneProblems(lastCompletedQuiz.problems),
          summary: cloneSummary(lastCompletedQuiz.summary),
        }
      : null,
    generationWarning: currentGenerationWarning,
  };

  tabSessions = hasSessionData(session)
    ? setTabQuizSession(tabSessions, activeTabId, session)
    : removeTabQuizSession(tabSessions, activeTabId);

  await chrome.storage.local.set({
    [STORAGE_KEYS.TAB_QUIZ_SESSIONS]: tabSessions,
  });
}

async function restoreState() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.TAB_QUIZ_SESSIONS,
    STORAGE_KEYS.QUESTION_PERFORMANCE,
  ]);
  tabSessions = (data[STORAGE_KEYS.TAB_QUIZ_SESSIONS] as TabQuizSessionMap | undefined) ?? {};
  questionPerformance =
    (data[STORAGE_KEYS.QUESTION_PERFORMANCE] as QuestionPerformanceMap | undefined) ?? {};

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    await ensureActiveTabSession(tab.id);
  } else {
    applyTabSession(createEmptySession(), null);
  }
}

async function handleMessage(message: Message, _sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'GET_SETTINGS':
      return { type: 'SETTINGS', payload: await storage.getSettings() };
    case 'SAVE_SETTINGS':
      await storage.saveSettings(message.payload);
      return { type: 'ok' };
    case 'TEST_CONNECTION':
      return await handleTestConnection(message.payload);
    case 'GET_SESSIONS':
      return { type: 'SESSIONS', payload: await storage.getSessions() };
    case 'IMPORT_SESSIONS':
      return await handleImportSessions(message.payload.json);
    default: {
      const activeTab = await getRequiredActiveTab();
      await ensureActiveTabSession(activeTab.id);

      switch (message.type) {
        case 'GENERATE_QUIZ':
          return await handleGenerateQuiz(activeTab, message.payload?.content);
        case 'START_QUIZ':
          engine.start();
          return { type: 'ok' };
        case 'ANSWER_QUESTION':
          engine.selectOption(message.payload.optionIndex);
          return { type: 'ok' };
        case 'NEXT_QUESTION':
          engine.next();
          return { type: 'ok' };
        case 'SKIP_QUESTION':
          engine.skip();
          return { type: 'ok' };
        case 'RETRY_MISSED':
          return handleRetryMissed();
        case 'GET_REVIEW':
          return handleGetReview();
        case 'GET_EXPORT_QUIZ':
          return handleGetExportQuiz();
        case 'GET_STATE':
          return await handleGetState();
        default:
          return { type: 'ok' };
      }
    }
  }
}

async function handleGetState() {
  const state = engine.state;

  if (state === 'idle' && currentProblems.length > 0 && lastExtracted) {
    return {
      type: 'RESTORED_STATE',
      payload: {
        state: 'ready',
        title: lastExtracted.title,
        total: currentProblems.length,
        warning: currentGenerationWarning ?? undefined,
      },
    };
  }

  if (state === 'practicing' || state === 'answered') {
    return {
      type: 'RESTORED_STATE',
      payload: {
        state,
        problem: engine.currentProblem,
        index: engine.currentIndex,
        total: engine.totalProblems,
        title: lastExtracted?.title || 'Restored Quiz',
      },
    };
  }

  if (state === 'complete' && lastCompletedQuiz) {
    return {
      type: 'RESTORED_STATE',
      payload: {
        state: 'complete',
        summary: cloneSummary(lastCompletedQuiz.summary),
      },
    };
  }

  return { type: 'RESTORED_STATE', payload: { state: 'idle' } };
}

async function handleGenerateQuiz(tab: chrome.tabs.Tab, providedContent?: ExtractedContent) {
  const settings = await storage.getSettings();
  if (!settings.apiKey) {
    throw new Error('No API key configured. Open Settings to add one.');
  }

  if (providedContent) {
    lastExtracted = { ...providedContent };
  } else {
    broadcastStatus('Extracting page content...');

    if (tab.url && resolvePdfUrl(tab.url)) {
      broadcastStatus('Extracting PDF text...');
      const pdfContent = await extractPdfContentFromTabUrl(tab.url, tab.title);
      if (!pdfContent) {
        throw new Error('Failed to resolve the PDF URL for this tab.');
      }
      lastExtracted = pdfContent;
    } else {
      const extractResponse = await extractContentFromTab(tab);

      if (extractResponse?.payload?.error) {
        throw new Error(extractResponse.payload.error);
      }

      lastExtracted = extractResponse.payload as ExtractedContent;
    }
  }

  if (!lastExtracted.textContent || lastExtracted.wordCount < 50) {
    throw new Error('Not enough text content on this page (minimum 50 words)');
  }

  const provider = createProvider(settings.provider, {
    apiKey: settings.apiKey,
    model: settings.model,
  });

  const generator = new QuizGenerator(provider);
  const generatedQuiz = await generator.generate(
    lastExtracted,
    { density: settings.density, maxQuestions: settings.maxQuestions },
    (status) => broadcastStatus(status),
  );

  const problems = generatedQuiz.problems;
  if (problems.length === 0) {
    throw new Error('Failed to generate questions from this content');
  }

  currentProblems = cloneProblems(problems);
  currentTopics = cloneTopics(generatedQuiz.topics);
  lastCompletedQuiz = null;
  currentGenerationWarning = generatedQuiz.warning ?? null;
  engine.loadProblems(problems);

  return {
    type: 'QUIZ_GENERATED',
    payload: { problems, title: lastExtracted.title, warning: generatedQuiz.warning },
  };
}

async function extractContentFromTab(tab: chrome.tabs.Tab) {
  if (!tab.id) {
    throw new Error('No active tab');
  }

  if (hasUnsupportedInjectionProtocol(tab.url)) {
    throw new Error('PageQuizzer cannot access this page. Chrome blocks extensions on this type of page.');
  }

  try {
    await attachContentScript(tab.id);
  } catch (injectionError) {
    const originPattern = buildOriginPermissionPattern(tab.url);
    if (originPattern && isHostPermissionInjectionError(injectionError)) {
      broadcastStatus('Requesting permission to access this site...');
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        throw new Error('PageQuizzer needs site access for this page. Approve the Chrome permission prompt and try again.');
      }

      await attachContentScript(tab.id);
    } else {
      throw buildContentScriptAccessError(injectionError);
    }
  }

  return await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
}

async function attachContentScript(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_PATH],
  });
}

async function handleTestConnection(
  override?: { provider: ProviderName; apiKey: string; model?: string },
) {
  const stored = await storage.getSettings();
  const settings = resolveConnectionSettings(stored, override);

  if (!settings.apiKey.trim()) {
    throw new Error('No API key configured');
  }

  const provider = createProvider(settings.provider, {
    apiKey: settings.apiKey,
    model: settings.model,
  });

  try {
    await provider.testConnection();
    return { type: 'CONNECTION_RESULT', payload: { success: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed';
    console.error('Provider connection test failed', {
      provider: settings.provider,
      model: settings.model ?? null,
      error: message,
    });
    return {
      type: 'CONNECTION_RESULT',
      payload: { success: false, error: message },
    };
  }
}

async function handleImportSessions(json: string) {
  const importedSessions = parseImportedSessions(json);
  const existingSessions = await storage.getSessions();
  const mergedSessions = mergeSessionRecords(existingSessions, importedSessions);
  await storage.setSessions(mergedSessions);

  return {
    type: 'IMPORT_RESULT',
    payload: {
      importedCount: importedSessions.length,
      totalCount: mergedSessions.length,
    },
  };
}

function handleRetryMissed() {
  if (!lastCompletedQuiz || lastCompletedQuiz.problems.length === 0) {
    throw new Error('No completed quiz available to retry.');
  }

  const missedProblems = getMissedProblems(
    lastCompletedQuiz.problems,
    lastCompletedQuiz.summary.answers,
  );
  if (missedProblems.length === 0) {
    throw new Error('No missed questions to retry.');
  }

  currentProblems = cloneProblems(missedProblems);
  currentTopics = [];
  currentGenerationWarning = null;
  engine.loadProblems(missedProblems);
  engine.start();
  return { type: 'ok' };
}

function handleGetReview() {
  if (!lastCompletedQuiz || lastCompletedQuiz.problems.length === 0) {
    throw new Error('No completed quiz available for review.');
  }

  return {
    type: 'REVIEW_DATA',
    payload: {
      items: buildReviewItems(
        lastCompletedQuiz.problems,
        lastCompletedQuiz.summary.answers,
      ),
    },
  };
}

function handleGetExportQuiz() {
  if (!lastExtracted || currentProblems.length === 0) {
    throw new Error('No quiz available to export.');
  }

  return {
    type: 'EXPORT_QUIZ_DATA',
    payload: {
      title: lastExtracted.title,
      sourceUrl: lastExtracted.url,
      problems: cloneProblems(currentProblems),
    },
  };
}

function cloneSummary(summary: SessionSummary): SessionSummary {
  return {
    ...summary,
    score: { ...summary.score },
    answers: summary.answers.map(answer => ({ ...answer })),
  };
}

function cloneTopics(topics: unknown): string[] {
  return Array.isArray(topics) ? topics.filter((topic): topic is string => typeof topic === 'string') : [];
}

function applyTabSession(session: ReturnType<typeof getTabQuizSession>, tabId: number | null) {
  activeTabId = tabId;
  engine.restore(session.snapshot);
  currentProblems = cloneProblems(session.snapshot.problems);
  lastExtracted = session.lastExtracted ? { ...session.lastExtracted } : null;
  currentTopics = cloneTopics(session.currentTopics);
  lastCompletedQuiz = session.lastCompletedQuiz
    ? {
        problems: cloneProblems(session.lastCompletedQuiz.problems),
        summary: cloneSummary(session.lastCompletedQuiz.summary),
      }
    : null;
  currentGenerationWarning = session.generationWarning ?? null;
}

async function ensureActiveTabSession(tabId: number) {
  if (activeTabId !== null && activeTabId !== tabId) {
    await persistState();
  }

  applyTabSession(getTabQuizSession(tabSessions, tabId), tabId);
  await syncBadgeFromEngineState();
}

async function getRequiredActiveTab(): Promise<chrome.tabs.Tab & { id: number }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab');
  }

  return tab as chrome.tabs.Tab & { id: number };
}

function setQuizBadge(index: number, total: number) {
  if (activeTabId === null) {
    return;
  }

  chrome.action.setBadgeText({ text: buildQuizBadgeText(index, total), tabId: activeTabId });
  chrome.action.setBadgeBackgroundColor({ color: '#5b4cd4', tabId: activeTabId });
}

function clearQuizBadge(tabId?: number | null) {
  if (tabId === undefined || tabId === null) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  chrome.action.setBadgeText({ text: '', tabId });
}

async function syncBadgeFromEngineState() {
  if (shouldClearQuizBadge(engine.state) || engine.totalProblems === 0) {
    clearQuizBadge(activeTabId);
    return;
  }

  setQuizBadge(engine.currentIndex, engine.totalProblems);
}

function broadcast(message: Message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Panel might not be open — ignore
  });
}

function broadcastStatus(status: string) {
  broadcast({ type: 'GENERATING_STATUS', payload: { status } });
}

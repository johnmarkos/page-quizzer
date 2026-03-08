import { QuizEngine } from '../engine/QuizEngine.js';
import { QuizGenerator } from './QuizGenerator.js';
import { StorageManager, type SessionRecord } from './StorageManager.js';
import { createProvider, type ProviderName } from '../providers/index.js';
import type { Message, ExtractedContent } from '../shared/messages.js';
import type { EngineSnapshot, Problem, SessionSummary } from '../engine/types.js';
import { generateId } from '../engine/utils.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { cloneProblems, getMissedProblems } from './retry-missed.js';
import { buildReviewItems } from './review-missed.js';
import { mergeSessionRecords, parseImportedSessions } from './history-import.js';
import { buildQuizBadgeText, shouldClearQuizBadge } from './quiz-badge.js';
import { resolveConnectionSettings } from './connection-settings.js';
import { buildOriginPermissionPattern } from '../shared/site-access.js';
import { resolvePdfUrl } from '../shared/pdf.js';
import {
  buildContentScriptAccessError,
  hasUnsupportedInjectionProtocol,
  isHostPermissionInjectionError,
} from './content-script-bridge.js';
import { extractPdfContentFromTabUrl } from './PdfBackgroundExtractor.js';

type CompletedQuizData = {
  problems: Problem[];
  summary: SessionSummary;
};

const CONTENT_SCRIPT_PATH = 'dist/content.js';

const storage = new StorageManager();
const engine = new QuizEngine();

let lastExtracted: ExtractedContent | null = null;
let currentProblems: Problem[] = [];
let currentTopics: string[] = [];
let lastCompletedQuiz: CompletedQuizData | null = null;

// --- Service worker persistence ---
// Persist engine state on every state change so Chrome can kill/restart the worker safely

engine.on('stateChange', async () => {
  await persistState();
  await syncBadgeFromEngineState();
});

async function persistState() {
  const snapshot = engine.serialize();
  await chrome.storage.local.set({
    [STORAGE_KEYS.ENGINE_SNAPSHOT]: snapshot,
    [STORAGE_KEYS.LAST_EXTRACTED]: lastExtracted,
    [STORAGE_KEYS.CURRENT_TOPICS]: currentTopics,
  });
}

async function restoreState() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.ENGINE_SNAPSHOT,
    STORAGE_KEYS.LAST_EXTRACTED,
    STORAGE_KEYS.CURRENT_TOPICS,
    STORAGE_KEYS.LAST_COMPLETED_QUIZ,
  ]);
  const snapshot = data[STORAGE_KEYS.ENGINE_SNAPSHOT] as EngineSnapshot | undefined;
  if (snapshot && snapshot.state !== 'idle' && snapshot.problems.length > 0) {
    engine.restore(snapshot);
    currentProblems = cloneProblems(snapshot.problems);
    lastExtracted = data[STORAGE_KEYS.LAST_EXTRACTED] || null;
    currentTopics = cloneTopics(data[STORAGE_KEYS.CURRENT_TOPICS]);
  }

  const completedQuiz = data[STORAGE_KEYS.LAST_COMPLETED_QUIZ] as CompletedQuizData | undefined;
  if (completedQuiz) {
    lastCompletedQuiz = {
      problems: cloneProblems(completedQuiz.problems),
      summary: cloneSummary(completedQuiz.summary),
    };
  }

  await syncBadgeFromEngineState();
}

async function clearPersistedState() {
  currentTopics = [];
  await chrome.storage.local.remove([
    STORAGE_KEYS.ENGINE_SNAPSHOT,
    STORAGE_KEYS.LAST_EXTRACTED,
    STORAGE_KEYS.CURRENT_TOPICS,
  ]);
}

// Restore on startup
clearQuizBadge();
restoreState();

// --- Side panel setup ---
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// --- Wire engine events to panel messages ---
engine.on('questionShow', (payload) => {
  setQuizBadge(payload.index, payload.total);
  broadcast({ type: 'QUESTION_SHOW', payload });
});

engine.on('answerResult', (payload) => {
  broadcast({ type: 'ANSWER_RESULT', payload });
});

engine.on('quizComplete', async (payload) => {
  lastCompletedQuiz = {
    problems: cloneProblems(currentProblems),
    summary: cloneSummary(payload),
  };
  await chrome.storage.local.set({
    [STORAGE_KEYS.LAST_COMPLETED_QUIZ]: lastCompletedQuiz,
  });
  broadcast({ type: 'QUIZ_COMPLETE', payload });

  // Save session record
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

  // Clear persisted mid-quiz state
  await clearPersistedState();
});

// --- Message handling ---
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    sendResponse({ type: 'QUIZ_ERROR', payload: { error: err.message } });
  });
  return true; // async response
});

async function handleMessage(message: Message, _sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'GENERATE_QUIZ':
      return await handleGenerateQuiz();
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
    case 'GET_STATE':
      return await handleGetState();
    default:
      return { type: 'ok' };
  }
}

/** Panel can request current engine state on open (in case worker was restored) */
async function handleGetState() {
  const state = engine.state;
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
  return { type: 'RESTORED_STATE', payload: { state } };
}

async function handleGenerateQuiz() {
  const settings = await storage.getSettings();
  if (!settings.apiKey) {
    throw new Error('No API key configured. Open Settings to add one.');
  }

  // Extract content from active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');

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

  if (!lastExtracted.textContent || lastExtracted.wordCount < 50) {
    throw new Error('Not enough text content on this page (minimum 50 words)');
  }

  // Generate quiz
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
  engine.loadProblems(problems);

  return {
    type: 'QUIZ_GENERATED',
    payload: { problems, title: lastExtracted.title },
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

function setQuizBadge(index: number, total: number) {
  chrome.action.setBadgeText({ text: buildQuizBadgeText(index, total) });
  chrome.action.setBadgeBackgroundColor({ color: '#5b4cd4' });
}

function clearQuizBadge() {
  chrome.action.setBadgeText({ text: '' });
}

async function syncBadgeFromEngineState() {
  if (shouldClearQuizBadge(engine.state) || engine.totalProblems === 0) {
    clearQuizBadge();
    return;
  }

  setQuizBadge(engine.currentIndex, engine.totalProblems);
}

function broadcast(message: any) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Panel might not be open — ignore
  });
}

function broadcastStatus(status: string) {
  broadcast({ type: 'GENERATING_STATUS', payload: { status } });
}

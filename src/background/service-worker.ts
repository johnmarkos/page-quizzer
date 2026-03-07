import { QuizEngine } from '../engine/QuizEngine.js';
import { QuizGenerator } from './QuizGenerator.js';
import { StorageManager, type SessionRecord } from './StorageManager.js';
import { createProvider } from '../providers/index.js';
import type { Message, ExtractedContent } from '../shared/messages.js';
import type { EngineSnapshot } from '../engine/types.js';
import { generateId } from '../engine/utils.js';
import { STORAGE_KEYS } from '../shared/constants.js';

const storage = new StorageManager();
const engine = new QuizEngine();

let lastExtracted: ExtractedContent | null = null;

// --- Service worker persistence ---
// Persist engine state on every state change so Chrome can kill/restart the worker safely

engine.on('stateChange', async () => {
  await persistState();
});

async function persistState() {
  const snapshot = engine.serialize();
  await chrome.storage.local.set({
    [STORAGE_KEYS.ENGINE_SNAPSHOT]: snapshot,
    [STORAGE_KEYS.LAST_EXTRACTED]: lastExtracted,
  });
}

async function restoreState() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.ENGINE_SNAPSHOT,
    STORAGE_KEYS.LAST_EXTRACTED,
  ]);
  const snapshot = data[STORAGE_KEYS.ENGINE_SNAPSHOT] as EngineSnapshot | undefined;
  if (snapshot && snapshot.state !== 'idle' && snapshot.problems.length > 0) {
    engine.restore(snapshot);
    lastExtracted = data[STORAGE_KEYS.LAST_EXTRACTED] || null;
  }
}

async function clearPersistedState() {
  await chrome.storage.local.remove([STORAGE_KEYS.ENGINE_SNAPSHOT, STORAGE_KEYS.LAST_EXTRACTED]);
}

// Restore on startup
restoreState();

// --- Side panel setup ---
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// --- Wire engine events to panel messages ---
engine.on('questionShow', (payload) => {
  broadcast({ type: 'QUESTION_SHOW', payload });
});

engine.on('answerResult', (payload) => {
  broadcast({ type: 'ANSWER_RESULT', payload });
});

engine.on('quizComplete', async (payload) => {
  broadcast({ type: 'QUIZ_COMPLETE', payload });

  // Save session record
  if (lastExtracted) {
    const record: SessionRecord = {
      ...payload,
      id: generateId(),
      url: lastExtracted.url,
      title: lastExtracted.title,
      date: Date.now(),
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
    case 'GET_SETTINGS':
      return { type: 'SETTINGS', payload: await storage.getSettings() };
    case 'SAVE_SETTINGS':
      await storage.saveSettings(message.payload);
      return { type: 'ok' };
    case 'TEST_CONNECTION':
      return await handleTestConnection();
    case 'GET_SESSIONS':
      return { type: 'SESSIONS', payload: await storage.getSessions() };
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

  const extractResponse = await chrome.tabs.sendMessage(tab.id, {
    type: 'EXTRACT_CONTENT',
  });

  if (extractResponse?.payload?.error) {
    throw new Error(extractResponse.payload.error);
  }

  lastExtracted = extractResponse.payload as ExtractedContent;

  if (!lastExtracted.textContent || lastExtracted.wordCount < 50) {
    throw new Error('Not enough text content on this page (minimum 50 words)');
  }

  // Generate quiz
  const provider = createProvider(settings.provider, {
    apiKey: settings.apiKey,
    model: settings.model,
  });

  const generator = new QuizGenerator(provider);
  const problems = await generator.generate(
    lastExtracted,
    { density: settings.density, maxQuestions: settings.maxQuestions },
    (status) => broadcastStatus(status),
  );

  if (problems.length === 0) {
    throw new Error('Failed to generate questions from this content');
  }

  engine.loadProblems(problems);

  return {
    type: 'QUIZ_GENERATED',
    payload: { problems, title: lastExtracted.title },
  };
}

async function handleTestConnection() {
  const settings = await storage.getSettings();
  if (!settings.apiKey) {
    throw new Error('No API key configured');
  }
  const provider = createProvider(settings.provider, {
    apiKey: settings.apiKey,
    model: settings.model,
  });
  const ok = await provider.testConnection();
  return { type: 'CONNECTION_RESULT', payload: { success: ok } };
}

function broadcast(message: any) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Panel might not be open — ignore
  });
}

function broadcastStatus(status: string) {
  broadcast({ type: 'GENERATING_STATUS', payload: { status } });
}

import type { Problem, SessionSummary } from '../engine/types.js';
import type { SessionRecord } from '../background/StorageManager.js';
import type { ContentSection, RestoredStateMessage, ReviewItem } from '../shared/messages.js';
import type { ProviderName } from '../providers/index.js';
import { buildOriginPermissionPattern } from '../shared/site-access.js';
import { buildHistoryExportFilename, serializeHistoryRecords } from './history-export.js';
import { buildManualGeneratePayload } from './manual-content.js';
import { buildQuizExportFilename, buildQuizExportHtml } from './quiz-export.js';
import { filterSessionsByTopic, getHistoryTopics } from './history-topics.js';
import { getProviderModels, normalizeProviderModel } from '../providers/provider-models.js';
import {
  DEFAULT_OLLAMA_BASE_URL,
  normalizeProviderBaseUrl,
  providerSupportsBaseUrl,
} from '../providers/provider-settings.js';
import {
  buildShortcutHelpText,
  getOptionShortcutIndex,
  shouldIgnoreShortcutTarget,
} from './keyboard-shortcuts.js';
import { getQuestionPayloadFromRestoredState } from './quiz-state-sync.js';
import {
  buildTimerProgressPercent,
  formatTimerCountdown,
  normalizeTimerSeconds,
} from './timer-mode.js';

// --- DOM helpers ---
function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function show(el: HTMLElement) { el.classList.remove('hidden'); }
function hide(el: HTMLElement) { el.classList.add('hidden'); }

// --- State ---
let selectedOptionIndex = -1;
let currentExplanation = '';
let currentSessions: SessionRecord[] = [];
let currentDocuments: Array<{
  url: string;
  title: string;
  completedCount: number;
  totalCount: number;
  averageScorePercentage?: number;
  nextSectionIndex: number | null;
  nextSectionTitle?: string;
  allSectionsCompleted: boolean;
  lastActivity: number | null;
}> = [];
let currentOptionCount = 4;
let shortcutHelpVisible = false;
let activeHistoryTopic: string | null = null;
let currentTimerSeconds = 0;
let activeTimerId: number | null = null;
let activeTimerDeadline = 0;
let manualInputMode = false;
let currentResumeDocument: {
  title: string;
  completedCount: number;
  totalCount: number;
  averageScorePercentage?: number;
  nextSectionIndex: number | null;
  nextSectionTitle?: string;
  allSectionsCompleted: boolean;
} | null = null;

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = (btn as HTMLElement).dataset.view;
    if (view) {
      void activateView(view);
    }
  });
});

const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const baseUrlInput = document.getElementById('base-url-input') as HTMLInputElement;
renderModelOptions(providerSelect.value as ProviderName);
providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value as ProviderName;
  renderModelOptions(provider, modelSelect.value);
  renderProviderSettingsFields(provider);
  clearConnectionStatus();
});
const initialSettingsPromise = loadSettings();
renderManualInputMode();

// --- Quiz Flow ---
function showQuizSection(section: string) {
  if (section !== 'quiz-question') {
    stopQuestionTimer();
  }
  ['quiz-idle', 'quiz-loading', 'quiz-sections', 'quiz-ready', 'quiz-question', 'quiz-complete', 'quiz-review', 'quiz-error']
    .forEach(id => hide($(id)));
  show($(section));
}

$('generate-btn').addEventListener('click', async () => {
  showQuizSection('quiz-loading');
  try {
    const manualPayload = getManualGeneratePayload();

    ($('loading-status') as HTMLElement).textContent = 'Checking provider access...';
    const savedSettings = await getSavedSettings();
    await ensureProviderAccess(savedSettings.provider, savedSettings.baseUrl);

    if (!manualPayload) {
      ($('loading-status') as HTMLElement).textContent = 'Checking site access...';
      await ensureSiteAccessForActiveTab();
    }

    ($('loading-status') as HTMLElement).textContent =
      manualPayload ? 'Preparing pasted text...' : 'Extracting content...';
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_QUIZ',
      payload: manualPayload,
    });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
    } else if (response?.type === 'CONTENT_SECTIONS') {
      renderSectionsState(
        response.payload.title,
        response.payload.totalWords,
        response.payload.sections,
        response.payload.completedCount,
        response.payload.averageScorePercentage,
      );
    } else if (response?.type === 'QUIZ_GENERATED') {
      renderReadyState(
        response.payload.title,
        response.payload.problems.length,
        response.payload.warning,
      );
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to generate quiz');
  }
});

$('continue-document-btn').addEventListener('click', async () => {
  try {
    showQuizSection('quiz-loading');
    ($('loading-status') as HTMLElement).textContent = 'Checking provider access...';
    const savedSettings = await getSavedSettings();
    await ensureProviderAccess(savedSettings.provider, savedSettings.baseUrl);
    ($('loading-status') as HTMLElement).textContent = 'Checking site access...';
    await ensureSiteAccessForActiveTab();
    ($('loading-status') as HTMLElement).textContent = 'Resuming next section...';

    const response = await chrome.runtime.sendMessage({ type: 'CONTINUE_DOCUMENT' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
      return;
    }
    if (response?.type === 'CONTENT_SECTIONS') {
      renderSectionsState(
        response.payload.title,
        response.payload.totalWords,
        response.payload.sections,
        response.payload.completedCount,
        response.payload.averageScorePercentage,
      );
      return;
    }
    if (response?.type === 'QUIZ_GENERATED') {
      renderReadyState(
        response.payload.title,
        response.payload.problems.length,
        response.payload.warning,
      );
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to continue this document');
  }
});

$('toggle-manual-btn').addEventListener('click', () => {
  manualInputMode = !manualInputMode;
  renderManualInputMode();
});

async function ensureSiteAccessForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const originPattern = buildOriginPermissionPattern(tab?.url);

  if (!originPattern) {
    return;
  }

  const hasAccess = await chrome.permissions.contains({ origins: [originPattern] });
  if (hasAccess) {
    return;
  }

  ($('loading-status') as HTMLElement).textContent = 'Requesting permission to access this site...';
  const granted = await chrome.permissions.request({ origins: [originPattern] });
  if (!granted) {
    throw new Error('PageQuizzer needs site access for this page. Approve the Chrome permission prompt and try again.');
  }
}

async function ensureProviderAccess(provider: ProviderName, baseUrl?: string) {
  if (!providerSupportsBaseUrl(provider)) {
    return;
  }

  const originPattern = buildOriginPermissionPattern(normalizeProviderBaseUrl(provider, baseUrl));
  if (!originPattern) {
    throw new Error('Ollama base URL must be a valid http:// or https:// URL.');
  }

  const hasAccess = await chrome.permissions.contains({ origins: [originPattern] });
  if (hasAccess) {
    return;
  }

  const granted = await chrome.permissions.request({ origins: [originPattern] });
  if (!granted) {
    throw new Error('PageQuizzer needs permission to contact this Ollama host. Approve the Chrome permission prompt and try again.');
  }
}

$('start-btn').addEventListener('click', async () => {
  try {
    await startQuizFlow({ type: 'START_QUIZ' });
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to start quiz');
  }
});

$('next-btn').addEventListener('click', () => {
  stopQuestionTimer();
  chrome.runtime.sendMessage({ type: 'NEXT_QUESTION' });
});

$('skip-btn').addEventListener('click', () => {
  stopQuestionTimer();
  chrome.runtime.sendMessage({ type: 'SKIP_QUESTION' });
});

$('quit-quiz-btn').addEventListener('click', async () => {
  try {
    stopQuestionTimer();
    const response = await chrome.runtime.sendMessage({ type: 'ABANDON_QUIZ' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
      return;
    }

    resetExplanationState();
    hideShortcutHelp();
    showQuizSection('quiz-idle');
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to end quiz');
  }
});

$('retry-btn').addEventListener('click', async () => {
  try {
    await startQuizFlow({ type: 'START_QUIZ' });
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to restart quiz');
  }
});

$('generate-all-sections-btn').addEventListener('click', async () => {
  try {
    showQuizSection('quiz-loading');
    ($('loading-status') as HTMLElement).textContent = 'Generating quiz from full content...';
    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_SECTION_QUIZ' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
      return;
    }
    if (response?.type === 'QUIZ_GENERATED') {
      renderReadyState(
        response.payload.title,
        response.payload.problems.length,
        response.payload.warning,
      );
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to generate full-content quiz');
  }
});

$('dismiss-sections-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'DISMISS_SECTIONS' });
  showQuizSection('quiz-idle');
});

$('review-missed-btn').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_REVIEW' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
      return;
    }
    if (response?.type === 'REVIEW_DATA') {
      showReview(response.payload.items);
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to load review');
  }
});

$('retry-missed-btn').addEventListener('click', async () => {
  try {
    await startQuizFlow({ type: 'RETRY_MISSED' });
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to retry missed questions');
  }
});

$('new-quiz-btn').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'RETURN_TO_SECTIONS' });
  if (response?.type === 'CONTENT_SECTIONS') {
    renderSectionsState(
      response.payload.title,
      response.payload.totalWords,
      response.payload.sections,
      response.payload.completedCount,
      response.payload.averageScorePercentage,
    );
    return;
  }

  showQuizSection('quiz-idle');
});

$('export-ready-quiz-btn').addEventListener('click', () => {
  void exportCurrentQuiz();
});

$('export-complete-quiz-btn').addEventListener('click', () => {
  void exportCurrentQuiz();
});

$('review-back-btn').addEventListener('click', () => {
  showQuizSection('quiz-complete');
});

$('error-dismiss-btn').addEventListener('click', () => {
  showQuizSection('quiz-idle');
});

$('shortcut-help-btn').addEventListener('click', () => {
  shortcutHelpVisible = !shortcutHelpVisible;
  renderShortcutHelp();
});

$('export-history-btn').addEventListener('click', async () => {
  try {
    const sessions = currentSessions.length > 0 ? currentSessions : await fetchSessions();
    if (sessions.length === 0) {
      return;
    }

    const blob = new Blob([serializeHistoryRecords(sessions)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildHistoryExportFilename();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to export history');
  }
});

$('import-history-btn').addEventListener('click', () => {
  (document.getElementById('import-history-input') as HTMLInputElement).click();
});

$('import-history-input').addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const json = await file.text();
    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_SESSIONS',
      payload: { json },
    });

    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
      return;
    }

    if (response?.type === 'IMPORT_RESULT') {
      await loadHistory();
      const importBtn = $('import-history-btn') as HTMLButtonElement;
      importBtn.textContent = `Imported ${response.payload.importedCount}`;
      setTimeout(() => {
        importBtn.textContent = 'Import History';
      }, 1500);
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to import history');
  } finally {
    input.value = '';
  }
});

$('why-btn').addEventListener('click', () => {
  const explanationBox = $('explanation-box');
  const whyBtn = $('why-btn') as HTMLButtonElement;
  const isHidden = explanationBox.classList.contains('hidden');

  if (isHidden) {
    show(explanationBox);
    whyBtn.textContent = 'Hide Why';
  } else {
    hide(explanationBox);
    whyBtn.textContent = 'Why?';
  }
});

// --- Message listener (from background) ---
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'GENERATING_STATUS':
      showQuizSection('quiz-loading');
      ($('loading-status') as HTMLElement).textContent = message.payload.status;
      break;

    case 'QUIZ_GENERATED':
      renderReadyState(
        message.payload.title,
        message.payload.problems.length,
        message.payload.warning,
      );
      break;

    case 'CONTENT_SECTIONS':
      renderSectionsState(
        message.payload.title,
        message.payload.totalWords,
        message.payload.sections,
        message.payload.completedCount,
        message.payload.averageScorePercentage,
      );
      break;

    case 'QUIZ_ERROR':
      showError(message.payload.error);
      break;

    case 'QUESTION_SHOW':
      showQuestion(message.payload);
      break;

    case 'ANSWER_RESULT':
      showAnswerResult(message.payload);
      break;

    case 'QUIZ_COMPLETE':
      showComplete(message.payload);
      break;
  }
});

function showQuestion(payload: { problem: Problem; index: number; total: number }) {
  showQuizSection('quiz-question');
  hide($('feedback'));
  show($('skip-btn'));
  resetExplanationState();
  hideShortcutHelp();

  const { problem, index, total } = payload;
  currentOptionCount = problem.options.length;
  const pct = ((index / total) * 100).toFixed(0);
  ($('progress-fill') as HTMLElement).style.width = pct + '%';
  ($('progress-text') as HTMLElement).textContent = `Question ${index + 1} of ${total}`;
  ($('question-text') as HTMLElement).textContent = problem.question;
  renderShortcutHelp();
  startQuestionTimer();

  const container = $('options-container');
  container.innerHTML = '';
  container.classList.toggle('true-false-options', problem.options.length === 2);

  problem.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = problem.options.length === 2 ? 'option-btn true-false-btn' : 'option-btn';
    btn.innerHTML = `
      <span class="option-btn-content">
        <span class="option-key">${i + 1}</span>
        <span class="option-text">${escapeHtml(opt.text)}</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      selectedOptionIndex = i;
      chrome.runtime.sendMessage({ type: 'ANSWER_QUESTION', payload: { optionIndex: i } });
    });
    container.appendChild(btn);
  });
}

function showAnswerResult(payload: { correct: boolean; correctIndex: number; explanation?: string }) {
  stopQuestionTimer();
  hide($('skip-btn'));
  show($('feedback'));

  const feedbackText = $('feedback-text');
  feedbackText.textContent = payload.correct ? 'Correct!' : 'Incorrect';
  feedbackText.className = payload.correct ? 'correct' : 'incorrect';

  currentExplanation = payload.explanation?.trim() || '';
  updateExplanationUI();

  // Highlight correct answer green, selected wrong answer red
  const options = document.querySelectorAll('.option-btn');
  options.forEach((btn, i) => {
    (btn as HTMLButtonElement).disabled = true;
    if (i === payload.correctIndex) {
      btn.classList.add('correct');
    } else if (!payload.correct && i === selectedOptionIndex) {
      btn.classList.add('incorrect');
    }
  });
}

function showComplete(payload: SessionSummary) {
  showQuizSection('quiz-complete');
  resetExplanationState();
  hideShortcutHelp();
  ($('score-display') as HTMLElement).textContent = payload.score.percentage + '%';
  ($('score-breakdown') as HTMLElement).textContent =
    `${payload.score.correct} correct, ${payload.score.incorrect} incorrect, ${payload.score.skipped} skipped out of ${payload.score.total}`;

  const reviewMissedBtn = $('review-missed-btn') as HTMLButtonElement;
  reviewMissedBtn.disabled = payload.score.incorrect === 0;
  reviewMissedBtn.textContent = payload.score.incorrect > 0
    ? `Review Missed (${payload.score.incorrect})`
    : 'Review Missed';

  const retryMissedBtn = $('retry-missed-btn') as HTMLButtonElement;
  retryMissedBtn.disabled = payload.score.incorrect === 0;
  retryMissedBtn.textContent = payload.score.incorrect > 0
    ? `Retry Missed (${payload.score.incorrect})`
    : 'Retry Missed';
}

function showReview(items: ReviewItem[]) {
  showQuizSection('quiz-review');
  resetExplanationState();
  hideShortcutHelp();

  const list = $('review-list');
  const empty = $('review-empty');
  if (items.length === 0) {
    list.innerHTML = '';
    show(empty);
    return;
  }

  hide(empty);
  list.innerHTML = items
    .map(item => `
      <article class="review-card">
        <h3 class="review-question">${escapeHtml(item.question)}</h3>
        <div class="review-options">
          ${item.options.map((option, index) => `
            <div class="review-option${option.correct ? ' correct' : ''}${option.selected && !option.correct ? ' incorrect' : ''}">
              <span class="review-option-key">${index + 1}</span>
              <span class="review-option-text">${escapeHtml(option.text)}</span>
            </div>
          `).join('')}
        </div>
        ${item.explanation ? `<p class="review-explanation">${escapeHtml(item.explanation)}</p>` : ''}
      </article>
    `)
    .join('');
}

function showError(message: string) {
  showQuizSection('quiz-error');
  resetExplanationState();
  hideShortcutHelp();
  stopQuestionTimer();
  ($('error-text') as HTMLElement).textContent = message;
}

// --- Settings ---
async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (response?.payload) {
    const s = response.payload;
    providerSelect.value = s.provider;
    renderModelOptions(s.provider, s.model);
    apiKeyInput.value = s.apiKey;
    baseUrlInput.value = s.baseUrl || DEFAULT_OLLAMA_BASE_URL;
    renderProviderSettingsFields(s.provider, s.baseUrl);
    (document.getElementById('density-slider') as HTMLInputElement).value = String(s.density);
    ($('density-value') as HTMLElement).textContent = String(s.density);
    (document.getElementById('max-questions-input') as HTMLInputElement).value = String(s.maxQuestions);
    currentTimerSeconds = normalizeTimerSeconds(s.timerSeconds);
    (document.getElementById('timer-select') as HTMLSelectElement).value = String(currentTimerSeconds);
  }
}

$('density-slider').addEventListener('input', (e) => {
  ($('density-value') as HTMLElement).textContent = (e.target as HTMLInputElement).value;
});

$('save-settings-btn').addEventListener('click', async () => {
  const settings = {
    provider: providerSelect.value as ProviderName,
    apiKey: apiKeyInput.value,
    model: modelSelect.value,
    baseUrl: getCurrentBaseUrl(),
    density: Number((document.getElementById('density-slider') as HTMLInputElement).value),
    maxQuestions: Number((document.getElementById('max-questions-input') as HTMLInputElement).value),
    timerSeconds: normalizeTimerSeconds((document.getElementById('timer-select') as HTMLSelectElement).value),
  };
  currentTimerSeconds = settings.timerSeconds;
  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
  ($('save-settings-btn') as HTMLElement).textContent = 'Saved!';
  setTimeout(() => { ($('save-settings-btn') as HTMLElement).textContent = 'Save Settings'; }, 1500);
});

$('test-connection-btn').addEventListener('click', async () => {
  const status = $('connection-status');
  status.textContent = 'Testing...';
  status.className = '';
  try {
    await ensureProviderAccess(providerSelect.value as ProviderName, getCurrentBaseUrl());
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_CONNECTION',
      payload: {
        provider: providerSelect.value as ProviderName,
        apiKey: apiKeyInput.value,
        model: modelSelect.value,
        baseUrl: getCurrentBaseUrl(),
      },
    });
    if (response?.type === 'CONNECTION_RESULT' && response.payload.success) {
      status.textContent = 'Connected!';
      status.className = 'correct';
    } else if (response?.type === 'CONNECTION_RESULT') {
      status.textContent = response.payload.error || 'Failed';
      status.className = 'error';
    } else if (response?.type === 'QUIZ_ERROR') {
      status.textContent = response.payload.error;
      status.className = 'error';
    } else {
      status.textContent = 'Failed';
      status.className = 'error';
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Error';
    status.className = 'error';
  }
});

function renderProviderSettingsFields(provider: ProviderName, baseUrl?: string) {
  const apiKeySetting = $('api-key-setting');
  const baseUrlSetting = $('base-url-setting');

  if (providerSupportsBaseUrl(provider)) {
    hide(apiKeySetting);
    show(baseUrlSetting);
    baseUrlInput.value = normalizeProviderBaseUrl(provider, baseUrl ?? baseUrlInput.value) || DEFAULT_OLLAMA_BASE_URL;
  } else {
    show(apiKeySetting);
    hide(baseUrlSetting);
  }
}

function getCurrentBaseUrl(): string | undefined {
  return normalizeProviderBaseUrl(providerSelect.value as ProviderName, baseUrlInput.value);
}

function clearConnectionStatus() {
  const status = $('connection-status');
  status.textContent = '';
  status.className = '';
}

async function getSavedSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (!response?.payload) {
    throw new Error('Failed to load saved settings');
  }

  return response.payload;
}

async function loadLibrary() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_DOCUMENT_PROGRESS' });
  currentDocuments = response?.type === 'DOCUMENT_PROGRESS' ? response.payload : [];
  renderLibrary();
}

async function activateView(view: string) {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.view === view);
  });
  document.querySelectorAll('.view').forEach((panel) => panel.classList.add('hidden'));
  $(`${view}-view`).classList.remove('hidden');

  if (view === 'settings') {
    await loadSettings();
  }
  if (view === 'history') {
    await loadHistory();
  }
  if (view === 'library') {
    await loadLibrary();
  }
  if (view === 'quiz') {
    await checkRestoredState();
  }
}

// --- History ---
async function loadHistory() {
  const sessions = await fetchSessions();
  const exportBtn = $('export-history-btn') as HTMLButtonElement;

  currentSessions = sessions;
  activeHistoryTopic = null;
  exportBtn.disabled = sessions.length === 0;
  renderHistory();
}

async function fetchSessions(): Promise<SessionRecord[]> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SESSIONS' });
  return response?.payload || [];
}

async function exportCurrentQuiz() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_EXPORT_QUIZ' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
      return;
    }

    if (response?.type !== 'EXPORT_QUIZ_DATA') {
      throw new Error('Failed to export quiz');
    }

    const html = buildQuizExportHtml(response.payload);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildQuizExportFilename(response.payload.title);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to export quiz');
  }
}

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && shouldIgnoreShortcutTarget(e.target.tagName, e.target.isContentEditable)) {
    return;
  }

  const key = e.key;
  const optionIndex = getOptionShortcutIndex(key, currentOptionCount);
  if (optionIndex !== null) {
    const options = Array.from(document.querySelectorAll('.option-btn'))
      .filter((option) => isElementVisible(option) && !(option as HTMLButtonElement).disabled);
    if (options[optionIndex]) {
      (options[optionIndex] as HTMLButtonElement).click();
    }
  }
  if (key === 'Enter') {
    const nextBtn = $('next-btn');
    if (isElementVisible(nextBtn)) {
      nextBtn.click();
    }
  }
  if (key.toLowerCase() === 's') {
    const skipBtn = $('skip-btn');
    if (isElementVisible(skipBtn)) {
      skipBtn.click();
    }
  }
});

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateExplanationUI() {
  const whyBtn = $('why-btn') as HTMLButtonElement;
  const explanationText = $('explanation-text');

  explanationText.textContent = currentExplanation;

  if (currentExplanation) {
    show(whyBtn);
  } else {
    hide(whyBtn);
  }

  hide($('explanation-box'));
  whyBtn.textContent = 'Why?';
}

function resetExplanationState() {
  currentExplanation = '';
  hide($('why-btn'));
  hide($('explanation-box'));
  ($('why-btn') as HTMLButtonElement).textContent = 'Why?';
  ($('explanation-text') as HTMLElement).textContent = '';
}

function renderShortcutHelp() {
  const tooltip = $('shortcut-help-tooltip');
  const button = $('shortcut-help-btn') as HTMLButtonElement;
  tooltip.textContent = buildShortcutHelpText(currentOptionCount);
  if (shortcutHelpVisible) {
    show(tooltip);
  } else {
    hide(tooltip);
  }
  button.setAttribute('aria-expanded', String(shortcutHelpVisible));
}

function hideShortcutHelp() {
  shortcutHelpVisible = false;
  renderShortcutHelp();
}

function startQuestionTimer() {
  stopQuestionTimer();

  if (currentTimerSeconds <= 0) {
    hide($('timer-panel'));
    return;
  }

  show($('timer-panel'));
  activeTimerDeadline = Date.now() + currentTimerSeconds * 1000;
  renderTimerDisplay();
  activeTimerId = window.setInterval(() => {
    renderTimerDisplay();
    if (Date.now() >= activeTimerDeadline) {
      stopQuestionTimer();
      const skipBtn = $('skip-btn');
      if (isElementVisible(skipBtn) && !(skipBtn as HTMLButtonElement).disabled) {
        skipBtn.click();
      }
    }
  }, 200);
}

function stopQuestionTimer() {
  if (activeTimerId !== null) {
    window.clearInterval(activeTimerId);
    activeTimerId = null;
  }
  activeTimerDeadline = 0;
  hide($('timer-panel'));
}

function renderTimerDisplay() {
  const remainingMs = Math.max(0, activeTimerDeadline - Date.now());
  ($('timer-text') as HTMLElement).textContent = formatTimerCountdown(remainingMs);
  ($('timer-fill') as HTMLElement).style.width =
    `${buildTimerProgressPercent(remainingMs, currentTimerSeconds)}%`;
}

function isElementVisible(element: Element | null): boolean {
  return !!element && !element.closest('.hidden');
}

// --- Restore state on panel open ---
// If the service worker was restarted mid-quiz, the panel needs to catch up
async function checkRestoredState() {
  try {
    await initialSettingsPromise;
    const restoredState = await getRestoredStateFromBackground();
    if (!restoredState || restoredState.type !== 'RESTORED_STATE') {
      return;
    }

    switch (restoredState.payload.state) {
      case 'practicing':
      case 'answered': {
        const questionPayload = getQuestionPayloadFromRestoredState(restoredState);
        if (questionPayload) {
          showQuestion(questionPayload);
        }
        break;
      }
      case 'ready':
        renderReadyState(
          restoredState.payload.title,
          restoredState.payload.total,
          restoredState.payload.warning,
        );
        break;
      case 'sections':
        renderSectionsState(
          restoredState.payload.title,
          restoredState.payload.totalWords,
          restoredState.payload.sections,
          restoredState.payload.completedCount,
          restoredState.payload.averageScorePercentage,
        );
        break;
      case 'document-progress':
        renderDocumentResumeState(restoredState.payload);
        break;
      case 'complete':
        showComplete(restoredState.payload.summary);
        break;
      case 'idle':
        clearDocumentResumeState();
        showQuizSection('quiz-idle');
        break;
    }
  } catch {
    // Service worker not ready yet — panel will show idle state
  }
}

checkRestoredState();

async function startQuizFlow(message: { type: 'START_QUIZ' } | { type: 'RETRY_MISSED' }) {
  await initialSettingsPromise;
  const response = await chrome.runtime.sendMessage(message);
  if (response?.type === 'QUIZ_ERROR') {
    throw new Error(response.payload.error);
  }

  const questionPayload = await syncQuizStateFromBackground();
  if (questionPayload) {
    showQuestion(questionPayload);
    return;
  }

  throw new Error('Quiz started, but PageQuizzer could not load the first question. Try again.');
}

async function syncQuizStateFromBackground() {
  return getQuestionPayloadFromRestoredState(await getRestoredStateFromBackground());
}

async function getRestoredStateFromBackground(): Promise<RestoredStateMessage | null> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  return response?.type === 'RESTORED_STATE' ? response : null;
}

function renderModelOptions(provider: ProviderName, requestedModel?: string) {
  const models = getProviderModels(provider);
  const selectedModel = normalizeProviderModel(provider, requestedModel);

  modelSelect.innerHTML = models
    .map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join('');
  modelSelect.value = selectedModel;
}

function renderReadyState(title: string, count: number, warning?: string) {
  ($('ready-info') as HTMLElement).textContent = `Generated ${count} questions from "${title}"`;

  const warningEl = $('ready-warning');
  const startBtn = $('start-btn') as HTMLButtonElement;

  if (warning) {
    warningEl.textContent = `${warning}. You can still start with ${count} question${count === 1 ? '' : 's'}.`;
    show(warningEl);
    startBtn.textContent = `Start with ${count} Question${count === 1 ? '' : 's'}`;
  } else {
    warningEl.textContent = '';
    hide(warningEl);
    startBtn.textContent = 'Start Quiz';
  }

  showQuizSection('quiz-ready');
}

function renderSectionsState(
  title: string,
  totalWords: number,
  sections: ContentSection[],
  completedCount = 0,
  averageScorePercentage?: number,
) {
  ($('sections-info') as HTMLElement).textContent =
    `"${title}" is long (${totalWords.toLocaleString()} words). Choose a section to quiz.`;
  renderSectionsProgressSummary(sections.length, completedCount, averageScorePercentage);

  const list = $('sections-list');
  list.innerHTML = sections.map(section => `
    <button class="section-card" type="button" data-section-index="${section.index}">
      <span class="section-card-title">${escapeHtml(section.title)}</span>
      <span class="section-card-meta">${escapeHtml(buildSectionMetaText(section))}</span>
      ${section.quizzed ? `<span class="section-card-status">${escapeHtml(buildSectionStatusText(section))}</span>` : ''}
      <span class="section-card-preview">${escapeHtml(section.preview)}${section.preview.length >= 140 ? '...' : ''}</span>
    </button>
  `).join('');

  list.querySelectorAll<HTMLElement>('[data-section-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const sectionIndex = Number(button.dataset.sectionIndex);
      void generateSectionQuiz(sectionIndex);
    });
  });

  showQuizSection('quiz-sections');
}

function renderSectionsProgressSummary(
  totalCount: number,
  completedCount: number,
  averageScorePercentage?: number,
) {
  const progressEl = $('sections-progress');
  if (totalCount === 0 || completedCount === 0) {
    progressEl.textContent = '';
    hide(progressEl);
    return;
  }

  const averageSuffix = typeof averageScorePercentage === 'number'
    ? ` • Avg score ${averageScorePercentage}%`
    : '';
  progressEl.textContent = `Completed ${completedCount} of ${totalCount} sections${averageSuffix}`;
  show(progressEl);
}

function buildSectionMetaText(section: ContentSection): string {
  const parts = [`${section.wordCount.toLocaleString()} words`];
  if (section.startPage !== undefined && section.endPage !== undefined) {
    parts.push(
      section.startPage === section.endPage
        ? `Page ${section.startPage}`
        : `Pages ${section.startPage}-${section.endPage}`,
    );
  }
  return parts.join(' • ');
}

function buildSectionStatusText(section: ContentSection): string {
  if (typeof section.scorePercentage === 'number') {
    return `Completed • ${section.scorePercentage}%`;
  }

  return 'Completed';
}

async function generateSectionQuiz(sectionIndex: number) {
  try {
    showQuizSection('quiz-loading');
    ($('loading-status') as HTMLElement).textContent = `Generating quiz from section ${sectionIndex + 1}...`;
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_SECTION_QUIZ',
      payload: { sectionIndex },
    });

    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
      return;
    }

    if (response?.type === 'QUIZ_GENERATED') {
      renderReadyState(
        response.payload.title,
        response.payload.problems.length,
        response.payload.warning,
      );
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to generate section quiz');
  }
}

function renderManualInputMode() {
  const copy = $('idle-mode-copy');
  const toggleBtn = $('toggle-manual-btn') as HTMLButtonElement;
  const manualPanel = $('manual-input-panel');
  const generateBtn = $('generate-btn') as HTMLButtonElement;
  const resumeCard = $('document-resume-card');

  if (manualInputMode) {
    copy.textContent = 'Generate a quiz from pasted text instead of the current page.';
    toggleBtn.textContent = 'Use Current Page';
    show(manualPanel);
    hide(resumeCard);
    generateBtn.textContent = 'Generate Quiz from Text';
  } else {
    copy.textContent = currentResumeDocument
      ? 'Continue where you left off on this document, or generate a fresh quiz from the current page.'
      : 'Generate a quiz from the current page.';
    toggleBtn.textContent = 'Paste Text Instead';
    hide(manualPanel);
    if (currentResumeDocument) {
      show(resumeCard);
    } else {
      hide(resumeCard);
    }
    generateBtn.textContent = 'Generate Quiz';
  }
}

function renderDocumentResumeState(resumeState: {
  title: string;
  completedCount: number;
  totalCount: number;
  averageScorePercentage?: number;
  nextSectionIndex: number | null;
  nextSectionTitle?: string;
  allSectionsCompleted: boolean;
}) {
  currentResumeDocument = { ...resumeState };
  ($('document-resume-title') as HTMLElement).textContent = resumeState.title;

  const averageSuffix = typeof resumeState.averageScorePercentage === 'number'
    ? ` • Avg score ${resumeState.averageScorePercentage}%`
    : '';
  ($('document-resume-progress') as HTMLElement).textContent =
    `${resumeState.completedCount}/${resumeState.totalCount} sections completed${averageSuffix}`;

  ($('document-resume-next') as HTMLElement).textContent = resumeState.allSectionsCompleted
    ? 'All saved sections are complete. Generate a fresh section list if you want to review one again.'
    : `Next section: ${resumeState.nextSectionTitle ?? `Section ${resumeState.nextSectionIndex! + 1}`}`;

  const continueBtn = $('continue-document-btn') as HTMLButtonElement;
  continueBtn.disabled = resumeState.allSectionsCompleted;
  continueBtn.textContent = resumeState.allSectionsCompleted ? 'All Sections Complete' : 'Continue';

  renderManualInputMode();
  showQuizSection('quiz-idle');
}

function clearDocumentResumeState() {
  currentResumeDocument = null;
  renderManualInputMode();
}

function getManualGeneratePayload() {
  const text = (document.getElementById('manual-text-input') as HTMLTextAreaElement).value;
  const title = (document.getElementById('manual-title-input') as HTMLInputElement).value;
  return buildManualGeneratePayload(manualInputMode, text, title);
}

function renderHistory() {
  const list = $('history-list');
  const empty = $('history-empty');
  const topicFilters = $('history-topic-filters');
  const filteredSessions = filterSessionsByTopic(currentSessions, activeHistoryTopic);
  const availableTopics = getHistoryTopics(currentSessions);

  if (availableTopics.length > 0) {
    topicFilters.innerHTML = [
      renderTopicFilterButton('All', null, activeHistoryTopic === null),
      ...availableTopics.map(topic => renderTopicFilterButton(topic, topic, activeHistoryTopic === topic)),
    ].join('');
    show(topicFilters);

    topicFilters.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach(button => {
      button.addEventListener('click', () => {
        const selectedTopic = button.dataset.topic;
        activeHistoryTopic = selectedTopic === '__all__' ? null : selectedTopic || null;
        renderHistory();
      });
    });
  } else {
    topicFilters.innerHTML = '';
    hide(topicFilters);
  }

  if (filteredSessions.length === 0) {
    show(empty);
    empty.textContent = activeHistoryTopic
      ? `No quiz history yet for "${activeHistoryTopic}".`
      : 'No quiz history yet.';
    list.innerHTML = '';
    return;
  }

  hide(empty);
  list.innerHTML = filteredSessions
    .slice()
    .reverse()
    .map((session) => `
      <div class="history-item">
        <div class="history-title">${escapeHtml(session.title)}</div>
        <div class="history-meta">
          ${session.score.percentage}% &middot; ${session.score.correct}/${session.score.total} &middot;
          ${new Date(session.date).toLocaleDateString()}
        </div>
        ${renderHistoryTopics(session.topics)}
      </div>
    `)
    .join('');
}

function renderLibrary() {
  const list = $('library-list');
  const empty = $('library-empty');

  if (currentDocuments.length === 0) {
    list.innerHTML = '';
    show(empty);
    return;
  }

  hide(empty);
  list.innerHTML = currentDocuments.map((document, index) => `
    <div class="library-card">
      <div class="library-title">${escapeHtml(document.title)}</div>
      <div class="library-meta">
        ${document.completedCount}/${document.totalCount} sections completed${typeof document.averageScorePercentage === 'number' ? ` • Avg ${document.averageScorePercentage}%` : ''}
      </div>
      <div class="library-next">
        ${document.allSectionsCompleted
          ? 'All sections completed'
          : `Next section: ${escapeHtml(document.nextSectionTitle ?? `Section ${document.nextSectionIndex! + 1}`)}`}
      </div>
      <div class="library-url">${escapeHtml(document.url)}</div>
      <div class="library-actions">
        <button class="secondary-btn" type="button" data-library-index="${index}">Open Document</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll<HTMLButtonElement>('[data-library-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const documentIndex = Number(button.dataset.libraryIndex);
      const document = currentDocuments[documentIndex];
      if (document) {
        void openLibraryDocument(document.url);
      }
    });
  });
}

async function openLibraryDocument(url: string) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    await chrome.tabs.update(activeTab.id, { url, active: true });
  } else {
    await chrome.tabs.create({ url, active: true });
  }

  await activateView('quiz');
}

function renderHistoryTopics(topics?: string[]) {
  if (!topics || topics.length === 0) {
    return '';
  }

  return `
    <div class="history-topics">
      ${topics.map(topic => `<span class="history-topic-chip">${escapeHtml(topic)}</span>`).join('')}
    </div>
  `;
}

function renderTopicFilterButton(label: string, topic: string | null, isActive: boolean) {
  return `<button class="history-topic-filter${isActive ? ' active' : ''}" type="button" data-topic="${escapeHtml(topic ?? '__all__')}">${escapeHtml(label)}</button>`;
}

chrome.tabs.onActivated.addListener(() => {
  void checkRestoredState();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!tab.active || !changeInfo.url) {
    return;
  }

  void checkRestoredState();
});

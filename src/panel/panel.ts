import type { Problem, SessionSummary } from '../engine/types.js';
import type { SessionRecord } from '../background/StorageManager.js';
import type { RestoredStateMessage, ReviewItem } from '../shared/messages.js';
import type { ProviderName } from '../providers/index.js';
import { buildOriginPermissionPattern } from '../shared/site-access.js';
import { buildHistoryExportFilename, serializeHistoryRecords } from './history-export.js';
import { filterSessionsByTopic, getHistoryTopics } from './history-topics.js';
import { getProviderModels, normalizeProviderModel } from '../providers/provider-models.js';
import {
  buildShortcutHelpText,
  getOptionShortcutIndex,
  shouldIgnoreShortcutTarget,
} from './keyboard-shortcuts.js';
import { getQuestionPayloadFromRestoredState } from './quiz-state-sync.js';

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
let currentOptionCount = 4;
let shortcutHelpVisible = false;
let activeHistoryTopic: string | null = null;

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const viewId = (btn as HTMLElement).dataset.view + '-view';
    $(viewId).classList.remove('hidden');

    if ((btn as HTMLElement).dataset.view === 'settings') loadSettings();
    if ((btn as HTMLElement).dataset.view === 'history') loadHistory();
  });
});

const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
renderModelOptions(providerSelect.value as ProviderName);
providerSelect.addEventListener('change', () => {
  renderModelOptions(providerSelect.value as ProviderName, modelSelect.value);
});

// --- Quiz Flow ---
function showQuizSection(section: string) {
  ['quiz-idle', 'quiz-loading', 'quiz-ready', 'quiz-question', 'quiz-complete', 'quiz-review', 'quiz-error']
    .forEach(id => hide($(id)));
  show($(section));
}

$('generate-btn').addEventListener('click', async () => {
  showQuizSection('quiz-loading');
  try {
    ($('loading-status') as HTMLElement).textContent = 'Checking site access...';
    await ensureSiteAccessForActiveTab();

    ($('loading-status') as HTMLElement).textContent = 'Extracting content...';
    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_QUIZ' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
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

$('start-btn').addEventListener('click', async () => {
  try {
    await startQuizFlow({ type: 'START_QUIZ' });
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to start quiz');
  }
});

$('next-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'NEXT_QUESTION' });
});

$('skip-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SKIP_QUESTION' });
});

$('retry-btn').addEventListener('click', async () => {
  try {
    await startQuizFlow({ type: 'START_QUIZ' });
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to restart quiz');
  }
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

$('new-quiz-btn').addEventListener('click', () => {
  showQuizSection('quiz-idle');
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
      ($('loading-status') as HTMLElement).textContent = message.payload.status;
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
  ($('error-text') as HTMLElement).textContent = message;
}

// --- Settings ---
async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (response?.payload) {
    const s = response.payload;
    providerSelect.value = s.provider;
    renderModelOptions(s.provider, s.model);
    (document.getElementById('api-key-input') as HTMLInputElement).value = s.apiKey;
    (document.getElementById('density-slider') as HTMLInputElement).value = String(s.density);
    ($('density-value') as HTMLElement).textContent = String(s.density);
    (document.getElementById('max-questions-input') as HTMLInputElement).value = String(s.maxQuestions);
  }
}

$('density-slider').addEventListener('input', (e) => {
  ($('density-value') as HTMLElement).textContent = (e.target as HTMLInputElement).value;
});

$('save-settings-btn').addEventListener('click', async () => {
  const settings = {
    provider: providerSelect.value as ProviderName,
    apiKey: (document.getElementById('api-key-input') as HTMLInputElement).value,
    model: modelSelect.value,
    density: Number((document.getElementById('density-slider') as HTMLInputElement).value),
    maxQuestions: Number((document.getElementById('max-questions-input') as HTMLInputElement).value),
  };
  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
  ($('save-settings-btn') as HTMLElement).textContent = 'Saved!';
  setTimeout(() => { ($('save-settings-btn') as HTMLElement).textContent = 'Save Settings'; }, 1500);
});

$('test-connection-btn').addEventListener('click', async () => {
  const status = $('connection-status');
  status.textContent = 'Testing...';
  status.className = '';
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_CONNECTION',
      payload: {
        provider: providerSelect.value as ProviderName,
        apiKey: (document.getElementById('api-key-input') as HTMLInputElement).value,
        model: modelSelect.value,
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

function isElementVisible(element: Element | null): boolean {
  return !!element && !element.closest('.hidden');
}

// --- Restore state on panel open ---
// If the service worker was restarted mid-quiz, the panel needs to catch up
async function checkRestoredState() {
  try {
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
      case 'complete':
        showComplete(restoredState.payload.summary);
        break;
      case 'idle':
        showQuizSection('quiz-idle');
        break;
    }
  } catch {
    // Service worker not ready yet — panel will show idle state
  }
}

checkRestoredState();

async function startQuizFlow(message: { type: 'START_QUIZ' } | { type: 'RETRY_MISSED' }) {
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

import type { Problem, SessionSummary } from '../engine/types.js';
import type { ReviewItem } from '../shared/messages.js';

// --- DOM helpers ---
function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function show(el: HTMLElement) { el.classList.remove('hidden'); }
function hide(el: HTMLElement) { el.classList.add('hidden'); }

// --- State ---
let selectedOptionIndex = -1;

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

// --- Quiz Flow ---
function showQuizSection(section: string) {
  ['quiz-idle', 'quiz-loading', 'quiz-ready', 'quiz-question', 'quiz-complete', 'quiz-review', 'quiz-error']
    .forEach(id => hide($(id)));
  show($(section));
}

$('generate-btn').addEventListener('click', async () => {
  showQuizSection('quiz-loading');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_QUIZ' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
    } else if (response?.type === 'QUIZ_GENERATED') {
      const count = response.payload.problems.length;
      ($('ready-info') as HTMLElement).textContent =
        `Generated ${count} questions from "${response.payload.title}"`;
      showQuizSection('quiz-ready');
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to generate quiz');
  }
});

$('start-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'START_QUIZ' });
});

$('next-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'NEXT_QUESTION' });
});

$('skip-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SKIP_QUESTION' });
});

$('retry-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'START_QUIZ' });
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
    const response = await chrome.runtime.sendMessage({ type: 'RETRY_MISSED' });
    if (response?.type === 'QUIZ_ERROR') {
      showError(response.payload.error);
    }
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

  const { problem, index, total } = payload;
  const pct = ((index / total) * 100).toFixed(0);
  ($('progress-fill') as HTMLElement).style.width = pct + '%';
  ($('progress-text') as HTMLElement).textContent = `Question ${index + 1} of ${total}`;
  ($('question-text') as HTMLElement).textContent = problem.question;

  const container = $('options-container');
  container.innerHTML = '';

  problem.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-key">${i + 1}</span>${escapeHtml(opt.text)}`;
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

  const explanationText = $('explanation-text');
  if (payload.explanation) {
    explanationText.textContent = payload.explanation;
    show(explanationText);
  } else {
    hide(explanationText);
  }

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
  ($('error-text') as HTMLElement).textContent = message;
}

// --- Settings ---
async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (response?.payload) {
    const s = response.payload;
    (document.getElementById('provider-select') as HTMLSelectElement).value = s.provider;
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
    provider: (document.getElementById('provider-select') as HTMLSelectElement).value,
    apiKey: (document.getElementById('api-key-input') as HTMLInputElement).value,
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
    const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
    if (response?.payload?.success) {
      status.textContent = 'Connected!';
      status.className = 'correct';
    } else {
      status.textContent = 'Failed';
      status.className = 'error';
    }
  } catch {
    status.textContent = 'Error';
    status.className = 'error';
  }
});

// --- History ---
async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SESSIONS' });
  const sessions = response?.payload || [];
  const list = $('history-list');
  const empty = $('history-empty');

  if (sessions.length === 0) {
    show(empty);
    list.innerHTML = '';
    return;
  }

  hide(empty);
  list.innerHTML = sessions
    .slice()
    .reverse()
    .map((s: any) => `
      <div class="history-item">
        <div class="history-title">${escapeHtml(s.title)}</div>
        <div class="history-meta">
          ${s.score.percentage}% &middot; ${s.score.correct}/${s.score.total} &middot;
          ${new Date(s.date).toLocaleDateString()}
        </div>
      </div>
    `)
    .join('');
}

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
  const key = e.key;
  if (['1', '2', '3', '4'].includes(key)) {
    const options = document.querySelectorAll('.option-btn:not(:disabled)');
    const idx = Number(key) - 1;
    if (options[idx]) (options[idx] as HTMLButtonElement).click();
  }
  if (key === 'Enter') {
    const nextBtn = $('next-btn');
    if (!nextBtn.closest('.hidden')) nextBtn.click();
  }
});

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Restore state on panel open ---
// If the service worker was restarted mid-quiz, the panel needs to catch up
async function checkRestoredState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response?.type === 'RESTORED_STATE' && response.payload) {
      const { state, problem, index, total } = response.payload;
      if (state === 'practicing' && problem) {
        showQuestion({ problem, index, total });
      }
      // If answered, we can't restore the answer highlights — show the question
      // and let the user re-answer (minor UX tradeoff vs. complexity)
      if (state === 'answered' && problem) {
        showQuestion({ problem, index, total });
      }
    }
  } catch {
    // Service worker not ready yet — panel will show idle state
  }
}

checkRestoredState();

import type { Problem } from '../engine/types.js';

export function buildQuizExportFilename(title: string, date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const slug = slugifyTitle(title);
  return `pagequizzer-quiz-${year}-${month}-${day}-${slug}.html`;
}

export function buildQuizExportHtml(params: {
  title: string;
  sourceUrl: string;
  problems: Problem[];
}): string {
  const escapedTitle = escapeHtml(params.title);
  const escapedSourceUrl = escapeHtml(params.sourceUrl);
  const safeSourceUrl = sanitizeExportUrl(params.sourceUrl);
  const sourceMarkup = safeSourceUrl
    ? `<a href="${escapeHtml(safeSourceUrl)}">${escapedSourceUrl}</a>`
    : `<span>${escapedSourceUrl}</span>`;
  const quizDataJson = JSON.stringify({
    title: params.title,
    sourceUrl: params.sourceUrl,
    problems: params.problems,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle} - PageQuizzer Export</title>
  <style>
    :root {
      --bg: #f7f4ef;
      --card: #fffdf8;
      --ink: #1f1f1a;
      --muted: #6b6b5f;
      --border: #d7d0c4;
      --accent: #ba4a28;
      --accent-soft: #f3d7cc;
      --success: #1f7a47;
      --error: #b42318;
      --radius: 14px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top, #fffdf8 0%, #f7f4ef 45%, #efe7d8 100%);
      color: var(--ink);
      line-height: 1.55;
      padding: 24px;
    }
    .shell {
      max-width: 760px;
      margin: 0 auto;
      background: color-mix(in srgb, var(--card) 94%, white);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 60px rgba(77, 54, 24, 0.12);
    }
    h1, h2 { margin: 0 0 12px; line-height: 1.15; }
    h1 { font-size: clamp(2rem, 3vw, 2.7rem); }
    .lede { color: var(--muted); margin-bottom: 18px; }
    .source {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.95rem;
      color: var(--muted);
      margin-bottom: 22px;
    }
    .source a { color: var(--accent); }
    .panel {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px;
      background: rgba(255,255,255,0.7);
      margin-top: 18px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-size: 0.95rem;
      margin-bottom: 14px;
    }
    .option {
      width: 100%;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      text-align: left;
      padding: 14px 16px;
      margin-top: 10px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: white;
      color: var(--ink);
      cursor: pointer;
      font: inherit;
    }
    .option:hover:not(:disabled) { border-color: var(--accent); }
    .option-key {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 700;
      flex: 0 0 auto;
    }
    .option.correct { border-color: color-mix(in srgb, var(--success) 55%, var(--border)); background: rgba(31, 122, 71, 0.09); }
    .option.incorrect { border-color: color-mix(in srgb, var(--error) 55%, var(--border)); background: rgba(180, 35, 24, 0.08); }
    .feedback { margin-top: 16px; color: var(--muted); }
    .feedback strong { color: var(--ink); }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    button.primary, button.secondary {
      border-radius: 999px;
      padding: 11px 18px;
      cursor: pointer;
      font: inherit;
    }
    button.primary {
      background: var(--accent);
      color: white;
      border: none;
    }
    button.secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--ink);
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <p class="lede">Exported from PageQuizzer for offline practice.</p>
      <h1>${escapedTitle}</h1>
      <div class="source">
        <span>Source:</span>
        ${sourceMarkup}
      </div>
    </header>

    <section id="quiz-card" class="panel">
      <div class="meta">
        <span id="progress-text"></span>
        <span id="score-text"></span>
      </div>
      <h2 id="question-text"></h2>
      <div id="options"></div>
      <div id="feedback" class="feedback hidden"></div>
      <div class="actions">
        <button id="next-btn" class="primary hidden" type="button">Next</button>
        <button id="restart-btn" class="secondary hidden" type="button">Restart</button>
      </div>
    </section>
  </main>

  <script id="quiz-data" type="application/json">${quizDataJson}</script>
  <script>
    const quizData = JSON.parse(document.getElementById('quiz-data').textContent || '{}');
    const questionText = document.getElementById('question-text');
    const progressText = document.getElementById('progress-text');
    const scoreText = document.getElementById('score-text');
    const options = document.getElementById('options');
    const feedback = document.getElementById('feedback');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');

    let index = 0;
    let answers = [];
    let locked = false;

    function renderQuestion() {
      const problem = quizData.problems[index];
      locked = false;
      progressText.textContent = 'Question ' + (index + 1) + ' of ' + quizData.problems.length;
      scoreText.textContent = '';
      questionText.textContent = problem.question;
      feedback.classList.add('hidden');
      feedback.innerHTML = '';
      nextBtn.classList.add('hidden');
      restartBtn.classList.add('hidden');
      options.innerHTML = '';

      problem.options.forEach((option, optionIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'option';
        button.innerHTML = '<span class="option-key">' + (optionIndex + 1) + '</span><span>' + escapeHtml(option.text) + '</span>';
        button.addEventListener('click', () => answer(optionIndex));
        options.appendChild(button);
      });
    }

    function answer(selectedIndex) {
      if (locked) return;
      locked = true;

      const problem = quizData.problems[index];
      const optionButtons = Array.from(options.querySelectorAll('.option'));
      const correctIndex = problem.options.findIndex((option) => option.correct);
      const isCorrect = selectedIndex === correctIndex;

      answers[index] = isCorrect;
      optionButtons.forEach((button, optionIndex) => {
        button.disabled = true;
        if (optionIndex === correctIndex) {
          button.classList.add('correct');
        } else if (optionIndex === selectedIndex && !isCorrect) {
          button.classList.add('incorrect');
        }
      });

      feedback.classList.remove('hidden');
      feedback.innerHTML =
        '<strong>' + (isCorrect ? 'Correct.' : 'Incorrect.') + '</strong>' +
        (problem.explanation ? ' ' + escapeHtml(problem.explanation) : '');
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = index === quizData.problems.length - 1 ? 'See Score' : 'Next';
    }

    function showScore() {
      const correct = answers.filter(Boolean).length;
      questionText.textContent = 'Quiz complete';
      progressText.textContent = 'Score';
      scoreText.textContent = correct + '/' + quizData.problems.length;
      options.innerHTML = '';
      feedback.classList.remove('hidden');
      feedback.innerHTML = '<strong>' + Math.round((correct / quizData.problems.length) * 100) + '%</strong> correct';
      nextBtn.classList.add('hidden');
      restartBtn.classList.remove('hidden');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    nextBtn.addEventListener('click', () => {
      if (index === quizData.problems.length - 1) {
        showScore();
        return;
      }

      index += 1;
      renderQuestion();
    });

    restartBtn.addEventListener('click', () => {
      index = 0;
      answers = [];
      renderQuestion();
    });

    renderQuestion();
  </script>
</body>
</html>`;
}

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return slug || 'quiz';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeExportUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'file:'].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

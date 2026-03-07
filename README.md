# PageQuizzer

A Chrome extension that generates quiz questions from any web page for retrieval practice.

Open a page, click the extension, and PageQuizzer extracts the content, sends it to an LLM, and quizzes you on it — right in the browser side panel. The goal is active recall: approaching material as questions instead of passive reading.

## How It Works

1. Navigate to any article, blog post, documentation, or wiki page
2. Click the PageQuizzer icon to open the side panel
3. Hit **Generate Quiz** — the extension extracts the page content and generates multiple-choice questions
4. Take the quiz with instant feedback, explanations, and a score summary
5. Review your history across sessions

## Features

- **Content extraction** via [Mozilla Readability](https://github.com/mozilla/readability) — works on articles, docs, blogs, wikis
- **Multiple LLM providers** — Anthropic (Claude) built in, with OpenAI, Gemini, and Ollama planned
- **Configurable density** — control how many questions per 100 words (1–10)
- **Keyboard shortcuts** — 1-4 to select answers, Enter for next question
- **Dark/light mode** — follows your system preference
- **Quiz history** — scores and sessions persist locally
- **Service worker persistence** — Chrome can restart the extension mid-quiz without losing progress

## Setup

```bash
git clone git@github.com:johnmarkos/page-quizzer.git
cd page-quizzer
npm install
npm run build
```

Then load in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the project directory
4. Click the PageQuizzer icon in your toolbar to open the side panel
5. Go to **Settings**, enter your Anthropic API key, and test the connection

## Development

```bash
npm run build          # Build all targets
npm run build:watch    # Watch mode
npm test               # Run tests (Vitest)
```

The project uses esbuild to compile TypeScript into four bundles: service worker, content script, side panel, and a standalone quiz engine module.

## Architecture

```
Content Script          Service Worker           Side Panel
(DOM access)            (logic)                  (UI)
┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│ Readability  │──────▶│ QuizGenerator│        │ Quiz View    │
│ extraction   │       │ Providers    │◀──────▶│ Score View   │
└──────────────┘       │ QuizEngine   │        │ Settings     │
                       │ Storage      │        │ History      │
                       └──────────────┘        └──────────────┘
```

The **quiz engine** (`src/engine/`) is a shared core module with zero Chrome dependencies. It manages the state machine, grading, and event system. It compiles to a standalone ES module at `dist/engine/quizzer-core.js` and is designed to be extracted into its own package for reuse by [OpenQuizzer](https://github.com/johnmarkos/openquizzer) and other consumers.

## Contributing

See [AGENTS.md](AGENTS.md) for architecture rules, conventions, and the self-review checklist. See [ROADMAP.md](ROADMAP.md) for the task queue.

## License

MIT

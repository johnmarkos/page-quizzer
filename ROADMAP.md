# Roadmap

Future features and improvements for PageQuizzer. Completed work is in `CHANGELOG.md`.

## Next Up

- [ ] **Vendor Readability.js** — Bundle Mozilla Readability for robust content extraction across diverse sites
- [ ] **OpenQuizzer detection** — Detect OpenQuizzer pages, parse problems natively (no LLM call needed)
- [ ] **Additional providers** — OpenAI (GPT-4o-mini), Google (Gemini Flash), Ollama (local models)
- [ ] **Topic categorization** — Lightweight LLM prompt to tag quizzes with 1-3 topic labels, filter history by topic
- [ ] **Service worker persistence** — Persist engine state to chrome.storage on every answer; restore on wake

## Future

- [ ] **Export/import history** — Download quiz history as JSON, import on another browser
- [ ] **"Paste your own text" mode** — Manual text input when extraction fails or for non-web content
- [ ] **Question quality feedback** — "Report bad question" button, feed back into prompt iteration
- [ ] **Free-text questions** — LLM-graded open-ended responses alongside multiple-choice
- [ ] **Spaced repetition** — Track per-question performance, resurface missed questions across sessions
- [ ] **Extract QuizzerCore** — Pull `src/engine/` into its own npm package for OpenQuizzer and future consumers (iOS, etc.)

## Exploring

- [ ] **Firefox/Safari ports** — Manifest V3 is converging across browsers
- [ ] **Highlight-to-quiz** — Select text on page, generate questions from just the selection
- [ ] **PDF support** — Extract text from PDF viewer tabs
- [ ] **Collaborative quizzes** — Share generated quizzes via link

## Won't Do (Out of Scope)

- User accounts or server-side storage — stays local-first
- Paid features or premium tiers — MIT licensed, fully open source
- Custom LLM hosting — use Ollama provider for self-hosted models

---

_Completed items go in CHANGELOG.md._

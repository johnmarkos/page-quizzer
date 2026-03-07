# Roadmap

Future features and improvements for PageQuizzer. Completed work is in `CHANGELOG.md`.

## Next Up

- [ ] **OpenQuizzer detection** — Detect OpenQuizzer pages, parse problems natively (no LLM call needed). Content script detects DOM structure, maps OpenQuizzer problem format to QuizEngine Problem type. Badge in panel.
- [ ] **Additional providers** — OpenAI (GPT-4o-mini), Google (Gemini Flash), Ollama (local models). Each provider extends `BaseProvider`. Ollama: no API key, custom base URL, health check.
- [ ] **Topic categorization** — Lightweight LLM prompt (run in parallel with quiz gen) to tag quizzes with 1-3 topic labels. Store with session, add topic filter to history view.

## Future

- [ ] **Export/import history** — Download quiz history as JSON, import on another browser. Round-trip must be lossless.
- [ ] **"Paste your own text" mode** — Manual text input when extraction fails or for non-web content
- [ ] **Question quality feedback** — "Report bad question" button, feed back into prompt iteration
- [ ] **Free-text questions** — LLM-graded open-ended responses alongside multiple-choice
- [ ] **Spaced repetition** — Track per-question performance, resurface missed questions across sessions
- [ ] **Extract QuizzerCore** — Pull `src/engine/` into its own npm package (`quizzer-core` repo). OpenQuizzer and PageQuizzer both import it. Engine API surface must remain identical.

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

_Completed items move to CHANGELOG.md. Update at the end of every milestone._

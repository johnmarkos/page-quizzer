# Roadmap

Future features and improvements for PageQuizzer. Completed work is in `CHANGELOG.md`.

Tasks are designed to be **discrete and independently implementable** — each should be completable in one session, have clear acceptance criteria, and be reviewable without understanding the full history.

## Task Queue — Ready to Implement

These are well-defined, can be picked up in any order (unless noted), and each produces a testable, committable result.

### Providers

- [x] **P1: OpenAI provider** — `src/providers/OpenAIProvider.ts`. Extends `BaseProvider`. Uses chat completions API with `response_format: { type: "json_object" }` for structured output. Default model: `gpt-4o-mini`. Add to provider registry. Add to settings dropdown in panel HTML. Test: factory creates it, name/model getters work.

- [x] **P2: Gemini provider** — `src/providers/GeminiProvider.ts`. Extends `BaseProvider`. Uses Gemini API with JSON mode. Implemented with `gemini-2.5-flash` because Google's current docs mark `gemini-2.0-flash` deprecated. Added to registry and settings dropdown. Test: same pattern as P1.

- [ ] **P3: Ollama provider** — `src/providers/OllamaProvider.ts`. Extends `BaseProvider`. No API key required. Custom `baseUrl` (default `http://localhost:11434`). `testConnection()` hits `/api/tags` endpoint. `generateQuiz()` uses `/api/generate` with JSON format. Default model: `llama3.2`. Add to registry. Settings UI: base URL input instead of API key when Ollama selected. Test: factory, defaults, URL construction.

### Content & Extraction

- [ ] **C1: Paste-your-own-text mode** — Add a textarea to the quiz-idle section in `panel.html`. "Paste text" button toggles between URL extraction and manual input. When text is pasted, skip content script extraction entirely — construct an `ExtractedContent` object directly in the panel and pass it to `GENERATE_QUIZ` (add optional `content` field to the message). Service worker uses provided content if present, otherwise extracts from tab. Test: manual — paste text, generate quiz.

- [ ] **C2: Highlight-to-quiz** — Add context menu item ("Quiz this selection") via `chrome.contextMenus` in service worker. When triggered, send message to content script to get `window.getSelection().toString()`. Use that text instead of full-page extraction. Requires adding `contextMenus` permission to manifest. Test: manual.

- [ ] **C3: OpenQuizzer detection** — Wire `OpenQuizzerDetector` into content script. On page load, run detection. If detected, send `OPENQUIZZER_DETECTED` message to service worker. Panel shows "OpenQuizzer page detected — Load native quiz" badge. Clicking it loads problems directly into engine (no LLM call). Add `OPENQUIZZER_DETECTED` and `LOAD_OPENQUIZZER` to message protocol. Test: create a fixture HTML file with OpenQuizzer structure, verify detector parses it.

- [x] **C4: PDF text extraction** — Add `pdf.js` (`pdfjs-dist`) as a dependency. Create `src/content/PdfExtractor.ts` that detects when the current page is a PDF (check URL ending in `.pdf` or `content-type`), extracts text from all pages using `pdf.js`, and returns it as `ExtractedContent`. Chrome's built-in PDF viewer doesn't expose the DOM, so the content script needs to fetch the PDF URL directly and parse it. Integrate into content script alongside Readability: try PDF extraction first if URL looks like a PDF, fall back to Readability. Test: unit test with a small fixture PDF if feasible, otherwise manual.

### Long-Form Content & Segmented Reading

For long content (books, papers, lengthy documentation), PageQuizzer should segment the material into manageable sections and track progress through the whole document.

- [ ] **L1: Content segmentation** — When extracted content exceeds a threshold (e.g., 3000 words), automatically split it into sections at heading boundaries (`<h1>`, `<h2>`, `<h3>`) or paragraph clusters. Present the user with a section picker: "This page has 8 sections (~1200 words each). Quiz which section?" with a "Quiz all" option. Store the section breakdown in the service worker. Each "Generate Quiz" produces questions for one section. New message types: `CONTENT_SECTIONS` (background → panel, lists sections with titles and word counts), `GENERATE_SECTION_QUIZ` (panel → background, with section index). Test: chunking logic as a pure function — split sample HTML with headings, verify section boundaries.

- [ ] **L2: Document progress tracking** — Track which sections of a document the user has quizzed and their scores. Store in `chrome.storage.local` keyed by URL: `{ [url]: { title, sections: [{ title, wordCount, quizzed: boolean, score?: Score, lastQuizzed?: number }] } }`. Create `src/background/ProgressManager.ts` for CRUD operations. Panel shows a progress bar per document: "3/8 sections completed, 78% average". Test: unit test ProgressManager with mock data.

- [ ] **L3: PDF page-range sections** — Extend C4 for long PDFs. Instead of heading-based splitting, split by page ranges (e.g., pages 1-10, 11-20). User picks a page range to quiz. Combine with L2 for progress tracking. The section picker shows "Pages 1-10 (~800 words)" entries. Depends on C4 and L1.

- [ ] **L4: "Continue where I left off"** — When the user returns to a previously-segmented document, the panel shows their progress and highlights the next unquizzed section. "Continue" button auto-generates quiz for the next section. Uses L2 progress data. If the URL matches a tracked document, show progress view instead of the default idle view. Depends on L2.

- [ ] **L5: Document library view** — New panel view (add "Library" tab alongside Quiz/History/Settings). Shows all tracked documents with progress bars, sorted by last activity. Click to jump to that URL and resume. Data comes from L2's ProgressManager. Test: manual.

### Quiz Experience

- [x] **Q1: Question type — true/false** — Add `true-false` question type. A `Problem` with exactly 2 options: "True" and "False". Update quiz generation prompt to sometimes produce true/false questions. Panel renders them as two large buttons instead of four small ones. Engine already handles 2-option problems correctly (no engine changes needed). Test: engine grading with 2-option problem.

- [x] **Q2: Answer explanation improvements** — When showing answer result, if the LLM provided an explanation, render it in a styled callout box. Add a "Why?" button that only appears if explanation exists. Small CSS addition + panel logic. Test: manual.

- [x] **Q3: Question review at end of quiz** — After quiz completion, show a "Review Missed" button on the score view. Clicking it shows a scrollable list of incorrectly-answered questions with the correct answer highlighted. Data is already in `SessionSummary.answers` — just need to display it. Service worker needs to hold the problems array and return it via a `GET_REVIEW` message. Test: manual.

- [x] **Q4: Retry missed questions only** — On the score view, add "Retry Missed" button alongside the existing "Retry" button. Sends a new message `RETRY_MISSED` to service worker, which calls `engine.loadProblems()` with only the problems the user got wrong, then `engine.start()`. Test: engine — load 3 problems, answer 1 wrong, retry missed gives 1 problem.

- [ ] **Q5: Timer mode** — Optional countdown timer per question (configurable: 15/30/60 seconds, or off). Timer runs in the panel (not engine — engine stays timer-agnostic). When timer expires, auto-skip. Add timer setting to settings view and `chrome.storage.sync`. Show countdown bar in quiz view. Test: manual.

- [ ] **Q6: Stronger distractor prompt** — Tighten quiz-generation instructions so wrong answers must be plausible, same category/register/length as the correct answer, and reflect meaningful misconceptions instead of obviously silly distractors. Test: manual comparison on a known page.

- [ ] **Q7: Question quality filter** — Add a lightweight post-generation pass that rejects or regenerates questions with weak distractors, trivial fact recall, or obvious answer-pattern giveaways. Test: pure heuristics where feasible, manual review on sample pages.

- [ ] **Q8: Answer choice typography polish** — Clean up the answer choice layout so the numbered key badge does not skew line spacing or vertical rhythm for wrapped options. Likely needs CSS/layout refinement in `panel.css` and possibly slightly different markup in `panel.ts`. Test: manual on long wrapped options.

### Data & History

- [x] **D1: Export history as JSON** — Add "Export" button to history view. Calls `GET_SESSIONS`, creates a Blob, triggers download via `URL.createObjectURL`. File named `pagequizzer-history-YYYY-MM-DD.json`. Test: manual.

- [x] **D2: Import history from JSON** — Add "Import" button + hidden file input to history view. Parse uploaded JSON, validate it's an array of `SessionRecord` objects (check required fields), merge with existing sessions (deduplicate by `id`). Save to storage. Test: export → import round-trip preserves data.

- [x] **D3: Topic categorization** — `src/prompts/topic-categorization.ts` already has the prompt. Add `categorizeTopics()` method to `BaseProvider` (default implementation: parse JSON response). Call it in `QuizGenerator` in parallel with quiz generation (use `Promise.all`). Store topics in `SessionRecord.topics` (field already exists). Add topic filter chips to history view. Test: prompt template produces valid JSON shape.

- [ ] **D4: Per-question performance tracking** — Track how many times each question (by content hash) has been seen and answered correctly. Store in `chrome.storage.local` as a map: `{ [hash]: { seen: number, correct: number } }`. Update after each answer. No UI yet — this is the data layer for future spaced repetition. Test: unit test the tracking logic as a pure function.

- [x] **D5: Per-tab quiz sessions** — Keep independent in-progress quizzes per browser tab or page, so switching tabs restores that tab’s quiz instead of replacing a single global session. Generating a quiz on a new tab should create a new session only for that tab. Requires tab-scoped persistence, panel restore routing, and a clear policy for tab close/navigation. Test: manual across multiple tabs plus pure session-routing helpers.

### Settings & Polish

- [x] **S1: Model selection dropdown** — Settings view shows available models per provider (hardcoded list per provider class — add a `models` getter to `BaseProvider`). When provider changes, model dropdown updates. Selected model saved to storage. Test: provider model lists are non-empty arrays.

- [x] **S2: Keyboard shortcut help** — Show a small "?" icon in quiz view header. Clicking it shows/hides a tooltip: "1-4: select answer, Enter: next question, S: skip". Pure panel HTML/CSS, no messages needed.

- [x] **S3: Quiz progress indicator in extension icon** — Use `chrome.action.setBadgeText` to show current question number (e.g., "3/10") while a quiz is active. Clear badge on complete or idle. Add to service worker's engine event handlers. Requires no new permissions.

- [ ] **S4: Error recovery for failed generation** — If quiz generation fails mid-chunk (e.g., API rate limit), keep the questions generated so far and offer "Start with N questions" instead of showing an error. Only show error if zero questions were generated. Modify `QuizGenerator` and service worker error handling.

## Future — Needs Design

These need architectural decisions before implementation. Flag for staff review.

- [ ] **Spaced repetition** — Requires D4 first. Algorithm choice (SM-2? Leitner?), UI for "practice weak areas" mode, integration with engine `start()` to accept problem ordering hints.
- [ ] **Free-text questions** — LLM-graded open-ended responses. Needs new question type in engine, new grading flow (async LLM call during quiz), prompt design for grading rubric.
- [ ] **Extract QuizzerCore** — Pull `src/engine/` into `quizzer-core` repo as npm package. Requires: API surface freeze, package.json setup, CI/CD, OpenQuizzer migration path, versioning strategy.
- [ ] **Firefox/Safari ports** — Manifest V3 differences, polyfill strategy for `chrome.sidePanel` (Firefox doesn't have it — use sidebar?).

## Exploring

- [ ] Collaborative quizzes — share generated quizzes via link
- [ ] Question quality feedback — "report bad question" button

## Won't Do (Out of Scope)

- User accounts or server-side storage — stays local-first
- Paid features or premium tiers — MIT licensed, fully open source
- Custom LLM hosting — use Ollama provider for self-hosted models

---

_Each completed task gets a CHANGELOG entry and moves out of this file. Update ROADMAP.md at the end of every session._

# Changelog

## v0.1.11 — Extension Badge Progress (2026-03-08)

### Settings & Polish
- Added a quiz progress badge on the extension action icon while a quiz is active
- The badge shows the current question number and total, and clears automatically when the engine returns to `idle` or reaches `complete`
- Restored quiz sessions now resync the badge on service worker startup so progress survives worker restarts cleanly

### Testing
- 55 tests (was 53): added pure helper coverage for badge text formatting and clear/show state rules

## v0.1.10 — Keyboard Shortcut Help (2026-03-08)

### Settings & Polish
- Added a `?` shortcut help toggle in the quiz question view
- Made the tooltip text match the current question shape, so true/false questions show `1-2` while four-option questions show `1-4`
- Aligned the actual keyboard behavior with the tooltip by wiring `S` to the existing skip action and scoping shortcuts to visible quiz controls only

### Testing
- 53 tests (was 49): added pure helper coverage for tooltip text, option-key mapping, and interactive-focus guards

### Security Review
- Periodic review found no new network, permission, or storage surface in this milestone
- `npm audit --omit=dev` reported 0 vulnerabilities

## v0.1.9 — History Import (2026-03-08)

### Data & History
- Added an `Import History` action with a hidden JSON file input in the history view
- Imported history is parsed in the panel but validated and merged in the background before writing to storage
- Merged imported records with existing history by `id`, preserving chronological order and deduplicating repeated sessions

### Security Review
- Treated imported history as untrusted local input and validated every required `SessionRecord` field before storage writes
- Kept import local-only: no network calls, no HTML rendering from imported JSON, and history titles remain escaped on render

### Testing
- 49 tests (was 46): added import validation, merge behavior, and export/import round-trip coverage

## v0.1.8 — History Export (2026-03-08)

### Data & History
- Added an `Export History` action to the history view that downloads all saved sessions as JSON
- Export files are named `pagequizzer-history-YYYY-MM-DD.json`
- Reused the existing `GET_SESSIONS` message flow instead of adding new background/export plumbing

### Testing
- 46 tests (was 44): added helper coverage for export filename generation and JSON serialization

## v0.1.7 — True/False Questions (2026-03-08)

### Quiz Experience
- Added true/false question support, with two large option buttons in the quiz panel when a problem has exactly two choices
- Kept the engine unchanged while confirming grading works correctly for 2-option problems

### Prompt & Provider Contract
- Updated the quiz generation prompt and tool schema to allow either 4-option multiple-choice questions or 2-option true/false questions
- Standardized provider parsing through a shared helper so both Anthropic and OpenAI accept 4-option questions and normalize valid `["True", "False"]` outputs
- Rejected invalid 2-option outputs that are not true/false, instead of silently treating arbitrary binary choices as supported question types

### Testing
- 44 tests (was 40): added engine coverage for 2-option grading and provider parsing coverage for valid/invalid true-false outputs

## v0.1.6 — Answer Explanation Toggle (2026-03-08)

### Quiz Experience
- Added a `Why?` button to answer feedback that only appears when an explanation exists
- Moved answer explanations into a styled callout box so the feedback state stays compact until the user chooses to expand it
- Reset explanation visibility cleanly when moving between questions, score view, review view, and error state

### Testing
- Existing 40-test suite and production build passed after the panel update
- No new automated tests were added because this milestone is panel-only and the repo does not yet have DOM/UI test coverage

## v0.1.5 — PDF Text Extraction (2026-03-08)

### Content Extraction
- Added `pdfjs-dist` and a dedicated `PdfExtractor` that detects direct PDF URLs, viewer-style `file=` URLs, and `application/pdf` content types
- Integrated PDF-first extraction into the content script, with Readability as the fallback for normal HTML pages
- Extracted text from every PDF page via `pdf.js`, normalized it into quizable plain text, and derived titles from PDF metadata or filenames

### Build & Extension Packaging
- Bundled `pdf.worker.mjs` into `dist/pdf.worker.js` and exposed it via `web_accessible_resources` so the content script can run the worker under extension CSP
- Disabled `isEvalSupported` in PDF parsing options and verified `pdfjs-dist` has no install scripts

### Testing
- 40 tests (was 35): added helper coverage for PDF URL detection, viewer URL resolution, title derivation, and text normalization

### Security Review
- Added `pdfjs-dist@5.5.207`
- `npm audit --omit=dev` reported 0 runtime vulnerabilities after install

## v0.1.4 — Review Missed Questions (2026-03-08)

### Quiz Experience
- Added a `Review Missed` action on the score view that opens a scrollable review screen for incorrectly answered questions
- Highlighted the correct option in green and the selected incorrect option in red, with explanations shown when available
- Disabled `Review Missed` when a quiz has zero incorrect answers and show the incorrect-count in the button label

### Background Logic
- Added `GET_REVIEW` and `REVIEW_DATA` to the message protocol so the panel receives a render-ready review payload instead of reaching into engine state
- Added a pure review builder in `src/background/review-missed.ts` to transform completed quiz data into panel-friendly review items
- Persisted the last completed quiz context in `chrome.storage.local` so review and retry-missed survive service worker restarts after quiz completion

### Testing
- 35 tests (was 33): added review-item coverage for incorrect-answer filtering, correct/selected markers, and defensive copies

## v0.1.3 — Retry Missed Questions (2026-03-08)

### Quiz Experience
- Added a `Retry Missed` action to the score view so users can restart with only incorrectly answered questions
- Disabled `Retry Missed` when a quiz has zero incorrect answers and show the incorrect-count in the button label
- Added `RETRY_MISSED` to the message protocol and wired the service worker to reload only missed problems before restarting the engine

### Background Logic
- Added a pure retry-selection helper in `src/background/retry-missed.ts` to keep missed-question filtering testable and separate from Chrome message handling
- Restored the in-memory retry problem set from the serialized engine snapshot after service worker restart, so mid-quiz worker restarts do not break the follow-up retry flow

### Testing
- 33 tests (was 31): added retry-missed coverage using engine-generated answers and defensive-copy assertions

## v0.1.2 — OpenAI Provider (2026-03-08)

### Providers
- Added `OpenAIProvider` using the Chat Completions API with JSON mode (`response_format: { type: "json_object" }`)
- Registered `openai` in the provider factory with default model `gpt-4o-mini`
- Added OpenAI to the settings provider dropdown in the side panel

### Security
- Added explicit `host_permissions` for `https://api.anthropic.com/*` and `https://api.openai.com/*` so provider requests are limited to intended API origins

### Testing
- 31 tests (was 29): added provider registry coverage for OpenAI defaults and custom model overrides

### Type Safety
- Removed the remaining `as any` cast from the provider registry test

## v0.1.1 — Readability + Persistence (2026-03-07)

### Content Extraction
- Integrated `@mozilla/readability` as proper npm dependency, bundled by esbuild into content script
- Removed manual vendoring plan (`src/lib/` directory) — esbuild handles bundling

### Service Worker Persistence
- Engine state persisted to `chrome.storage.local` on every state transition
- Restored automatically when service worker restarts mid-quiz
- `QuizEngine.serialize()` / `restore()` methods for snapshot/restore lifecycle
- Panel requests current state on open via `GET_STATE` message
- Persisted state cleared on quiz completion

### Bug Fixes
- Fixed: incorrect answer options were not highlighted red (panel now tracks selected option index)
- Fixed: message types `GET_SETTINGS`, `SAVE_SETTINGS`, `TEST_CONNECTION`, `GET_SESSIONS` were missing from the `Message` union, requiring `as any` casts in the service worker
- Removed dead `currentProblems` variable from panel
- Removed premature `DETECT_OPENQUIZZER` message handler with `as any` cast from content script

### Testing
- 29 tests (was 26): added serialize, restore, and defensive copy tests

### Process
- Added self-review loop to AGENTS.md (adapted from OpenQuizzer)
- Expanded AGENTS.md with project overview, readability guidelines, lessons learned

## v0.1.0 — Initial scaffold (2026-03-07)

### Quiz Engine (shared core)
- State machine: `idle → practicing → answered → complete`
- Event system: `on(event, fn)`, `off(event, fn)`
- Multiple-choice grading with score tracking
- Shuffle problems and options
- Defensive copies, private fields, state guards
- Standalone ES module build (`dist/engine/quizzer-core.js`)

### Content Extraction
- ReadabilityExtractor: clones DOM, extracts title/content/wordCount/excerpt
- Fallback to `document.body.innerText` when Readability fails
- OpenQuizzerDetector: DOM detection and problem parsing (stub)

### LLM Provider Abstraction
- BaseProvider abstract class: `generateQuiz()`, `testConnection()`
- AnthropicProvider: Claude Haiku via Messages API with structured tool use
- Provider registry/factory pattern

### Quiz Generation
- Prompt module with system/user templates and density parameter
- JSON tool schema for structured output
- QuizGenerator: paragraph-boundary chunking (~800 words), per-chunk generation

### Chrome Extension
- Manifest V3 with side panel, activeTab, storage permissions
- Service worker: message routing, engine event bridging, session storage
- Content script: extraction on demand via message passing
- StorageManager: API keys (local), settings (sync), session history

### Side Panel UI
- Quiz view: generate, start, answer, score flow
- Settings view: provider, API key, density slider, connection test
- History view: past sessions with score and date
- Keyboard shortcuts: 1-4 for options, Enter for next
- Dark/light mode via `prefers-color-scheme`

### Testing
- 26 tests: engine state machine, prompt templates, provider registry
- Vitest with TypeScript support
- Factory functions and collectEvents pattern

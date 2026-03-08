# Changelog

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

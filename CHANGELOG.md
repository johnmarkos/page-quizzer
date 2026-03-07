# Changelog

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

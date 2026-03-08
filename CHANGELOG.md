# Changelog

## v0.1.46 — PDF Page-Range Sections (2026-03-08)

### Long-Form PDFs
- Extended long-content sectioning so PDFs now use page ranges instead of generic heading/fallback chunks
- Preserved per-page extracted text from both background and content-script PDF extraction paths, then grouped pages into contiguous quizable ranges with labels like `Pages 1-5`
- When generating a quiz from a selected PDF range, kept only that range’s page texts in the extracted-content payload so follow-up segmentation/generation stays scoped correctly

### Review Loop
- The first review focus on this milestone was nested-data safety: adding `pageTexts` to extracted PDF content meant the old shallow copies of `lastExtracted` would have leaked mutable array references through restore/persistence. Fixed by adding explicit extracted-content cloning in the service worker and tab-session helpers.

### Security Review
- No new permissions or network destinations were added
- `npm audit --omit=dev` reported 0 vulnerabilities

### Testing
- 134 tests (was 133): added PDF page-range section coverage and explicit defensive-copy coverage for extracted PDF page text arrays

## v0.1.45 — Long-Content Section Picker (2026-03-08)

### Long-Form Content
- Added long-content segmentation with a section picker for extracted sources over 3000 words
- Preferred real HTML headings when available, but fell back to paragraph clustering and fixed-size arbitrary chunks when the source had no usable structure or sections were still too large
- Added `Quiz All` plus per-section generation so long pages and documents no longer have to become one giant quiz by default

### State & UI
- Persisted pending section-picker state per tab so the picker survives service-worker restarts and tab switches like the existing ready/completed quiz states
- Added a dismiss action that clears the pending section state instead of leaving the picker sticky on restore

### Review Loop
- The first reviewer pass found a real UX/state gap: once the section picker appeared, there was no correct way to dismiss it because the background would keep restoring it. Fixed by adding an explicit `DISMISS_SECTIONS` message and clearing the persisted pending section state.

### Security Review
- No new permissions or network destinations were added
- `npm audit --omit=dev` reported 0 vulnerabilities

### Testing
- 133 tests (was 130): added sectioning helper coverage for heading-based splits, arbitrary fallback chunking, and section-specific extracted content construction

## v0.1.44 — Highlight-to-Quiz (2026-03-08)

### Content & Extraction
- Added a `Quiz this selection` context-menu action that generates a quiz from the user’s highlighted text instead of the whole page
- Added a typed content-script selection message and background selection-content builder so highlighted text flows through the same `ExtractedContent`/generation pipeline as other content sources
- Opened the side panel on context-menu generation when possible and updated the panel to react to externally-triggered loading, generated, and error states

### Review Loop
- The first reviewer pass found a real edge case: `window.getSelection()` can be empty or drift from what Chrome reports to the context-menu event. Fixed by falling back to `info.selectionText` before rejecting the action as “no selection.”

### Security Review
- Added only the `contextMenus` permission; no new network destinations were introduced
- Reused the existing content-script attach/host-permission path instead of adding a separate injection or page-data channel
- `npm audit --omit=dev` reported 0 vulnerabilities

### Testing
- 130 tests (was 127): added selection-content helper coverage for normalization, `ExtractedContent` construction, and context-menu fallback selection resolution

## v0.1.43 — Ollama Provider (2026-03-08)

### Providers
- Added an `OllamaProvider` that uses `/api/generate` for structured quiz/topic generation and `/api/tags` for connection testing
- Added Ollama to the provider registry and model picker, with `llama3.2` as the default model
- Added normalized Ollama base-URL handling so `http://localhost:11434` and `.../api` variants resolve consistently

### Settings & Permissions
- Added a Base URL field in Settings that appears for Ollama instead of the API key field
- Added provider-specific settings helpers so API-key vs base-URL behavior stays inside `src/providers/`
- Added localhost host permission plus panel-side provider-origin permission preflight for custom Ollama hosts before test/generate actions

### Review Loop
- The first reviewer pass found a real mismatch: generation-time Ollama permission preflight initially read the current form state, while quiz generation itself uses saved background settings. Fixed by checking saved settings before `Generate Quiz`, and kept `Test Connection` on current unsaved form values.

### Security Review
- Kept API keys in `chrome.storage.local` only; Ollama base URLs stay in sync settings and logs include provider/model/base URL only, never credentials
- Scoped new network access to the configured Ollama origin and verified `npm audit --omit=dev` reports 0 vulnerabilities

### Testing
- 127 tests (was 117): added Ollama provider coverage for defaults/URL construction, provider-settings normalization tests, and connection-settings coverage for base-URL overrides

## v0.1.42 — Paste-Your-Own-Text Mode (2026-03-08)

### Content & Extraction
- Added a toggle in the idle quiz view to switch between current-page extraction and pasted-text quiz generation
- Added manual title/text inputs and sent prebuilt `ExtractedContent` through `GENERATE_QUIZ` so the background can generate a quiz without using the content script
- Kept the normal extraction path unchanged when manual mode is off

### Review Loop
- The first reviewer pass flagged that the new manual mode only had helper coverage for building `ExtractedContent`, not for the actual inline-content request path. Fixed by moving manual request construction into a pure helper and adding direct tests for payload creation and empty-text rejection.

### Testing
- 117 tests (was 112): added manual-content coverage for extracted-content building, inline request payload construction, and empty-input validation

## v0.1.41 — Export Quiz as Local Web Page (2026-03-08)

### Data & Sharing
- Added `Export Quiz` actions to the ready and score views so the current quiz can be saved as a standalone local HTML file
- Exported quizzes now open without the extension and include a minimal self-contained quiz runner with question navigation, answer feedback, and a final score view
- Added a background export message so the panel can request the current tab’s quiz data without becoming the source of truth for quiz content

### Review Loop
- The first reviewer pass found that the exported source URL was only HTML-escaped, not scheme-sanitized. Fixed by allowing clickable links only for `http`, `https`, and `file` URLs; unsafe schemes are rendered as plain text.

### Testing
- 112 tests (was 107): added pure export-helper coverage for filename generation, HTML content, embedded JSON script safety, and unsafe source URL handling

## v0.1.40 — Timer Mode (2026-03-08)

### Quiz Experience
- Added an optional per-question timer in the panel with `Off`, `15`, `30`, and `60` second settings
- Displayed a countdown label and timer bar in the quiz view, and auto-skipped the current question when the timer reached zero
- Kept the timer entirely panel-side so the shared quiz engine remains timer-agnostic

### Settings
- Added `timerSeconds` to synced settings and loaded it before quiz restore/start so saved timer mode applies even if the user never opens the Settings tab during that session

### Review Loop
- The first reviewer pass found a real bug: the initial implementation would have left timer mode disabled until Settings had been loaded. Fixed by gating restore/start flows on the initial settings load promise.

### Testing
- 107 tests (was 104): added helper coverage for timer setting normalization, countdown formatting, and progress calculation

## v0.1.39 — Startup Restore Gate (2026-03-08)

### Reliability
- Fixed a service-worker startup race where runtime messages and tab-activation routing could run before persisted quiz state had finished restoring
- Ensured message handling waits for the initial restore pass before operating on tab-scoped quiz state or per-question performance data

### Review Loop
- This fix came from a harsher post-implementation review pass after adding per-question performance tracking; the review caught that restore timing could otherwise overwrite fresh in-memory state on a just-started worker

## v0.1.38 — Per-Question Performance Tracking (2026-03-08)

### Data Layer
- Added per-question performance tracking keyed by a deterministic content hash so repeated exposure to the same question can be counted across sessions
- Stored `seen` and `correct` counts in `chrome.storage.local` after each answered question, without depending on provider-specific IDs or current option order
- Made the hash resilient to shuffled choices by normalizing question text and sorting option text with correctness markers before hashing

### Testing
- 104 tests (was 100): added focused coverage for shuffle-stable question hashes, immutable counter updates, and separate tracking for distinct questions

## v0.1.37 — Partial Quiz Recovery (2026-03-08)

### Reliability
- Recovered partial quiz generation when a later chunk fails after some usable questions have already been produced
- Returned the accepted questions to the ready state instead of failing the whole run, and surfaced a warning so the user can still start with the partial quiz
- Kept the hard-error path only for cases where zero usable questions were generated

### Panel & State
- Added ready-state warning support in the message contract and tab-session persistence so partial-generation recovery survives service-worker restarts
- Updated the ready screen to show a warning and switch the CTA to `Start with N Questions` when generation stopped early

### Testing
- 100 tests (was 98): added chunk-failure generator coverage for both partial-success and zero-question hard-error cases

## v0.1.36 — Question Quality Filter (2026-03-08)

### Quiz Quality
- Added a lightweight post-generation quality filter that removes obviously weak multiple-choice questions before they reach the quiz engine
- Rejected clear giveaway patterns such as duplicate options, `all/none of the above` answers, correct-answer length outliers, and cases where only one option is formatted like a full sentence
- Added a small generation buffer so the provider can return a few extra questions per chunk and the final quiz is less likely to undershoot after filtering

### Architecture
- Kept the filter as a pure helper in the background generator layer instead of pushing provider-specific heuristics into `src/providers/`

### Testing
- 98 tests (was 89): added focused heuristic coverage plus generator tests that verify low-quality questions are dropped and buffered generation is requested

## v0.1.35 — Stronger Distractor Prompt (2026-03-08)

### Quiz Quality
- Tightened the quiz-generation system prompt so wrong answers must be realistic misunderstandings instead of obviously weak distractors
- Added explicit instructions that 4-option answers should stay parallel in category, specificity, tone, and length so the correct answer does not stand out by style alone
- Shifted the prompt toward conceptual understanding, comparison, cause/effect, and application questions over trivial fact recall

### Testing
- 89 tests (was 87): expanded prompt coverage for the new distractor-quality instructions and bumped the quiz-generation prompt version to `1.2`

## v0.1.34 — Answer Choice Typography Polish (2026-03-08)

### Quiz Experience
- Refined answer-choice markup so the number badge and answer text live in separate layout elements instead of one inline text flow
- Fixed wrapped answer choices where the number badge skewed line spacing and vertical rhythm
- Kept true/false buttons centered with the same new structure so the typography fix does not regress the two-option layout

### Review
- Re-checked dynamic answer rendering for XSS safety: option text still goes through `escapeHtml()` before being inserted into panel markup

## v0.1.33 — Per-Tab Quiz Sessions (2026-03-08)

### Quiz State
- Scoped in-progress and completed quiz state to the active browser tab instead of keeping one global background session
- Restored the correct tab’s `idle`/`ready`/`question`/`complete` state through `GET_STATE`, so switching tabs brings back that tab’s quiz view instead of overwriting it
- Cleared tab-scoped quiz sessions when a tab closes or navigates to a new URL

### Panel & Background
- Added a tab-session helper module for defensive cloning and storage updates
- Updated the side panel to resync quiz state on tab activation and active-tab navigation, not just on panel open
- Avoided storing empty tab-session records so idle tabs do not accumulate dead state in `chrome.storage.local`

### Testing
- 87 tests (was 84): added focused coverage for tab-session storage helpers and the new restored `ready` state shape

## v0.1.32 — Topic Categorization (2026-03-08)

### Data & History
- Added topic categorization across Anthropic, OpenAI, and Gemini providers using the existing topic prompt and provider-specific JSON responses
- Generated topic tags in parallel with quiz creation and stored them on session history records
- Added topic chips to history entries plus topic filter buttons in the history view

### Reliability
- Persisted the in-progress topic list alongside the engine snapshot so service-worker restarts do not drop topic metadata before quiz completion
- Kept topic categorization best-effort: quiz generation still succeeds if topic tagging fails, with a narrow warning log for debugging

### Testing
- 84 tests (was 76): added coverage for topic prompt/schema behavior, history topic filtering helpers, imported session topics, and the non-fatal topic-generation fallback path

## v0.1.31 — Expanded OpenAI Model Picker (2026-03-08)

### Settings & Providers
- Added `gpt-5-mini` and `gpt-4.1-nano` to the OpenAI model picker so lower-cost OpenAI options are available directly in Settings
- Updated the OpenAI default model choice in the shared provider-model registry to `gpt-5-mini`

### Testing
- Existing 76-test suite and production build passed after expanding the OpenAI model list

## v0.1.30 — Model Selection Dropdown (2026-03-08)

### Settings & Providers
- Added a model dropdown to Settings that updates when the provider changes and saves the selected model alongside the provider and API key
- Added explicit per-provider model lists in `src/providers/` and exposed them through the provider abstraction
- Normalized stored model selections against the current provider so stale or invalid saved model names fall back to a valid default

### Testing
- 76 tests (was 74): added provider-model coverage for non-empty model lists and model normalization behavior

## v0.1.29 — Background PDF Worker Bootstrap (2026-03-08)

### Bug Fixes
- Preloaded `pdfjs`'s `WorkerMessageHandler` in the service worker so background PDF extraction no longer depends on `GlobalWorkerOptions.workerSrc`
- Fixed the next failure in the service-worker PDF path after removing the background runtime `import()`

### Testing
- Existing 74-test suite and production build passed after the background worker bootstrap update

## v0.1.28 — Service Worker PDF Import Fix (2026-03-08)

### Bug Fixes
- Removed the runtime `import()` call from the background PDF extractor, which Chrome disallows inside `ServiceWorkerGlobalScope`
- Switched the service worker to a static bundled `pdfjs` import so PDF extraction works in the MV3 background context again

### Testing
- Existing 74-test suite and production build passed after the background PDF loader change

## v0.1.27 — Start Quiz State Sync (2026-03-08)

### Bug Fixes
- Made `Start Quiz`, `Retry`, and `Retry Missed` explicitly resync quiz state from the service worker after sending their action message instead of relying only on an async background broadcast
- Fixed cases where the panel could stay stuck on the ready/score screen even though the engine had already entered `practicing`

### Testing
- 74 tests (was 71): added panel helper coverage for extracting the active question from restored service-worker state

## v0.1.26 — Real File-Scheme Access Check (2026-03-08)

### Bug Fixes
- Replaced the unconditional local `file://` PDF block with a real Chrome file-scheme access check using `chrome.extension.isAllowedFileSchemeAccess()`
- Allowed local PDF extraction to proceed when the user has already enabled `Allow access to file URLs`, instead of always surfacing the setup message
- Added a more specific fallback error for local PDFs that still cannot be read after file access is enabled

### Security Review
- Added explicit `file:///*` host coverage so local-PDF access is declared in the manifest, while keeping actual file access gated by Chrome’s per-extension `Allow access to file URLs` toggle

### Testing
- 71 tests (was 68): added focused coverage for the file-scheme access callback helper and the new local-PDF read error path

## v0.1.25 — Local PDF Guidance (2026-03-08)

### Bug Fixes
- Added a clear error for local `file://` PDFs that explains the required Chrome setting: enable `Allow access to file URLs` for PageQuizzer, then reload the extension and reopen the PDF
- Avoided falling through to Chrome’s low-level `Not allowed to load local resource` failure when the underlying PDF source is a local file

### Testing
- 68 tests (was 66): added focused coverage for local PDF source detection and the actionable file-access error

## v0.1.24 — Chrome PDF Viewer Bypass (2026-03-08)

### Bug Fixes
- Added a viewer-aware PDF path that resolves the underlying PDF URL from Chrome’s built-in PDF viewer tab and extracts the PDF in the background instead of trying to inject into the blocked viewer page
- Updated per-site permission lookup to use the underlying PDF origin for viewer URLs, so site-access prompts target the real PDF host instead of the Chrome viewer wrapper

### Architecture
- Moved reusable PDF URL/text helpers into a shared module and added a dedicated background PDF extractor for viewer/direct-PDF tabs

### Security Review
- Kept PDF fetches scoped to the resolved PDF origin and dependent on the same per-site host access flow
- `npm audit --omit=dev` reported 0 vulnerabilities

### Testing
- 66 tests: added coverage for Chrome PDF viewer `src=` URL resolution while keeping the full suite and production build passing

## v0.1.23 — Classic-Safe Content Bundle (2026-03-08)

### Bug Fixes
- Split `pdfjs` into a separate `dist/pdfjs.js` module asset so the main injected content script can run as a classic script again
- Switched runtime attachment back to `executeScript({ files: ["dist/content.js"] })`, which restores a stable long-lived message receiver after permission is granted
- Kept PDF support by loading `dist/pdfjs.js` dynamically only when the current page is actually a PDF

### Build & Packaging
- Added `dist/pdfjs.js` to the build outputs and `web_accessible_resources`
- Built `dist/content.js` in a classic-script-safe format while leaving the PDF helper module as ESM

### Testing
- Existing 65-test suite and production build passed after the bundle split

## v0.1.22 — Active Tab URL Access for Site Prompts (2026-03-08)

### Bug Fixes
- Added the `tabs` permission so PageQuizzer can read the active tab URL and request optional host access for the correct origin before injecting the content script
- Fixed the permission-request flow on normal pages where the extension previously could not derive the site origin reliably enough to prompt Chrome for access

### Security Review
- Added `tabs` only to support active-tab URL lookup for per-site access requests; broad `<all_urls>` required host access is still avoided
- `npm audit --omit=dev` reported 0 vulnerabilities

### Testing
- Existing 65-test suite and production build passed after the permission update

## v0.1.21 — Attach Path Version Marker (2026-03-08)

### Diagnostics
- Added an `attach-v2` marker to content-script attach errors so stale extension code is easy to distinguish from current failures during manual testing

### Testing
- Existing 65-test suite and production build passed after the diagnostic update

## v0.1.20 — Programmatic Content Script Only (2026-03-08)

### Bug Fixes
- Removed the declarative `content_scripts` manifest entry for `dist/content.js`, which was still trying to load a module-oriented bundle as a classic content script
- Switched extraction to attach the content script programmatically first, then message it, so the same module-safe path is used consistently
- Resolved the remaining `import.meta` execution issue by eliminating the last classic-script load path for the content bundle

### Testing
- 65 tests (was 66): removed the obsolete missing-receiver helper test and kept the remaining content-script bridge coverage passing
- `npm run build` passed

## v0.1.19 — Module-Safe Content Script Attach (2026-03-08)

### Bug Fixes
- Replaced direct `files: ["dist/content.js"]` injection with a tiny loader that imports the content script module by extension URL
- Fixed `Cannot use 'import.meta' outside a module` during runtime attach by keeping the recovery path in module semantics

### Testing
- Existing 66-test suite and production build passed after the attach-path update

## v0.1.18 — Panel-Led Site Access Prompt (2026-03-08)

### Bug Fixes
- Moved the normal-page site-access request into the `Generate Quiz` button flow so Chrome can grant optional host permission within a direct user gesture
- Reused a shared per-origin permission helper across panel and background flows to keep runtime site-access behavior consistent

### Testing
- Existing 66-test suite and production build passed after the site-access flow update

## v0.1.17 — Runtime Site Access Request (2026-03-08)

### Bug Fixes
- Added a runtime site-access request fallback when Chrome blocks content-script injection on a normal `http` or `https` page due to missing host permission
- Quiz generation now asks Chrome for access to the current site and retries injection instead of failing immediately on pages like the Feynman Lectures

### Security Review
- Added `optional_host_permissions` for web origins and request access only for the current site at the moment it is needed
- Kept host access narrow: the extension does not receive blanket persistent access to all sites unless the user grants it site by site
- `npm audit --omit=dev` reported 0 vulnerabilities

### Testing
- 66 tests (was 64): added helper coverage for host-permission error detection and per-origin permission pattern generation

## v0.1.16 — Better Active-Tab Injection Recovery (2026-03-08)

### Bug Fixes
- Fixed false "PageQuizzer cannot access this page" errors on normal web pages when Chrome did not expose `tab.url` during content-script recovery
- The recovery path now attempts script injection on ambiguous tabs and only reports an access error if Chrome actually rejects the injection
- Improved the follow-up error text so unsupported/internal pages and unexpected injection failures are easier to distinguish

### Testing
- 64 tests (was 63): added coverage for unsupported-protocol detection and injection-failure error mapping

## v0.1.15 — Gemini Provider (2026-03-08)

### Providers
- Added `GeminiProvider` using the Gemini `generateContent` API with JSON structured output
- Registered `gemini` in the provider factory and exposed it in the settings dropdown
- Standardized the settings/test-connection message types on `ProviderName` so adding Gemini does not leave provider names as untyped strings

### Prompt & Schema
- Added a reusable JSON response schema for quiz generation so Gemini can request structured JSON directly and still share the existing question normalization path
- Implemented Gemini with `gemini-2.5-flash` as the default model because Google's current official docs mark `gemini-2.0-flash` deprecated

### Security Review
- Added explicit host permission for `https://generativelanguage.googleapis.com/*`
- No new dependencies were added, and `npm audit --omit=dev` reported 0 vulnerabilities

### Testing
- 63 tests (was 60): added provider registry coverage for Gemini defaults/custom models and prompt-schema coverage for the structured output schema

## v0.1.14 — Content Script Auto-Recovery (2026-03-08)

### Bug Fixes
- Fixed quiz generation on already-open tabs after extension reload by reinjecting the content script when Chrome reports that no receiver exists
- Added a guard in the content script so repeated programmatic injection does not register duplicate message listeners
- Added a clearer error for unsupported pages where PageQuizzer cannot inject extraction code

### Testing
- 60 tests (was 58): added helper coverage for missing-receiver detection and supported injection targets

### Security Review
- Added the `scripting` permission only to recover content-script attachment on the active tab during quiz generation
- Programmatic injection is restricted to normal page protocols (`http`, `https`, `file`) and still uses the extension’s existing bundled content script
- `npm audit --omit=dev` reported 0 vulnerabilities

## v0.1.13 — Connection Test Diagnostics (2026-03-08)

### Bug Fixes
- Changed provider connection tests to return real API failure details instead of a generic `Failed` status
- Added service-worker logging for connection test failures with provider and model context

### Testing
- Existing 58-test suite and production build passed after the diagnostics update

### Security Review
- Message-handling review stayed within the existing provider API surfaces
- `npm audit --omit=dev` reported 0 vulnerabilities

## v0.1.12 — Connection Test Uses Current Form Values (2026-03-08)

### Bug Fixes
- Fixed `Test Connection` so it validates the provider and API key currently entered in the settings form, even before the user clicks `Save Settings`
- Prevented provider switches during connection testing from reusing a stale model name from a different provider

### Testing
- 58 tests (was 55): added coverage for stored-vs-form connection settings resolution

### Security Review
- Message-handling review found no new outbound destinations or storage exposure changes
- `npm audit --omit=dev` reported 0 vulnerabilities

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

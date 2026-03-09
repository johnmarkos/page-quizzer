# Handoff

## Update — S5 Per-Provider API Keys

- Added provider-specific API key storage via `apiKey_<provider>` keys.
- Updated `StorageManager` to read/write provider-specific keys and migrate the old global `apiKey` slot.
- Updated the panel provider-switch flow to reload the selected provider's saved key immediately.
- Added `StorageManager` tests for per-provider storage, migration, intentionally cleared keys, and Ollama's no-key behavior.
- Verification: `npm test`, `npm run build`.

## Staff Review (2026-03-07)

Opus 4.6 reviewed the full codebase (~13,600 lines, 60 commits by GPT-5.4). Six blocking issues were found and fixed in commit `ca75ba3`:

1. `AnthropicProvider.ts` — `(b: any)` and untyped `response.json()` → added `AnthropicContentBlock` / `AnthropicMessagesResponse` types
2. `OpenQuizzerDetector.ts` — `(p: any)` on untrusted page JSON → added `RawOpenQuizzerProblem` type + runtime shape validation
3. `QuizEngine.ts` — `Listener<any>` in event map → `Listener<never>` with safe cast in `#emit`
4. `StorageManager.ts` — `Record<string, any>` → `Record<string, string | number>` / `Record<string, string>`
5. `manifest.json` — missing CSP → added `script-src 'self'; object-src 'self'`
6. `messages.ts` — `{ type: 'ok' }` not in Message union → added `OkMessage`

### Advisory issues (non-blocking, pick up next session)
- `manifest.json` `icons` is `{}` — add real icons or remove the key
- Several providers duplicate JSON-parse-and-throw error handling — could extract a shared `fetchProviderJson()` helper
- `OpenQuizzerDetector` is wired into content script but the feature is embryonic — consider gating or finishing it
- CHANGELOG.md should get a v0.1.1 entry covering the staff review fixes

## Completed

- Completed `L5` by adding a `Library` tab backed by tracked document progress rather than quiz history
- Added document-library summaries with completed section counts, average score, next-section metadata, and last-activity sorting
- Added a `GET_DOCUMENT_PROGRESS` / `DOCUMENT_PROGRESS` message path so the panel can request tracked-document summaries directly from `ProgressManager`
- Opening a document from the library now navigates the active tab to that URL and switches back to the Quiz view, where the existing resume logic restores the document-progress card
- Completed `L4` by adding a resumable long-form idle state for previously tracked documents
- Added a `document-progress` restored-state branch plus an idle resume card that shows completed sections, average score, and the next unquizzed section
- Added a `CONTINUE_DOCUMENT` background action that re-extracts the current page/PDF and auto-generates a quiz for the next unquizzed section
- Mapped resume lookups for Chrome PDF viewer tabs back to the underlying PDF URL so saved PDF progress can be resumed correctly
- If all sections are already completed, `Continue` now falls back to the section picker rather than making up a new target
- Fixed a PDF/section-picker crash where progress-aware section merges were dropping `preview` and page-range fields from `ContentSection`
- Kept `DocumentProgressRecord` storage minimal, but changed the live merge path to preserve full section display data and only strip back to storage fields when persisting
- Added regression coverage that merged section progress keeps `preview`, `startPage`, and `endPage`
- Fixed a provider-response crash where malformed quiz JSON could trigger `Cannot read properties of undefined (reading 'length')` in quiz parsing
- Hardened `parseQuizQuestions()` with a runtime shape guard so invalid questions are dropped instead of crashing generation
- Added regression tests for missing `options` arrays and non-string option entries in provider output
- Completed `Q10` by expanding front-matter suppression in both the generator prompt and the structural question-quality filter
- Added front-matter rejection for blurbs, reviewer praise, acknowledgments, dedications, forewords, prefaces, back-cover copy, and similar book metadata noise
- Expanded early PDF front-matter scanning so praise/preface/acknowledgment pages are skipped before page-range sections are offered
- Completed `Q11` with a harsher structural critic that rejects questions where the correct answer is uniquely the longest and most detailed option
- Tightened the quiz-generation prompt so the correct answer should not stand out for being the longest, most technical, or only clause-heavy choice
- Fixed a quiz export bug where the exported HTML could use the wrong in-memory problem set instead of the full completed quiz
- Added `src/background/export-quiz-data.ts` as a pure resolver for export payloads, preferring `lastCompletedQuiz.problems` when exporting from the completed score state
- Added focused tests for export resolution, including the exact completed-vs-current problem-set distinction and defensive cloning
- Completed `L2` by adding persisted per-document section progress for long-form content
- Added `ProgressManager` to store progress in `chrome.storage.local` keyed by document URL, with per-section `quizzed`, `scorePercentage`, and `lastQuizzed` metadata
- Recorded section-quiz completion back onto the full document using a persisted `activeSectionIndex`, so the correct section gets credit after quiz completion
- Extended section-picker state payloads with `completedCount` and `averageScorePercentage`, and updated the panel to show both overall document progress and per-section completion markers
- Cleared stale section context when generating a normal non-sectioned quiz so old long-form progress state cannot bleed into unrelated completions
- Completed `Q9` by strengthening long-form question generation and filtering
- Updated the prompt to discourage bibliographic/front-matter trivia and to require more conceptual discrimination for long-form books, papers, and chapters
- Tightened quality filtering to reject bibliographic questions, multiple vague distractors, and questions where the correct option is the only clearly domain-specific answer
- Fixed long-form fallback section names so arbitrary chunks are now labeled sequentially instead of skipping numbers
- Preserved the full sectioned source document separately from the active section quiz, so the score view’s `New Quiz` flow can return to the section picker without forcing a new extraction
- Added a conservative PDF front-matter skip heuristic so obvious copyright/edition/contents pages are not offered as the first quizable ranges in book-like PDFs
- Added PDF page-range sectioning on top of the long-content picker, so PDFs now segment by contiguous page ranges instead of generic heading/fallback chunks
- Preserved per-page text during PDF extraction and carried it through extracted-content state for pending section selection
- Fixed a review-found mutation risk by deep-cloning extracted PDF `pageTexts` arrays when persisting/restoring tab session state
- Added long-content sectioning with a section picker for extracted content over 3000 words
- Preferred heading-based splits when HTML headings are available, but fell back to paragraph clustering and fixed-size arbitrary chunks when the source is flat or still too large
- Added persisted per-tab section-picker state plus `CONTENT_SECTIONS`, `GENERATE_SECTION_QUIZ`, and `DISMISS_SECTIONS` message support
- Added panel UI for choosing a section, generating from all content, and dismissing the picker
- Fixed a review-found state bug by making the section picker explicitly dismissible in background state instead of only hiding it in the panel
- Added a `Quiz this selection` context-menu action that generates a quiz from highlighted page text
- Added a typed `GET_SELECTION_TEXT` content-script message and reused the existing content-script attachment path for selection reads
- Added a background helper that turns selected text into `ExtractedContent`, so selection quizzes go through the normal generator path instead of special-case quiz plumbing
- Updated the panel to react to externally-triggered generation messages, so context-menu generation can show loading/ready/error states when the panel is open
- Fixed a review-found edge case by falling back to Chrome’s context-menu `selectionText` when `window.getSelection()` is empty
- Added an Ollama provider with `/api/generate` JSON-schema generation, `/api/tags` connection testing, and `llama3.2` as the default model
- Added provider-side metadata helpers for API-key requirements, base-URL support, and Ollama URL normalization
- Added Ollama to the provider registry and settings provider picker
- Added a Base URL field in Settings that appears for Ollama instead of the API key field
- Added provider-origin permission preflight in the panel before Ollama `Test Connection` and `Generate Quiz`, plus a built-in localhost host permission for the default local setup
- Fixed a review-found bug where generation-time Ollama permission prompts were initially based on current form values instead of the saved settings actually used by quiz generation
- Added paste-your-own-text mode in the idle quiz view, with a toggle between page extraction and manual text input
- Added panel-side construction of `ExtractedContent` for pasted text and a typed inline-content `GENERATE_QUIZ` payload so the background can skip content-script extraction entirely
- Fixed a review-found testability gap by moving manual request construction into a pure helper and adding direct tests for the inline-content path
- Added standalone local HTML quiz export from the ready and score views, with a self-contained offline quiz runner
- Added a background export message so the panel can fetch current quiz data without owning quiz state itself
- Fixed a review-found issue in the export page by sanitizing source-link schemes; unsafe URLs now render as plain text instead of clickable links
- Added optional per-question timer mode in the panel with saved `Off` / `15` / `30` / `60` second settings
- Added countdown UI and auto-skip on timer expiry, while keeping timer behavior entirely out of the engine
- Fixed a review-found bug where timer mode would have stayed at `Off` until Settings had been loaded; restore/start now wait for the initial settings load
- Fixed a service-worker startup race by gating tab-routing and message handling on the initial restore pass before touching in-memory quiz state
- Added per-question performance tracking in local storage using deterministic content hashes, with `seen` and `correct` counters updated after each answered question
- Made question-performance keys stable across option shuffling by hashing normalized question text plus sorted option text/correctness markers
- Added partial quiz recovery for mid-generation chunk failures: if later chunks fail after accepted questions already exist, PageQuizzer now keeps the partial quiz instead of failing the whole run
- Added ready-state warnings and `Start with N Questions` UI so partial generation is explicitly surfaced to the user
- Persisted partial-generation warnings in tab-scoped quiz session state so the recovery message survives service-worker restarts before the quiz starts
- Added a lightweight post-generation question-quality filter that drops obviously weak multiple-choice questions before they reach the engine
- Added a small over-generation buffer in `QuizGenerator` so filtering poor questions does not immediately collapse the final quiz count
- Strengthened the quiz-generation prompt so distractors are instructed to be realistic misunderstandings, parallel in style/detail, and less obviously giveaway
- Shifted prompt guidance toward conceptual and application questions instead of surface-level fact recall
- Added `D6` to the roadmap for exporting a generated quiz as a local web page
- Polished answer-choice typography by separating the numeric key badge from the wrapped option text in the quiz button layout
- Kept the true/false layout centered while adopting the same badge/text structure
- Added per-tab quiz session persistence so each browser tab keeps its own quiz-ready, in-progress, and completed state
- Updated the panel restore flow to re-query `GET_STATE` on tab activation and active-tab navigation, so switching tabs restores the right quiz instead of only the active-question case
- Added defensive tab-session helpers/tests and stopped persisting empty tab entries in local storage
- Added `Q8` to the roadmap for answer-choice typography cleanup and marked `D5` complete
- Replaced the unconditional local-PDF block with a real file-scheme access check
- Added manifest `file:///*` host coverage and a clearer fallback error when a local PDF is still unreadable
- Hardened `Start Quiz`/`Retry`/`Retry Missed` by syncing quiz state from the service worker after the action instead of depending solely on a runtime broadcast
- Removed the runtime `import()` from the service-worker PDF extractor and bundled `pdfjs` statically for the background path
- Bootstrapped `pdfjs`'s fake-worker handler in the service worker so background PDF parsing no longer needs `GlobalWorkerOptions.workerSrc`
- Added provider-specific model lists and a dynamic model dropdown in Settings, with stored-model normalization for stale selections
- Expanded the OpenAI model list to include `gpt-5-mini` and `gpt-4.1-nano`, with `gpt-5-mini` as the current default in the picker
- Added topic categorization as best-effort provider metadata, persisted current topics through worker restarts, and exposed topic chips/filters in history
- Added `Q6` and `Q7` to the roadmap for stronger distractors and question-quality filtering
- Added `D5` to the roadmap for per-tab quiz sessions

## Decisions

- Kept the library backed by document-progress storage, not quiz history, because the feature is about resumable long-form reading state rather than completed quiz sessions
- Opening a library entry reuses the active tab by default so the side panel stays attached to the tab that will immediately show resume state
- Kept L4 as an idle resume card rather than a whole new view: it satisfies the roadmap behavior while minimizing view churn and preserving the normal `Generate Quiz` path beside it
- Used the current extracted page to determine the next section to continue, not just the stored progress record, so the resume target reflects current segmentation and progress annotations
- When all sections are complete, resumed long-form content should return to the section picker instead of auto-selecting a lowest-score or first section; choosing the post-completion strategy is a later product decision
- Split the progress model into two concerns explicitly: storage records keep only durable progress fields, while UI-facing merged sections must preserve all `ContentSection` display fields like `preview` and page ranges
- Treated provider quiz JSON as untrusted runtime input, not as a guaranteed `RawQuizQuestion`; parser safety belongs in the normalization layer even when provider schemas already exist
- Treated Q10/Q11 as one shared generation-quality milestone: front-matter suppression belongs in both the content-selection layer and the post-generation filter, while “too easy by vibe” belongs in both the prompt and the structural critic
- Kept the new easy-question critic structural rather than semantic: it looks for a uniquely longest, more detailed correct answer instead of trying to judge subject-matter validity
- Treated quiz export as its own source-of-truth problem: when the visible state is a completed score screen, export should come from the stable completed quiz snapshot, not whichever mutable problem array happens to be current in the worker
- Keyed document progress by the full document URL and merged progress onto freshly computed sections by section index; this keeps the stored shape simple and lets updated section titles/word counts replace stale metadata on rebuild
- Stored section progress annotations in the same `pendingSections` payload the panel already restores, instead of creating a second parallel progress message/state branch
- Treated "generate a normal quiz from this page" as a hard reset of prior section context so stale `sectionSource`/`activeSectionIndex` data cannot leak across flows
- Kept the long-form difficulty improvement as a prompt-plus-filter pass instead of introducing a second LLM review stage; that raises the floor without adding more latency, cost, or provider complexity
- Treated bibliographic/front-matter questions as low-value by default and filtered them structurally even if they are technically answerable from the text
- Kept the full extracted long-form source and the currently selected section as separate state values; reusing one field for both made “back to sections” fundamentally lossy
- Treated front-matter skipping as a conservative heuristic limited to the first few PDF pages, not as a semantic parser; the goal is to avoid the most obvious edition/copyright noise without overfitting
- Treated PDFs as a different segmentation source from HTML: if per-page text exists, prefer page ranges outright instead of trying heading heuristics on flattened PDF text
- Kept PDF page texts inside extracted-content/tab-session state rather than inventing a second parallel PDF-only store, but compensated by explicitly deep-cloning them anywhere `lastExtracted` is copied
- Built page ranges dynamically from page word counts and a page-count cap, rather than using a fixed 10-page rule for every document
- Kept sectioning in the background layer, not the engine, because it is document-extraction/UI orchestration rather than shared quiz-core behavior
- Made heading boundaries the first choice, but treated reasonable arbitrary chunking as an explicit last-resort strategy rather than a failure case; long flat text should still be quizzable
- Stored only section summaries in tab-session state and recomputed section text from `lastExtracted` when the user picks a section, which keeps persistence smaller and the segmentation logic deterministic
- Kept highlight-to-quiz on the existing `ExtractedContent` pipeline instead of inventing a separate “selection quiz” request shape; the only special step is obtaining the selected text
- Reused the existing content-script injection/access path for selection reads so host-permission behavior stays consistent with normal extraction
- Treated `window.getSelection()` as the preferred source but used `chrome.contextMenus`’s `selectionText` as a fallback because context-menu selections can outlive or differ from page selection state
- Opened the side panel as a best-effort convenience from the context-menu handler, but kept the actual ready state persisted in the tab session so the feature still works if side-panel open fails
- Kept provider-specific API-key/base-URL rules inside `src/providers/` helpers instead of scattering `provider === 'ollama'` checks through panel/background code
- Kept Ollama generation on `/api/generate` with JSON schema format so it matches the roadmap and reuses the existing prompt/schema contract
- Treated default localhost Ollama as a normal built-in permission case via manifest `host_permissions`, but kept custom Ollama hosts on runtime optional permission requests from the panel
- Used saved background settings for generate-time provider permission preflight, because quiz generation reads persisted settings, while leaving `Test Connection` tied to current unsaved form values on purpose
- Kept pasted-text generation as a panel-built `ExtractedContent` object instead of adding a separate background/manual schema; that reuses the existing generator contract and keeps the background agnostic about where the text came from
- Kept quiz export as a standalone HTML renderer instead of depending on the built engine bundle; this keeps the first version portable and avoids coupling the exported file to extension build layout
- Kept timer mode panel-local instead of pushing countdown logic into background or engine state; the timer is a presentation/interaction concern, not quiz-core logic
- Treated service-worker restore as a prerequisite for message handling instead of a fire-and-forget startup task; otherwise fresh actions can run against empty in-memory state before persistence finishes loading
- Kept per-question performance tracking as a background-only data layer with no UI yet; that lets future spaced-repetition work build on stable stored stats without forcing premature product decisions
- Avoided using provider/generated problem IDs for performance tracking because they are session-local; the hash is based on normalized question content instead
- Treated chunk failures as recoverable only after at least one accepted question exists; if generation never produced usable questions, the user still gets a normal error instead of an empty “recovered” quiz
- Kept the partial-recovery warning in extension state rather than inferring it from problem count alone, because the ready UI needs to distinguish “short quiz by choice” from “short quiz because generation stopped early”
- Kept the quality filter conservative and structural: reject only patterns that are clearly low-signal or giveaway, rather than trying to “understand” subject matter correctness heuristically
- Put the filter in the background generator layer instead of `src/providers/` so provider outputs all pass through one shared quality gate
- Kept the “better quizzes” work prompt-only for this milestone instead of mixing it with post-generation heuristics; that isolates whether improved question quality comes from instruction tuning before adding more moving parts
- Put the new export idea on the roadmap as a standalone local-HTML deliverable first, with OpenQuizzer-style JSON as a future extension rather than part of the first version
- Kept the typography fix markup-local to the panel instead of introducing new render helpers; the problem was structural layout, not shared logic
- Continued using `innerHTML` for option buttons, but only with escaped option text and fixed badge markup, which preserves the existing XSS boundary
- Kept D5 tab-scoped at the background/panel boundary instead of adding tab IDs to engine events; the engine stays tab-agnostic and the service worker routes state to the active tab
- Preserved completed quiz summaries per tab as part of the tab session so switching away and back returns to that tab’s score view until the tab closes or navigates
- Treated empty tab sessions as removable storage noise rather than durable state; only tabs with ready/in-progress/completed quiz data are written to `chrome.storage.local`
- Treated local `file://` PDFs as a real permission/runtime path instead of a blanket failure case: if Chrome says file access is enabled, PageQuizzer now attempts extraction
- Kept the user-facing guidance only for the actual blocked case, and separated it from the "file still unreadable" fallback so debugging is less misleading
- Kept the state-sync fix panel-side to avoid changing the message protocol for a UI reliability bug; the service worker remains the source of truth and the panel simply asks for current state immediately after start-like actions
- Kept the content-script PDF loader as a runtime module import, but removed that pattern from the MV3 service worker where Chrome disallows it
- For the service-worker PDF path, supplying `WorkerMessageHandler` directly is safer than relying on `workerSrc` because it avoids another runtime module load in a context where `import()` is restricted
- Kept provider model metadata in `src/providers/` so the panel can render model choices without scattering provider-specific strings through unrelated code
- Used the current OpenAI pricing page to justify exposing cheaper OpenAI options directly instead of guessing from older model defaults
- Kept topic generation non-fatal so a provider hiccup in metadata tagging cannot block the core quiz flow

## Validation

- `npm test` passed with 153/153 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

- A document library should not be derived from quiz history; history tells you what quizzes were finished, while resumable long-form state lives in document progress
- If opening a tracked document from the panel should preserve the side-panel workflow, reusing the active tab is smoother than opening a background tab and leaving the panel pointed at the wrong page
- Resume/progress lookup on PDFs should use the resolved underlying PDF URL, not the Chrome viewer wrapper URL, or saved progress will look like it disappeared
- If an idle state is replaced by a resumable-document card, make sure untracked tabs explicitly clear that state or the previous tab’s resume UI can leak into a different page
- If a helper merges persistent progress back into live section-picker data, do not reuse the storage shape as the UI shape; otherwise fields like `preview` and page ranges disappear and the panel crashes on perfectly valid sections
- TypeScript types on provider response shapes do not protect runtime JSON; parser normalization still needs explicit guards before touching fields like `options.length`
- If users say the answer is obvious because it is the only detailed option, word-count outlier checks alone are too weak; add a second heuristic for a uniquely longest, more specific correct answer
- Suppressing front matter only in generation is not enough for books/PDFs; early PDF page scanning should also skip praise/preface/copyright-style pages so they do not become the first sections offered
- If a feature exports or persists quiz data from a completed score view, prefer the stable completed quiz snapshot over mutable “current problems” state; retries, narrowed flows, or later state changes can otherwise export the wrong problem set
- If long-form completion needs to be written back after a section quiz ends, persist the selected section index separately from the narrowed extracted content; `lastExtracted` alone is not enough to identify the parent section safely
- If a restorable picker view shows derived progress, persist the annotated section list or rebuild it through one helper consistently; otherwise restored panel state and freshly generated picker state will drift
- If the real product complaint is “the answer is obvious because the other options are generic,” improving the prompt alone is not enough; add a structural filter for vague distractors and domain-specific-option outliers too
- Front-matter/bibliographic trivia is often technically extractable from books and PDFs but still low-value for retrieval practice; filtering it explicitly gives better quiz quality than hoping segmentation alone removes it
- If the app needs to return from a narrowed subsection quiz back to a broader section picker, don’t overwrite the original source document with the narrowed subsection; keep both pieces of state
- Generic fallback section labels should be assigned after rebalancing, not before; otherwise merged chunks inherit misleading source indexes like `Part 7`
- Front-matter skipping for PDFs should stay conservative and early-page-only; over-aggressive heuristics would hide legitimate body content
- Adding nested arrays to `ExtractedContent` changes the cloning requirements everywhere that state is persisted or restored; shallow spreads are no longer enough once PDF page texts exist
- Flattened PDF text should not be segmented with the same heading logic as HTML; preserve page boundaries during extraction if you want meaningful page-range choices later
- If a new intermediate UI state should survive a worker restart, it needs to be persisted explicitly; a pure panel response is not enough once the service worker becomes the source of truth for restore
- Heading-based segmentation is useful when available, but long-form support still needs a deterministic no-structure fallback; otherwise books, scans, and flat exports remain effectively unquizzable
- If an intermediate state is restorable from background state, it also needs a real dismiss/reset message; panel-only hiding just creates “sticky” restore bugs
- If a feature can trigger quiz generation from outside the panel, the panel needs to react to background `GENERATING_STATUS` / `QUIZ_GENERATED` / `QUIZ_ERROR` messages too; otherwise external generation silently finishes off-screen
- `window.getSelection()` is not always the same as what Chrome exposes to a context-menu click; for selection-driven features, keep a fallback to `info.selectionText`
- If a panel action ultimately uses saved background settings, permission preflight should use that same saved settings source too; otherwise unsaved form changes can prompt for one host while the background actually fetches another
- Default-provider host permissions and runtime optional-host requests can coexist cleanly: give the common default endpoint a built-in permission, then use runtime prompts only for custom hosts
- Ollama base URLs should be normalized once, including trimming trailing slashes and a user-supplied `/api` suffix, before building endpoints or permission patterns
- If a new panel flow sends typed data to the background, test the request-construction path directly; otherwise the feature can look covered while the real message payload branch remains unverified
- Escaping a URL for HTML is not the same thing as making it safe to click; exported pages that render source links should still restrict allowed URL schemes
- Panel-side features that depend on saved settings need those settings loaded before restore/start flows, not just when the user opens Settings; otherwise “saved” behavior can silently fall back to defaults
- In MV3, async startup restore should be treated as a real dependency, not best-effort background work; if messages can arrive before restore completes, newer state can be computed from stale in-memory data and then persisted incorrectly
- Question-performance keys must be independent of shuffled option order or the same question will fragment into multiple records across retries/sessions
- Partial recovery needs to be persisted too; otherwise a service-worker restart between generation and quiz start would silently drop the warning and revert the ready screen to looking like a normal full-success run
- Quality heuristics should be biased toward obviously bad structural patterns; if they get too semantic or too aggressive, they will quietly delete valid questions and make quiz counts unpredictable
- If filtered questions reduce final counts, requesting a small buffer at generation time is simpler and safer than trying to regenerate recursively inside provider code
- If prompt quality is the thing being changed, bump the prompt version and add prompt-specific assertions; otherwise later question-quality comparisons are hard to attribute to a specific instruction set
- Inline number badges next to wrapped answer text look acceptable for short options but drift noticeably on real content; using a dedicated flex row/column structure is more stable than trying to tune line-height alone
- Tab-scoped persistence needs both sides to participate: the service worker must swap sessions when the active tab changes, and the panel must ask for fresh state on tab activation/navigation or it will keep showing the previous tab’s view
- `GET_STATE` now represents more than “current question”; it also carries `ready` and `complete` views, so UI restore code should treat it as the source of truth for quiz state
- Web PDF permissions and local-file PDF permissions are different in Chrome; working hosted PDFs do not imply that local PDFs will work without the file-URL setting
- The file-URL details toggle is not enough on its own; the manifest also needs to declare `file://` access or local-PDF fetches remain unavailable

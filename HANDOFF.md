# Handoff

## Completed

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

- `npm test` passed with 112/112 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

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

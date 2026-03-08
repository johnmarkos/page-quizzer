# Handoff

## Completed

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

- `npm test` passed with 87/87 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

- Inline number badges next to wrapped answer text look acceptable for short options but drift noticeably on real content; using a dedicated flex row/column structure is more stable than trying to tune line-height alone
- Tab-scoped persistence needs both sides to participate: the service worker must swap sessions when the active tab changes, and the panel must ask for fresh state on tab activation/navigation or it will keep showing the previous tab’s view
- `GET_STATE` now represents more than “current question”; it also carries `ready` and `complete` views, so UI restore code should treat it as the source of truth for quiz state
- Web PDF permissions and local-file PDF permissions are different in Chrome; working hosted PDFs do not imply that local PDFs will work without the file-URL setting
- The file-URL details toggle is not enough on its own; the manifest also needs to declare `file://` access or local-PDF fetches remain unavailable

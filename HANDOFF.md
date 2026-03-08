# Handoff

## Completed

- Replaced the unconditional local-PDF block with a real file-scheme access check
- Added manifest `file:///*` host coverage and a clearer fallback error when a local PDF is still unreadable
- Hardened `Start Quiz`/`Retry`/`Retry Missed` by syncing quiz state from the service worker after the action instead of depending solely on a runtime broadcast
- Removed the runtime `import()` from the service-worker PDF extractor and bundled `pdfjs` statically for the background path
- Bootstrapped `pdfjs`'s fake-worker handler in the service worker so background PDF parsing no longer needs `GlobalWorkerOptions.workerSrc`
- Added provider-specific model lists and a dynamic model dropdown in Settings, with stored-model normalization for stale selections
- Added `Q6` and `Q7` to the roadmap for stronger distractors and question-quality filtering

## Decisions

- Treated local `file://` PDFs as a real permission/runtime path instead of a blanket failure case: if Chrome says file access is enabled, PageQuizzer now attempts extraction
- Kept the user-facing guidance only for the actual blocked case, and separated it from the "file still unreadable" fallback so debugging is less misleading
- Kept the state-sync fix panel-side to avoid changing the message protocol for a UI reliability bug; the service worker remains the source of truth and the panel simply asks for current state immediately after start-like actions
- Kept the content-script PDF loader as a runtime module import, but removed that pattern from the MV3 service worker where Chrome disallows it
- For the service-worker PDF path, supplying `WorkerMessageHandler` directly is safer than relying on `workerSrc` because it avoids another runtime module load in a context where `import()` is restricted
- Kept provider model metadata in `src/providers/` so the panel can render model choices without scattering provider-specific strings through unrelated code

## Validation

- `npm test` passed with 76/76 tests
- `npm run build` passed

## Gotchas

- Web PDF permissions and local-file PDF permissions are different in Chrome; working hosted PDFs do not imply that local PDFs will work without the file-URL setting
- The file-URL details toggle is not enough on its own; the manifest also needs to declare `file://` access or local-PDF fetches remain unavailable

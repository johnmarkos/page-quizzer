# Handoff

## Completed

- Replaced the unconditional local-PDF block with a real file-scheme access check
- Added manifest `file:///*` host coverage and a clearer fallback error when a local PDF is still unreadable
- Added `Q6` and `Q7` to the roadmap for stronger distractors and question-quality filtering

## Decisions

- Treated local `file://` PDFs as a real permission/runtime path instead of a blanket failure case: if Chrome says file access is enabled, PageQuizzer now attempts extraction
- Kept the user-facing guidance only for the actual blocked case, and separated it from the "file still unreadable" fallback so debugging is less misleading

## Validation

- `npm test` passed with 71/71 tests
- `npm run build` passed

## Gotchas

- Web PDF permissions and local-file PDF permissions are different in Chrome; working hosted PDFs do not imply that local PDFs will work without the file-URL setting
- The file-URL details toggle is not enough on its own; the manifest also needs to declare `file://` access or local-PDF fetches remain unavailable

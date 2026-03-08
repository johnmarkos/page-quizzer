# Handoff

## Completed

- Added an explicit local-PDF guard and actionable file-access guidance
- Added `Q6` and `Q7` to the roadmap for stronger distractors and question-quality filtering

## Decisions

- Treated local `file://` PDFs as a UX/permissions problem first and surfaced the exact Chrome setting users need instead of trying to paper over the browser-level fetch restriction

## Validation

- `npm test` passed with 68/68 tests
- `npm run build` passed

## Gotchas

- Web PDF permissions and local-file PDF permissions are different in Chrome; working hosted PDFs do not imply that local PDFs will work without the file-URL setting

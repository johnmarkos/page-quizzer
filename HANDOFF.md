# Handoff

## Completed

- Added a dedicated background PDF extraction path for direct-PDF and Chrome PDF viewer tabs
- Moved shared PDF URL/title/text helpers into `src/shared/pdf.ts`
- Updated site-access origin resolution so Chrome PDF viewer tabs request access for the underlying PDF host

## Decisions

- Bypassed content-script injection entirely for viewer-wrapped PDFs because Chrome blocks scripting the viewer page
- Kept normal HTML extraction in the content script, but let PDFs use a background extractor where the real document URL is already known

## Validation

- `npm test` passed with 66/66 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

- For PDF tabs, the visible tab URL and the actual document URL may differ; permission prompts and extraction need to follow the real PDF source URL, not the viewer wrapper

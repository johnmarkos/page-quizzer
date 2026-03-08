# Handoff

## Completed

- Removed the manifest `content_scripts` entry for `dist/content.js`
- Changed extraction to attach the content script programmatically before messaging it, using the same module-safe attach path every time
- Removed the now-obsolete missing-receiver helper logic and test coverage

## Decisions

- Chose one execution model for the content script instead of trying to support both classic manifest loading and module-based runtime attachment with the same bundle
- Kept the content bundle module-oriented because `pdfjs-dist` already pushes the implementation that way, especially for PDF support

## Validation

- `npm test` passed with 65/65 tests
- `npm run build` passed

## Gotchas

- Fixing only the runtime recovery path was not enough while the manifest still tried to load the same file as a classic content script on page load

# Handoff

## Completed

- Split `pdfjs` into its own `dist/pdfjs.js` asset
- Made `dist/content.js` classic-script-safe again
- Switched content-script attachment back to direct file injection so the message receiver persists properly

## Decisions

- Chose a hybrid bundle strategy: classic script for the main content receiver, module asset only for the PDF parser
- Kept PDF extraction in the content layer, but stopped letting its dependency shape dictate the execution model for the whole content script

## Validation

- `npm test` passed with 65/65 tests
- `npm run build` passed

## Gotchas

- A content script that must act as a stable message receiver is much simpler when it runs as a plain injected file; module-only dependencies should be isolated behind dynamic imports

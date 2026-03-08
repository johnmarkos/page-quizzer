# Handoff

## Completed

- Fixed `Could not establish connection. Receiving end does not exist.` during quiz generation on already-open tabs
- Added `src/background/content-script-bridge.ts` to detect missing-receiver errors and gate programmatic injection by URL protocol
- The service worker now injects `dist/content.js` into the active tab and retries extraction when the initial message fails because no content script is attached
- Added a global guard in the content script so reinjection does not duplicate message listeners

## Decisions

- Used on-demand reinjection instead of asking users to refresh tabs manually after reloading the extension
- Added the `scripting` permission because `chrome.scripting.executeScript()` is the right recovery path for the active tab in MV3
- Limited injection recovery to `http`, `https`, and `file` URLs to avoid pretending unsupported Chrome/internal pages are accessible

## Validation

- `npm test` passed with 60/60 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

- This fix covers normal pages that are already open when the extension reloads; pages Chrome forbids extensions from scripting still return a clear access error instead

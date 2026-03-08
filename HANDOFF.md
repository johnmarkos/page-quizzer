# Handoff

## Completed

- Added runtime site-access fallback for normal web pages when Chrome blocks content-script injection for missing host permission
- The background now detects host-permission injection failures, requests access for the current origin, and retries the bundled content-script injection
- Added `optional_host_permissions` for `http` and `https` origins

## Decisions

- Kept persistent required host permissions limited to provider APIs only
- Used optional per-site access instead of broad `<all_urls>` host access because the extension should not silently gain blanket read access to the web
- Restricted runtime requests to `http` and `https` origins; `file:` and internal Chrome pages still follow their own browser restrictions

## Validation

- `npm test` passed with 66/66 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

- Even if a page is already rendered in the browser, the extension service worker cannot inspect that DOM directly; it still needs host permission to inject a content script into the tab

# Handoff

## Completed

- Added the `tabs` permission so the extension can read the active tab URL before requesting per-site host access

## Decisions

- Kept the per-site optional host permission design instead of broadening host access, and added `tabs` as the minimal supporting permission needed to make the origin lookup reliable

## Validation

- `npm test` passed with 65/65 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

- Runtime host permission logic that depends on `tab.url` will fail unpredictably if the extension cannot actually see that field for the active tab

# Handoff

## Completed

- Moved the normal-page host-permission request into the panel's `Generate Quiz` click flow
- Added `src/shared/site-access.ts` so panel and background permission logic use the same per-origin pattern builder
- Kept the background runtime-access fallback in place, but the panel now requests access earlier when Chrome is most likely to honor the prompt

## Decisions

- Requested site access before sending `GENERATE_QUIZ` so the permission prompt happens inside the original user gesture
- Left the background retry path intact because it still helps in edge cases where the panel cannot preflight access cleanly
- Shared the origin-pattern helper instead of duplicating host-pattern logic across panel and background code

## Validation

- `npm test` passed with 66/66 tests
- `npm run build` passed

## Gotchas

- Optional host permission requests triggered too deep in an async background path may not behave like a direct user-gesture prompt, even when the original flow began with a button click

# Handoff

## Completed

- Finished `S3: Quiz progress indicator in extension icon`
- Added badge formatting helpers in `src/background/quiz-badge.ts`
- Wired the service worker to show question progress on `questionShow`
- Cleared the badge when the engine returns to `idle` or `complete`
- Resynced the badge during service worker restore so active quizzes keep their progress indicator after restart

## Decisions

- Kept all badge logic in the background so the engine remains Chrome-free and the panel does not own extension action UI state
- Used a tiny pure helper module for badge text and clear/show rules so the behavior is testable without mocking `chrome.action`
- Cleared the badge immediately on startup before restore, then reapplied it only if the restored engine state is still active

## Validation

- `npm test` passed with 55/55 tests
- `npm run build` passed

## Gotchas

- `QuizEngine.restore()` does not emit `questionShow` or `stateChange`, so badge state must be synchronized explicitly after reading the stored snapshot

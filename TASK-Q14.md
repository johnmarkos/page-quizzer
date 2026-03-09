# Task: Q14 — Quit/Abandon Quiz

_Assigned: 2026-03-08_
_Status: done_

## What to Build

Add a "Quit Quiz" button that lets the user abandon a quiz mid-progress and return to the idle view. Currently there's no way to exit a quiz without finishing it or navigating away from the page.

## Scope

**In scope:**
- `src/shared/messages.ts` — Add `ABANDON_QUIZ` message type to the `Message` union
- `src/background/service-worker.ts` — Handle `ABANDON_QUIZ`: reset engine to idle, clear tab session data, clear badge
- `src/panel/panel.ts` — Add quit button to quiz view, send `ABANDON_QUIZ` message, return to idle view
- `src/panel/panel.html` — Add the quit button element to the quiz view header
- `src/panel/panel.css` — Style the quit button (small, non-prominent)

**Out of scope (do not touch):**
- `src/engine/` — The engine already supports `reset()` to return to idle. No engine changes.
- `src/providers/` — No provider changes
- `src/prompts/` — No prompt changes
- `src/content/` — No content script changes
- Saving partial sessions to history — skip this for now (keep it simple)

## Current Behavior

During a quiz (`practicing` or `answered` state), the panel shows question content and answer options but no way to exit. The user must either finish all questions or navigate the browser tab to a different page.

## Target Behavior

1. A small, non-prominent "End Quiz" button (or X icon) appears in the quiz view header area during `practicing` and `answered` states.
2. Clicking it sends an `ABANDON_QUIZ` message to the service worker.
3. The service worker:
   - Resets the engine to idle (`engine.reset()` or equivalent)
   - Clears the tab's quiz session from `tabQuizSessions` using `removeTabQuizSession()`
   - Persists the updated session map to storage
   - Clears the extension badge (`chrome.action.setBadgeText({ text: '' })`)
   - Responds with `{ type: 'ok' }`
4. The panel returns to the idle view.

## Implementation Guide

### 1. messages.ts

Add to the command messages section (near `SKIP_QUESTION`, `RETRY_MISSED`, etc.):

```typescript
export type AbandonQuizMessage = {
  type: 'ABANDON_QUIZ';
};
```

Add `AbandonQuizMessage` to the `Message` union type.

### 2. service-worker.ts

Add a case in the message handler for `ABANDON_QUIZ`:

```typescript
case 'ABANDON_QUIZ': {
  engine.reset();
  tabQuizSessions = removeTabQuizSession(tabQuizSessions, sender.tab?.id ?? activeTabId);
  await chrome.storage.local.set({ [STORAGE_KEYS.TAB_QUIZ_SESSIONS]: tabQuizSessions });
  await chrome.action.setBadgeText({ text: '' });
  return { type: 'ok' };
}
```

Look at how existing similar messages (like `RETRY_MISSED` or `DISMISS_SECTIONS`) handle tab ID and session cleanup. Follow the same pattern.

### 3. panel.html

Add a quit button in the quiz view area. Look for where the question counter or quiz header is rendered and add a button near it:

```html
<button id="quit-quiz-btn" class="quit-quiz-btn" title="End quiz">End Quiz</button>
```

### 4. panel.css

Style it to be small and non-prominent — it should be visible but not compete with the answer options:

```css
.quit-quiz-btn {
  /* Small, muted, positioned in quiz header area */
  /* Follow existing button patterns in the CSS */
}
```

### 5. panel.ts

Add a click handler for the quit button:

```typescript
$('quit-quiz-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'ABANDON_QUIZ' });
  showView('idle');
});
```

Show/hide the quit button based on quiz state — it should be visible during `practicing` and `answered`, hidden otherwise. Look at how other quiz-only UI elements are shown/hidden in existing state transition code.

## Constraints

These are hard rules from AGENTS.md. Violations will be caught in staff review.

1. **Message types are exhaustive** — the new `ABANDON_QUIZ` message type must be in the `Message` union in `src/shared/messages.ts`. No `as any` casts.
2. **Engine (`src/engine/`) has zero Chrome API dependencies** — do not modify the engine. Use its existing `reset()` method.
3. **TypeScript strict mode** — no `any` types.
4. **Descriptive variable names** — no single-letter variables outside tight loops.
5. **API key storage** — Keys must remain in `chrome.storage.local` only. (Not directly relevant, but don't accidentally change storage behavior.)

## Acceptance Criteria

- [x] "End Quiz" button visible during practicing and answered states
- [x] Button hidden during idle, complete, and other non-quiz views
- [x] Clicking it returns the panel to idle view
- [x] Engine is reset to idle state
- [x] Tab session is cleared from `tabQuizSessions` storage
- [x] Extension badge is cleared
- [x] Starting a new quiz after quitting works correctly
- [x] `npm test` passes
- [x] `npm run build` passes
- [x] Self-review checklist from AGENTS.md completed

## When Done

1. Run `npm test` — must pass
2. Run `npm run build` — must pass
3. Run the self-review loop from AGENTS.md — fix everything found
4. Create a branch: `feat/quit-quiz`
5. Commit with attribution:
   ```
   Co-Authored-By: GPT 5.4 <noreply@openai.com>
   ```
6. Push and open a PR against `main`
7. Comment `@codex review` on the PR to request a Codex review
8. Wait for Codex approval — look for a `+1` reaction from `chatgpt-codex-connector[bot]` on the PR description. If Codex leaves critical comments, fix them yourself, push, and re-request review.
9. Once CI passes and Codex approves, merge the PR: `gh pr merge --merge`
10. Update `CHANGELOG.md` with what you did
11. Mark this task: change `Status: pending` → `Status: done`
12. Write `HANDOFF.md` with: what was completed, any decisions made and why, anything unfinished, gotchas

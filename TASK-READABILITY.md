# Task: Readability Pass — Section Comments, Deduplication, Naming

_Assigned: 2026-03-08_
_Status: done_

## What to Build

Address readability issues found in a staff-level review. Three categories: add section comments to large files, deduplicate utility functions, and fix naming violations.

## Scope

**In scope:**
- Add section comments (`// --- Section Name ---`) to large files
- Deduplicate `countWords` into a shared utility
- Deduplicate `cloneProblems` (import from one source)
- Fix single-letter variable `s` in `panel.ts`
- Fix `document` shadowing in `panel.ts`

**Out of scope (do not touch):**
- `OpenQuizzerDetector.ts` — runtime validation fix is a separate task
- `service-worker.ts` message handler refactoring — separate task
- Any behavioral changes — this is cosmetic only
- Test files — only `src/` files

## Changes

### 1. Section comments in `service-worker.ts`

**File:** `src/background/service-worker.ts` (936 lines)

Add these section dividers (adjust line positions to fit between logical groups):

```
// --- Module State ---
// --- Engine Event Handlers ---
// --- Chrome Lifecycle ---
// --- Persistence ---
// --- Message Router ---
// --- Quiz Generation ---
// --- Content Extraction ---
// --- Connection & Settings ---
// --- Post-Quiz Actions ---
// --- Clone Helpers ---
// --- Tab Session Management ---
// --- Badge ---
// --- Broadcast ---
```

### 2. Section comments in `panel.ts`

**File:** `src/panel/panel.ts` (1270 lines)

The file already has some section comments. Add missing ones:

```
// --- Sections ---
// --- Library ---
// --- Document Resume ---
// --- Timer ---
// --- Export ---
// --- Tab Change Listeners ---
```

### 3. Section comments in `content-sections.ts`

**File:** `src/background/content-sections.ts` (348 lines)

```
// --- Public API ---
// --- Heading-Based Sectioning ---
// --- PDF Page Sectioning ---
// --- Rebalancing ---
// --- Utilities ---
```

### 4. Section comments in `question-quality.ts`

**File:** `src/background/question-quality.ts` (203 lines)

```
// --- Quality Patterns ---
// --- Quality Filter ---
// --- Issue Detection ---
// --- Generation Buffer ---
// --- Utilities ---
```

### 5. Section comments in `ProgressManager.ts`

**File:** `src/background/ProgressManager.ts` (220 lines)

```
// --- Types ---
// --- Progress Operations ---
// --- Summary Builders ---
// --- Clone Helpers ---
```

### 6. Deduplicate `countWords`

There are 5 implementations:
- `src/shared/pdf.ts` line 110
- `src/background/content-sections.ts` line 345
- `src/background/question-quality.ts` line 173
- `src/background/selection-content.ts` line 34
- `src/panel/manual-content.ts` line 37

**Fix:** Create `src/shared/text-utils.ts` with a single exported `countWords`:

```typescript
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
```

Import it in all 5 files. Remove the local implementations. Note: the `selection-content.ts` version is slightly different (no `.filter(Boolean)`) — use the version with `.filter(Boolean)` for consistency.

### 7. Deduplicate `cloneProblems`

`src/background/export-quiz-data.ts` has a private `cloneProblems` identical to the one exported from `src/background/retry-missed.ts`.

**Fix:** In `export-quiz-data.ts`, remove the local `cloneProblems` and import from `retry-missed.ts`:

```typescript
import { cloneProblems } from './retry-missed.js';
```

### 8. Fix variable naming

**`panel.ts` line 580:** Rename `s` to `savedSettings`:

```typescript
// Before
const s = response.payload;
// After
const savedSettings = response.payload;
```

Update all references to `s.` in the surrounding code block to `savedSettings.`.

**`panel.ts` around line 1203:** Rename `document` callback parameter:

```typescript
// Before
currentDocuments.map((document, index) => `
// After
currentDocuments.map((doc, index) => `
```

Update all references to `document.` inside that template to `doc.`.

## Constraints

1. **No behavioral changes** — this is a cosmetic/organizational pass only
2. **TypeScript strict mode** — no `any` types
3. **All tests must continue to pass** — you're only moving code around and adding comments
4. **Follow existing section comment style** — use `// --- Name ---` format, matching what `panel.ts` already uses

## Acceptance Criteria

- [ ] All 5 listed files have section comments
- [ ] `countWords` exists in one place (`src/shared/text-utils.ts`) and is imported everywhere
- [ ] `cloneProblems` duplication removed in `export-quiz-data.ts`
- [ ] No single-letter variables outside tight loops in `panel.ts`
- [ ] No `document` shadowing in `panel.ts`
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Self-review checklist from AGENTS.md completed

## When Done

1. Run `npm test` — must pass
2. Run `npm run build` — must pass
3. Run the self-review loop from AGENTS.md — fix everything found
4. Create a branch: `chore/readability-pass`
5. Commit with attribution:
   ```
   Co-Authored-By: GPT 5.4 <noreply@openai.com>
   ```
6. Push and open a PR against `main`
7. **Multi-agent review loop** — Fire off a separate Codex agent to review your work. The reviewer agent should:
   - Read `AGENTS.md` in full
   - Read every changed file (not just diffs)
   - Run the full **Self-Review Loop** checklist from AGENTS.md (lines 87–103)
   - Check all Architecture Rules against the actual code
   - Report findings as: blocking (must fix) vs. advisory (should fix)
8. **Fix and re-review** — If the reviewer finds blocking issues, fix them, push, and fire off the reviewer agent again. **Iterate until the reviewer finds nothing significant.** This is the same standard as the AGENTS.md self-review loop.
   - **Escape hatch:** If the same issue recurs across rounds or you're uncertain whether something is a real problem, flag it in `CODEX-HANDOFF.md` for human review and move on.
9. Once CI passes and the reviewer is clean, merge the PR: `gh pr merge --merge`
10. Update `CHANGELOG.md` with what you did
11. Mark this task: change `Status: pending` → `Status: done`
12. Write `CODEX-HANDOFF.md` with: what was completed, any decisions made and why, anything unfinished, gotchas

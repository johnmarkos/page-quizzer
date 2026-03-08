# PageQuizzer Agent Instructions

Guidance for agents working on this repository. Read this entire file before making changes.

## Project Overview

**PageQuizzer** is a Chrome extension that generates quiz questions from any web page for retrieval practice (Roediger & Karpicke). It uses LLM APIs to create multiple-choice questions from extracted page content.

The quiz engine (`src/engine/`) is designed as a **shared core module** with zero Chrome API dependencies. It will eventually be extracted into its own npm package (QuizzerCore) for use by OpenQuizzer, a future iOS app, and other consumers.

**Sister project:** [OpenQuizzer](https://github.com/johnmarkos/openquizzer) — a zero-dependency quiz engine and template repo. PageQuizzer's engine is modeled on OpenQuizzer's state machine and event system. When in doubt about engine design patterns, OpenQuizzer is the reference.

## Architecture Rules

These are hard rules, not suggestions. Violations should be caught in self-review.

1. **All LLM calls go through `src/providers/`** — no direct `fetch` to AI APIs anywhere else
2. **Prompts live in `src/prompts/`** — one file per feature, with version constant and tested output shape
3. **Engine (`src/engine/`) has zero Chrome API dependencies** — no `chrome.*` imports, no DOM access. It's the shared core.
4. **No provider-specific code outside `src/providers/`** — the rest of the codebase sees only `BaseProvider`
5. **Content extraction is isolated from quiz generation** — extraction happens in the content script, generation in the service worker
6. **Message types are exhaustive** — every message between contexts must be in the `Message` union in `src/shared/messages.ts`. No `as any` casts on message types.
7. **Engine/UI boundary:** The engine emits events with all data the panel needs to render. The panel should never reach back into the engine for display info.

## File Layout

```
src/
├── engine/          # SHARED CORE — zero Chrome dependencies, will become QuizzerCore
├── prompts/         # LLM prompt templates — versioned, tested
├── providers/       # LLM provider abstraction (Anthropic, future: OpenAI, Gemini, Ollama)
├── background/      # Chrome service worker — message routing, quiz orchestration
├── content/         # Chrome content script — DOM access, content extraction
├── panel/           # Side panel UI — HTML, CSS, TypeScript
└── shared/          # Types and constants shared across Chrome contexts
```

## Development

**Build:** `npm run build` — esbuild compiles 4 targets (background, content, panel, standalone engine). `npm run build:watch` for development.

**Tests:** `npm test` — Vitest with TypeScript support. **Always run tests after any change.** Tests must pass before committing.

**Load in Chrome:** `chrome://extensions` → Developer mode → "Load unpacked" → select project root.

## Conventions

- TypeScript strict mode — no `any` types except where interfacing with untyped external APIs
- ES module format throughout
- Defensive copies of caller-provided data in the engine (`[...array]`, `{ ...obj }`)
- Private fields (`#field`) for engine internals — not `_field` or closures
- Section comments (`// --- Section Name ---`) to group related code in larger files
- Descriptive variable names — no single-letter variables outside tight loops
- When in doubt, a short comment is better than making the reader trace through code

## Testing Philosophy (Goldilocks)

Write meaningful tests that verify important behavior. Not too many, not too few.

**Good targets:**
- Engine state machine transitions and edge cases
- Grading correctness for all question types
- Prompt template output shape and density calculations
- Provider abstraction contract (factory, model defaults)
- Serialize/restore round-trips

**Not worth testing:**
- Chrome API wiring (manual testing)
- CSS rendering
- Exact LLM output text

**Patterns:**
- Factory functions: `mockProblem(id)` for test data
- `collectEvents(engine, event)` pattern for event-driven assertions
- Test through shuffling by reading `engine.currentProblem` — don't assume problem order

## Self-Review Loop

**This is mandatory after every milestone.** Switch to a reviewer role and critique harshly:

- [ ] Bugs in engine logic (grading, state transitions, edge cases)
- [ ] Dead code or unused fields after refactors
- [ ] `as any` casts — each one is a type safety hole
- [ ] API surface mismatch (engine exposes things the UI doesn't need, or vice versa)
- [ ] Missing test coverage for new functionality
- [ ] Chrome extension gotchas (service worker lifecycle, message passing, CSP)
- [ ] Security: API keys in `chrome.storage.local` (not sync), no XSS in rendered content
- [ ] Readability: descriptive names, section comments, labeled branches
- [ ] Architecture rule violations (see Architecture Rules above)

Fix issues. Review again. **Iterate until the reviewer finds nothing significant.**

**Escape hatch:** If the same issue recurs or you're uncertain, flag it for human review and move on.

## Security Review

**Periodic, mandatory.** Approach as a staff-level security engineer. This is a browser extension that handles API keys and injects scripts into every page the user visits — the attack surface is real.

### Checklist

- [ ] **API key storage** — Keys must be in `chrome.storage.local` only (not `sync`, which can leak to other devices). Never logged, never included in error messages, never sent anywhere except the intended provider API.
- [ ] **XSS in rendered content** — Any user-generated or LLM-generated text rendered in the panel must be escaped. Check every use of `.innerHTML` — should it be `.textContent` instead? The `escapeHtml()` helper must be used for all dynamic content in HTML templates.
- [ ] **Content script isolation** — The content script runs in the context of every web page. It must not leak page data to the extension beyond what's explicitly extracted. It must not expose extension internals to the page.
- [ ] **CSP compliance** — No `eval()`, no inline scripts, no `new Function()`. Readability.js is eval-free (verified). Any new dependencies must be checked.
- [ ] **Message validation** — Messages from content scripts could theoretically be spoofed by a malicious page. Validate message shape before acting on it. Never trust `sender.tab` for security-critical decisions without verification.
- [ ] **Network requests** — All outbound requests should go only to the configured provider API. No telemetry, no analytics, no unexpected network calls. Audit every `fetch()` call.
- [ ] **Permissions minimality** — The manifest should request only the permissions actually needed. Audit `permissions` and `host_permissions` after adding features. `<all_urls>` in content scripts is broad — document why it's necessary (content extraction on any page).
- [ ] **Dependency supply chain** — Check `package.json` dependencies. Minimize runtime dependencies (currently just `@mozilla/readability`). Review lockfile changes. No postinstall scripts.
- [ ] **Storage data sensitivity** — Quiz history contains URLs the user visited. This is sensitive browsing data. It stays in `chrome.storage.local` (never transmitted). Export feature must warn if exporting to a shared location.

### When to run

- After adding any new dependency
- After adding any new permission to the manifest
- After any change to content script or message handling
- After any change to how API keys are stored or transmitted
- Periodically during staff reviews (every 3-4 milestones)

Fix issues immediately. If a security concern requires an architectural change, flag it for the project owner.

## Multi-Model Workflow

This project uses multiple AI models with different roles:

- **Claude Opus 4.6** — Staff engineer. Architecture decisions, code review, AGENTS.md maintenance. Does thorough full-codebase reviews after other models implement features.
- **GPT 5.4 / other models** — Volume implementation. Picks up tasks from ROADMAP.md, implements them following these guidelines, runs self-review.

### For implementers (any model):

1. Read this entire file and ROADMAP.md before starting
2. Pick a task from the **Task Queue** section of ROADMAP.md
3. Follow all Architecture Rules — they will be checked
4. Run `npm test` and `npm run build` — both must pass
5. Run the self-review checklist
6. Update CHANGELOG.md with what you did
7. Mark the ROADMAP task as done (`[x]`)

### For staff reviews (Opus):

1. Read every source file, not just diffs
2. Check all architecture rules are followed
3. Verify test coverage matches current functionality
4. Check CHANGELOG.md accurately reflects what's in the code
5. Look for drift from OpenQuizzer's design philosophy (event-driven, defensive, readable)
6. Look for: `as any` casts, `chrome.*` in engine, direct API calls outside providers, untyped messages
7. Review AGENTS.md itself — update Lessons Learned, trim cruft
8. Flag anything that needs human decision-making

## Commit Attribution

Include model and tool info. Examples:

```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
Co-Authored-By: GPT 5.4 <noreply@openai.com>
Co-Authored-By: Gemini <noreply@google.com>
```

## Roadmap & Changelog

- `ROADMAP.md` — Future features, organized by priority tier
- `CHANGELOG.md` — Completed work, with version numbers and dates
- Move completed ROADMAP items to CHANGELOG when done
- Update both files at the end of every milestone

## Maintaining This File

**This AGENTS.md is a living document.** At the end of each session or milestone:

1. **Capture insights** — If you learned something reusable, add it to Lessons Learned
2. **Trim cruft** — Remove anything obvious, outdated, or low-value
3. **Refine structure** — If a section is getting unwieldy, reorganize

## Lessons Learned

**Engine design (inherited from OpenQuizzer):**
- Engine emits events with all data the UI needs — UI should never reach back
- Store defensive copies of caller-provided arrays — the caller may mutate the original
- Guard state transitions: `selectOption` only works in `practicing`, `next` only in `answered`
- `serialize()` / `restore()` enable persistence across service worker restarts — restore does NOT emit events

**Chrome extension specifics:**
- Service workers can be killed at any time — persist state to `chrome.storage.local` on every state transition
- Content scripts can't import ES modules directly — esbuild bundles dependencies (like Readability) into the output
- All message types must be in the `Message` union — `as any` casts hide bugs and break the type system
- `chrome.runtime.sendMessage` can fail if the receiver isn't open — always `.catch()` broadcasts
- New provider APIs need matching `host_permissions` entries in `manifest.json` or extension-origin `fetch()` calls will fail at runtime
- If a background feature keeps derived quiz state in memory (not just the engine snapshot), rebuild it from the serialized engine state after service worker restart or follow-up actions will silently break
- For post-quiz actions like review/retry, persist the last completed quiz context separately from the in-progress engine snapshot; completion clears the snapshot but the follow-up UI still needs stable data

**Testing:**
- Factory functions (`mockProblem(id)`) keep tests concise and readable
- The `collectEvents` pattern (register listener, return array, assert after actions) works well for event-driven APIs
- Test through shuffling by reading `engine.currentProblem` — don't assume problem order
- Test serialize/restore round-trips — restored engine should behave identically to the original

**Self-review catches (v0.1.1):**
- Dead variables that were set but never read
- Missing message types in union caused `as any` casts to proliferate
- Premature stub code (OpenQuizzer detector wired with `as any`) — better to leave the module unwired than to add type-unsafe plumbing
- UI state tracking gap (selected option index) caused incorrect answers to not highlight

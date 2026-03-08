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

## Branching & Pull Requests

All changes to `main` require a pull request. No direct commits to `main`.

- **Branch naming:** `feat/`, `fix/`, `chore/` prefixes (e.g., `fix/staff-review-advisory`)
- **Before opening a PR:** run `npm test`, `npm run build`, and the self-review checklist
- **CI runs on every PR:** checkout → Node 20 → `npm ci` → `npm test` → `npm run build` → `npm audit --omit=dev`
- **Branch protection** is configured in the GitHub UI (require PRs, require CI status check)

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
2. Pick a task from the **Task Queue** section of ROADMAP.md (or read `TASK.md` if one was prepared for you)
3. Follow all Architecture Rules — they will be checked
4. Run `npm test` and `npm run build` — both must pass
5. Run the self-review checklist
6. Update CHANGELOG.md with what you did
7. Mark the ROADMAP task as done (`[x]`)
8. Write `HANDOFF.md` in the project root: what was completed, decisions made and why, anything unfinished, gotchas

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
- If a content script depends on a worker asset, bundle that worker explicitly and expose only that file through `web_accessible_resources`; otherwise extension CSP/URL access will break at runtime
- For panel-only interaction polish, reset transient UI state explicitly when views/questions change; hidden DOM from a prior state will otherwise leak into later quiz steps
- If multiple providers parse the same LLM response shape, centralize that normalization in one helper; otherwise feature support like new question types will drift across providers
- For panel features with browser APIs like downloads/Blob URLs, keep the side-effect thin and move filename/serialization logic into a pure helper so it stays testable without DOM harnesses
- Imported local files are untrusted input too: validate them in the background before merging into storage, rather than trusting panel-side parsing alone
- If UI copy documents a shortcut or interaction, verify the behavior exists in code during review; tooltip/help drift is an easy way to ship false affordances
- Global panel shortcuts should only act on visible quiz controls and should ignore focused form/button elements; otherwise hidden views can still consume keys
- Engine restore does not replay events, so extension-level UI derived from engine state (like action badges) needs an explicit resync step on service worker startup
- Settings test actions should use the current form values, not just persisted storage; otherwise "Test Connection" style flows fail on fresh unsaved credentials
- If a provider/API check can fail for multiple external reasons, surface the exact API error in the UI or logs; a generic `Failed` status is not enough to debug real integrations
- After an extension reload, existing tabs may not have a live content script anymore; recover by reinjecting the bundled script on demand instead of assuming the user will refresh the page
- Roadmap defaults for external model names can go stale quickly; verify current provider docs before implementing and prefer current stable models over deprecated ones
- Don’t treat a missing `tab.url` as proof that a normal page is inaccessible; try the recoverable path first and only classify the page as blocked if Chrome rejects injection
- The page being loaded in the browser is not enough by itself; the extension still needs host access to inject/read it, so normal-page recovery may require a runtime per-site permission request
- Optional host permission prompts work more reliably from a direct UI gesture than deep inside an async background recovery path; request site access as early as possible in the user action flow
- If a runtime-injected script bundle depends on module semantics, don’t inject it as a raw file with `executeScript`; use a loader that `import()`s the extension URL instead
- If the same bundle is also declared under `manifest.content_scripts`, it still has to be valid as a classic content script there; otherwise remove the declarative path and rely on the programmatic module attach consistently
- When debugging Chrome extension reload/caching issues, add a short visible version marker to the user-facing error path; it’s faster than guessing which bundle Chrome is actually running
- If per-site host permission requests depend on the current tab URL, make sure the extension can actually read that URL; without `tabs` or equivalent host access, the permission prompt flow can silently fail to target the right origin
- If one dependency forces ESM-only syntax into a content script bundle, split that dependency into a separately loaded module asset instead of forcing the whole content script down the same execution model
- Chrome’s built-in PDF viewer is not a normal injectable page even when the underlying document is just a PDF; detect the viewer URL and operate on the resolved PDF source URL instead
- Local `file://` PDFs are a separate Chrome permission path from web-hosted PDFs; detect them explicitly and show the required `Allow access to file URLs` guidance instead of surfacing a raw fetch failure
- Don’t hard-block local `file://` PDFs based on the URL alone; check `chrome.extension.isAllowedFileSchemeAccess()` and declare the `file://` match pattern in the manifest so enabled file access can actually work
- When a panel action changes quiz state, don’t rely only on a background broadcast to update the UI; follow the action with an explicit state sync so the first question still appears if the broadcast is missed
- MV3 service workers cannot use runtime `import()` the same way page contexts can; if background code needs a module dependency at runtime, bundle it with a static import instead of loading it through `chrome.runtime.getURL(...)`
- If bundled `pdfjs` runs in a service worker with `disableWorker: true`, it may still expect the fake-worker bootstrap path; preload `globalThis.pdfjsWorker.WorkerMessageHandler` to avoid a `workerSrc` requirement in the background context
- If a provider setting exposes selectable models, normalize any stored model name against the current provider on read; stale saved model strings can otherwise break generation long after the UI is updated
- Model-picker defaults are a product choice, not just a technical one; verify current pricing/docs before changing them and prefer exposing cheap fallback options explicitly so users can trade quality for cost themselves
- If metadata like topic tags is generated before quiz completion but saved only at the end, persist it alongside the in-progress quiz snapshot; otherwise service-worker restarts silently drop it
- If quiz state is scoped per tab, the background and panel both need explicit tab-switch resync logic; restoring only the engine snapshot is not enough to make the visible quiz view follow the active tab
- Don’t persist empty per-tab session placeholders; they create dead storage entries and make tab-routing state harder to reason about than storing only ready/in-progress/completed tabs
- For wrapped answer choices, line-height tweaks alone are usually not enough; separate the number badge and option text into their own layout elements so the badge does not distort multi-line text rhythm
- When improving prompt quality, encode the new quality bar in both the system prompt and the user prompt, then bump the prompt version so later question-quality changes are traceable
- If you add a heuristic quality filter for generated questions, keep it provider-agnostic and structural, then give the generator a small over-generation buffer so dropping weak questions does not immediately shrink the final quiz
- If generation can partially succeed before a later chunk fails, preserve the accepted questions and carry an explicit warning through ready-state persistence; otherwise the extension loses a recoverable quiz and the UI can’t explain why the count is short
- If you track question performance across sessions, don’t key it by generated problem ID; build a deterministic hash from normalized question content that stays stable across option shuffles
- Don’t leave service-worker restore as an un-awaited startup side effect if later message handlers depend on restored state; gate message handling on the restore promise or you can compute and persist fresh state against stale in-memory data
- If a panel-only feature depends on saved settings, load those settings before restore/start flows too; wiring them only through the Settings tab can leave the runtime behavior stuck on defaults
- If an action ultimately uses saved background settings, any permission preflight for that action should read the same saved settings source rather than the current form state; otherwise unsaved panel edits can request access to the wrong origin
- If quiz generation can be triggered from outside the panel, the panel should listen for background generation/result/error messages too; otherwise external flows can succeed in the background while the UI stays on a stale screen
- `window.getSelection()` is not always enough for context-menu selection features; keep the context-menu event’s `selectionText` as a fallback before deciding there is no usable selection
- If long-form content needs a section picker, persist that picker state in the tab session like any other quiz state; otherwise the service worker can restart back to idle and strand the user mid-flow
- Heading-aware segmentation is useful, but it needs a deterministic arbitrary-size fallback for flat or oversized content; books and PDFs cannot depend on clean source structure
- If PDF page ranges will matter later, preserve per-page text during extraction instead of flattening immediately; you can always join pages later, but you can’t recover page boundaries once you throw them away
- Once `ExtractedContent` gains nested data like PDF page arrays, review every clone/persist/restore path for shallow-copy bugs
- If a sectioned document can spawn a narrowed section quiz and later return to the broader section picker, keep the original section source separately from the current narrowed extracted content
- For arbitrary fallback chunk labels, assign display names after chunk rebalancing; otherwise merged chunks inherit confusing skipped numbers from their source paragraphs
- PDF front-matter skipping should be heuristic and conservative: scan only the early pages for obvious copyright/edition/contents patterns, then stop as soon as likely body text begins
- If long-form question quality is failing because the correct answer is the only specific option, fix both layers: strengthen the prompt and add a filter for vague distractors/domain-specific answer outliers
- Bibliographic or publication-metadata questions are usually low-value retrieval practice for books/PDFs even when they are “supported” by the text; filtering them explicitly is reasonable
- If a restorable intermediate state can be cancelled, give it an explicit background reset message instead of only hiding it in the panel
- If you generate standalone export HTML, treat embedded quiz text and source URLs as separate risks: JSON/script embedding needs script-safe escaping, and clickable links still need scheme sanitization
- If a panel feature introduces a new message payload branch, add pure tests for the payload-construction helper as well as any downstream content helper; otherwise the visible feature can work in one path while the actual request shape goes unverified
- If a long-form section quiz needs completion credit later, persist the selected section index separately from the narrowed extracted content; the subsection payload alone is not enough to identify the parent section reliably on restore/complete
- If a picker view shows derived progress data, rebuild or persist that annotated view consistently through one helper; otherwise freshly generated picker state and restored picker state will drift
- If a completed-score feature needs to export quiz content, prefer the stable completed quiz snapshot over mutable current-problem state; otherwise retries or narrowed follow-up flows can export the wrong quiz
- If users can guess the answer because it is the only long, clause-heavy, or highly specific option, the existing length-outlier heuristic is not enough; add a second structural check for a uniquely longest and more detailed correct answer
- Front-matter suppression for books/PDFs works best in two layers: skip obvious praise/preface/copyright pages early in PDF segmentation, and still reject surviving front-matter questions structurally after generation
- Provider schemas and TypeScript types are not enough to trust runtime model JSON; parsing/normalization helpers still need explicit guards before touching nested fields like `options.length`
- If persistent progress records are smaller than the live UI section shape, merge progress onto the full `ContentSection` instead of reusing the storage shape directly; otherwise view-only fields like `preview` or page ranges get lost and the panel can crash
- Resume/progress lookup for PDFs should key off the resolved PDF source URL, not the Chrome viewer wrapper URL, or “continue where I left off” will fail on documents that were already tracked
- If an idle panel can show document-specific resume UI, explicitly clear that state when a tab has no tracked document; otherwise resume cards can leak across tab switches
- Document-library state should come from document-progress storage, not quiz history; history is session-oriented, while resumable long-form reading state is document-oriented
- If a panel action needs to open a tracked document and immediately show resume state, reusing the active tab works better with side-panel restore logic than opening a separate tab and leaving the panel on the old one

**Testing:**
- Factory functions (`mockProblem(id)`) keep tests concise and readable
- The `collectEvents` pattern (register listener, return array, assert after actions) works well for event-driven APIs
- Test through shuffling by reading `engine.currentProblem` — don't assume problem order
- Test serialize/restore round-trips — restored engine should behave identically to the original

**Staff review catches (2026-03-07):**
- Every `response.json()` for a typed API needs a local response type; untyped `.json()` return is implicitly `any` and infects downstream code
- Heterogeneous event emitter maps can use `Listener<never>` for storage to avoid `any`; type safety lives at the `on`/`off`/`emit` API boundary, with a safe cast only inside `#emit`
- MV3 extensions should always have an explicit `content_security_policy` even though Chrome provides a strict default; it makes the security contract visible and prevents accidental relaxation
- Acknowledge responses like `{ type: 'ok' }` from message handlers must be in the `Message` union or they silently bypass exhaustive type checking
- `JSON.parse` of untrusted page data (e.g., OpenQuizzer detection) needs runtime shape validation, not just an `any` cast; pages can inject arbitrary JSON

**Self-review catches (v0.1.1):**
- Dead variables that were set but never read
- Missing message types in union caused `as any` casts to proliferate
- Premature stub code (OpenQuizzer detector wired with `as any`) — better to leave the module unwired than to add type-unsafe plumbing
- UI state tracking gap (selected option index) caused incorrect answers to not highlight

# PageQuizzer Agent Instructions

Guidance for agents working on this repository.

## Project Overview

**PageQuizzer** is a Chrome extension that generates quiz questions from any web page for retrieval practice. It uses LLM APIs to create multiple-choice questions from extracted page content. The quiz engine is designed as a shared core module (`src/engine/`) that can be consumed by other implementations (OpenQuizzer, future iOS app, etc.).

## Architecture

- All LLM calls go through `src/providers/` — no direct API calls elsewhere
- Prompts live in `src/prompts/` — one file per feature, versioned, tested
- Engine (`src/engine/`) has zero Chrome API dependencies — it's the shared core
- Content extraction is isolated from quiz generation
- No provider-specific code outside `src/providers/`
- Message-passing protocol between Chrome contexts (see `src/shared/messages.ts`)

**Engine/UI boundary:** The engine emits events with all data the panel needs to render. The panel should never need to reach back into the engine for display info.

**Readability is a nonfunctional requirement.** Code should be legible to humans, weaker models, and future maintainers without needing the full project context. Use descriptive names, section comments, labeled branches, and avoid single-letter variables outside tight loops. When in doubt, a short comment is better than making the reader trace through code.

## Development

**Build:** `npm run build` — esbuild compiles all targets. `npm run build:watch` for watch mode.

**Tests:** `npm test` — Vitest with TypeScript support. Run tests after any engine, provider, or prompt changes.

**Testing philosophy (Goldilocks):** Write meaningful tests that verify important behavior and prevent regressions. Good targets: state machine transitions, grading correctness, prompt template output shape, provider abstraction contract. Use `mockProblem(id)` factory functions and the `collectEvents(engine, event)` pattern.

**Conventions:**
- TypeScript strict mode
- ES module format throughout
- Defensive copies of caller-provided data
- Private fields (`#field`) for engine internals

## Self-Review Loop

After completing each milestone, switch to a **reviewer role** and critique your own work harshly. Look for:

- Bugs in engine logic (grading, state transitions, edge cases)
- Dead code or unused fields after refactors
- API surface that doesn't match what the UI actually needs
- Missing test coverage for new functionality
- Chrome extension gotchas (service worker lifecycle, message passing, CSP)
- Security: API keys handled safely, no XSS in rendered content, CSP compliance
- Readability: descriptive names, section comments, labeled branches, no walls of undifferentiated code

Fix issues. Review again. **Iterate until the reviewer finds nothing significant.**

**Escape hatch:** If the same issue recurs or you're uncertain, flag it for human review and move on.

## Commit Attribution

```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

If not all attribution details are available, include the best available information.

## Roadmap & Changelog

Future features are tracked in `ROADMAP.md`. Completed work is recorded in `CHANGELOG.md`.

## Maintaining This File

**This AGENTS.md is a living document.** At the end of each session or milestone:

1. **Capture insights** — If you learned something reusable, add it to Lessons Learned.
2. **Trim cruft** — Remove anything obvious, outdated, or low-value.
3. **Refine structure** — If a section is getting unwieldy, reorganize.

## Lessons Learned

Insights captured from development:

**Engine design (inherited from OpenQuizzer):**
- Engine emits events with all data the UI needs — UI should never reach back into the engine
- Store defensive copies of caller-provided arrays — the caller may mutate the original
- Guard state transitions: `selectOption` only works in `practicing`, `next` only in `answered`

**Testing:**
- Factory functions (`mockProblem(id)`) keep tests concise and readable
- The `collectEvents` pattern (register listener, return array, assert after actions) works well for event-driven APIs
- Test through shuffling by reading `engine.currentProblem` — don't assume problem order

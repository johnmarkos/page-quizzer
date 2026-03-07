# PageQuizzer Agent Instructions

## Architecture
- All LLM calls go through `src/providers/` — no direct API calls elsewhere
- Prompts live in `src/prompts/` — one file per feature, versioned, tested
- Engine (`src/engine/`) has zero Chrome API dependencies — it's the shared core
- Content extraction is isolated from quiz generation
- No provider-specific code outside `src/providers/`

## Testing
- Tests required for engine, providers, and prompt output validation
- Use factory functions: `mockProblem(id)`, `collectEvents(engine, event)`
- Run: `npm test`

## Building
- `npm run build` — esbuild compiles all targets
- `npm run build:watch` — watch mode

## Conventions
- TypeScript strict mode
- ES module format throughout
- Message-passing protocol between Chrome contexts (see `src/shared/messages.ts`)
- Self-review after each phase: readability, test coverage, convention adherence

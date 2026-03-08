# Handoff

## Completed

- Finished `S2: Keyboard shortcut help`
- Added a `?` tooltip in the quiz question header
- Added `S` as a skip shortcut
- Scoped keyboard shortcuts to visible quiz controls so hidden History/Settings views cannot trigger quiz actions
- Made the tooltip text reflect the active question shape (`1-2` for true/false, `1-4` for four-option questions)

## Decisions

- Moved shortcut copy and key-mapping rules into `src/panel/keyboard-shortcuts.ts` so the tooltip text and keyboard behavior share one source of truth
- Kept DOM side effects in `panel.ts` and tested the new shortcut logic through pure helper tests instead of introducing a DOM test harness
- Ignored shortcuts when focus is inside interactive controls to avoid hijacking Enter or character keys from buttons and form fields

## Validation

- `npm test` passed with 53/53 tests
- `npm run build` passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Gotchas

- The panel keeps quiz DOM mounted when switching nav tabs, so global keyboard handlers must check visibility instead of assuming hidden views are inert

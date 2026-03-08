# Handoff

## Completed

- Reworked the runtime content-script attach path to load the content script via dynamic module import instead of raw file injection
- Removed the `executeScript({ files: ["dist/content.js"] })` path that was causing `import.meta` parsing failures during recovery

## Decisions

- Kept the content-script bundle in module-oriented build output and changed the attach mechanism instead of trying to force the bundle into classic-script semantics
- Used a small injected loader function with a per-tab global promise so repeated recovery attempts do not re-import the module unnecessarily

## Validation

- `npm test` passed with 66/66 tests
- `npm run build` passed

## Gotchas

- A bundle can be fine when loaded through one extension path and still fail when injected another way if the execution context changes from module to classic script

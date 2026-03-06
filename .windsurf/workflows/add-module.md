---
description: Checklist for adding a new utility or module to stream-chain
---

# Add a New Module

Follow these steps when adding a new utility function or module.

## Utility function (e.g., `src/utils/foo.js`)

1. Create `src/utils/foo.js` with the implementation.
   - CommonJS (`module.exports`). Use `require()` for imports.
   - No runtime dependencies — only require from `node:` or other `src/` modules.
   - Return a function suitable for use in `chain()`.
   - Use special values from `src/defs.js` (`none`, `stop`, `many`, `flushable`) as needed.
2. Create `src/utils/foo.d.ts` with hand-written TypeScript declarations.
   - Keep the `.js` and `.d.ts` files in sync.
3. Create `tests/test-foo.mjs` with automated tests (tape-six, ESM):
   - Import the utility and `chain` from `stream-chain`.
   - Test normal operation, edge cases, and interaction with `chain()`.
   // turbo
4. Run the new test: `node tests/test-foo.mjs`
5. Create `wiki/utils.md` entry or a separate wiki page with usage documentation.
6. Add a link in `wiki/Home.md` under the appropriate section.
7. Update `ARCHITECTURE.md` — add the utility to the project layout tree.
8. Update `llms.txt` and `llms-full.txt` with a description and example.
9. Update `AGENTS.md` if the architecture quick reference needs updating.
   // turbo
10. Verify: `npm test`
    // turbo
11. Verify: `npm run ts-check`
    // turbo
12. Verify: `npm run lint`

## Top-level module (e.g., `src/foo.js`)

1. Create `src/foo.js` with the implementation.
   - CommonJS (`module.exports`). Use `require()` for imports.
   - No runtime dependencies.
2. Create `src/foo.d.ts` with hand-written TypeScript declarations.
3. If the module should be re-exported from `src/index.js`:
   - Add `module.exports.foo = require('./foo');` to `src/index.js`.
   - Add the corresponding export and types to `src/index.d.ts`.
4. Create `tests/test-foo.mjs` with automated tests.
   // turbo
5. Run the new test: `node tests/test-foo.mjs`
6. Create a wiki page (e.g., `wiki/foo.md`) with usage documentation.
7. Add a link in `wiki/Home.md`.
8. Update `ARCHITECTURE.md` — add to project layout and dependency graph.
9. Update `llms.txt` and `llms-full.txt`.
10. Update `AGENTS.md` if the architecture quick reference needs updating.
    // turbo
11. Verify: `npm test`
    // turbo
12. Verify: `npm run ts-check`
    // turbo
13. Verify: `npm run lint`

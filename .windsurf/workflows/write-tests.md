---
description: Write or update tape-six tests for a module or feature
---

# Write Tests

Write or update tests using the tape-six testing library.

## Steps

1. Read `node_modules/tape-six/TESTING.md` for the full tape-six API reference (assertions, hooks, patterns, configuration).
2. Identify the module or feature to test. Read its source code to understand the public API.
3. Check existing tests in `tests/` for stream-chain conventions and patterns.
4. Create or update the test file in `tests/`:
   - For runtime tests use `.mjs`, for typing tests use `.mts`, for CommonJS tests use `.cjs`.
   - Import the module under test with relative paths: `import chain from '../src/index.js';`
   - For stream tests, collect output with `pipeline.on('data', ...)` and verify in `pipeline.on('end', ...)`.
   - Use `tests/helpers.mjs` utilities: `streamToArray()`, `readString()`, `writeToArray()`, `delay()`.
   // turbo
5. Run the new test file directly to verify: `node tests/test-<name>.mjs`
   // turbo
6. Run the full test suite to check for regressions: `npm test`
   - If debugging, use `npm run test:seq` (runs sequentially, easier to trace issues).
7. Report results and any failures.

## stream-chain conventions

- Test file naming: `test-*.*js` and `test-*.*ts` in `tests/`.
- Runtime tests (`.mjs`): ESM imports, `import test from 'tape-six'`.
- TypeScript typing tests (`.mts`): verify type declarations and type-safe API usage. See `tests/test-typings-*.mts`.
- CommonJS tests (`.cjs`): `const {test} = require('tape-six');`. See `tests/test-cjs.cjs`.
- Existing tests use `test.asPromise('name', (t, resolve) => { ... })` for stream-based tests. New tests may also use `async t => { ... }` when appropriate.
- Tests run on Node, Bun, and Deno.

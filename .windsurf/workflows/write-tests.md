---
description: Write or update tape-six tests for a module or feature
---

# Write Tests

Write or update tests using the tape-six testing library.

## Notes

- Tests use `tape-six`: `.mjs` for runtime tests, `.mts` for TypeScript typing tests, `.cjs` for CommonJS tests.
- The default `tape6` runner uses worker threads for parallel execution. `tape6-seq` runs sequentially in-process — useful for debugging or when tests share state.
- Tests run on Node, Bun, and Deno.
- Test file naming convention: `test-*.*js` and `test-*.*ts` in the `tests/` directory.
- See existing tests (e.g., `tests/test-simple.mjs`) for patterns specific to stream-chain.
- TypeScript typing tests (`.mts`) verify type declarations and demonstrate type-safe API usage. See `tests/test-typings-*.mts`.
- CommonJS test (`test-cjs.cjs`) demonstrates `require()` usage. Import tape-six via `const {test} = require('tape-six');`.
- Common test helper: `tests/helpers.mjs` provides `delay()` and `readArray()`.

## Steps

1. Identify the module or feature to test. Read its source code to understand the public API.
2. Create or update the test file in `tests/`:
   - For runtime tests use `.mjs`, for typing tests use `.mts`, for CommonJS tests use `.cjs`.
   - Import `test` from `tape-six`: `import test from 'tape-six';`
   - Import the module under test with relative paths: `import chain from '../src/index.js';`
   - Import `{Readable}` from `'node:stream'` for creating test data sources.
   - Write one top-level `test()` per logical group.
   - Use embedded `await t.test()` for sub-cases.
   - Cover: normal operation, edge cases, error conditions.
   - Use `t.equal` for primitives, `t.deepEqual` for objects/arrays.
   - For stream tests, collect output with `pipeline.on('data', ...)` and verify in `pipeline.on('end', ...)`.
   - All `msg` arguments are optional but recommended for clarity.
   // turbo
3. Run the new test file directly to verify: `node tests/test-<name>.mjs`
   // turbo
4. Run the full test suite to check for regressions: `npm test`
   - If debugging, use `npm run test:seq` (runs sequentially, easier to trace issues).
5. Report results and any failures.

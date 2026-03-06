---
description: Write or update tape-six tests for a module or feature
---

# Write Tests

Write or update tests using the tape-six testing library.

## Notes

- Tests are ESM files (`.mjs`) even though source is CommonJS.
- The default `tape6` runner uses worker threads for parallel execution. `tape6-seq` runs sequentially in-process — useful for debugging or when tests share state.
- Tests run on Node, Bun, and Deno.
- Test file naming convention: `test-*.mjs` in the `tests/` directory.
- See existing tests (e.g., `tests/test-simple.mjs`) for patterns specific to stream-chain.
- Common test helper: `tests/helpers.mjs` provides `delay()` and `readArray()`.

## Steps

1. Identify the module or feature to test. Read its source code to understand the public API.
2. Create or update the test file in `tests/test-<name>.mjs`:
   - Import `test` from `tape-six`: `import test from 'tape-six';`
   - Import the module under test: `import chain from 'stream-chain';` or `import foo from 'stream-chain/utils/foo.js';`
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

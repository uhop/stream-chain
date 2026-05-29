# AGENTS.md — stream-chain

> `stream-chain` creates a chain of streams out of regular functions, asynchronous functions, generators, Node streams, and Web streams, with proper per-item backpressure. The default chain returns a Node `Duplex`; subpath variants run natively on Web Streams (`stream-chain/web`) or pure async iterables (`stream-chain/core`). Zero runtime dependencies.

For project structure, module dependencies, and the architecture overview see [ARCHITECTURE.md](./ARCHITECTURE.md).
For detailed usage docs and API references see the [wiki](https://github.com/uhop/stream-chain/wiki).
For migrating from 3.x see [Migration-V3-to-V4](https://github.com/uhop/stream-chain/wiki/Migration-V3-to-V4).

## Setup

This project uses a git submodule for the wiki:

```bash
git clone --recursive https://github.com/uhop/stream-chain.git
cd stream-chain
npm install
```

## Commands

- **Install:** `npm install`
- **Test:** `npm test` (runs `tape6 --flags FO`)
- **Test (Bun):** `npm run test:bun`
- **Test (Deno):** `npm run test:deno`
- **Test (sequential):** `npm run test:seq` (also `test:seq:bun`, `test:seq:deno`)
- **Test (browser):** `npm run test:browser` — drives headless Chromium via `tape-six-playwright`; auto-starts `tape6-server` on port `55555` (env-overridable, avoids the default `3000` collision). Browser-safe test set is selected by `tape6.tests` (`tests/core/` + `tests/web/`); `tape6.cli` (`tests/node/`) is skipped in browser context. On Ubuntu 26.04+ (or any distro Playwright doesn't ship binaries for yet) `npm install`'s postinstall fails downloading Chromium — work around once with `npm install --ignore-scripts` then `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium`. Override is install-time only; runtime needs no env.
- **Test (single file):** `node tests/<bucket>/test-<name>.js` (bucket is `core`, `web`, or `node`)
- **TypeScript check:** `npm run ts-check`
- **JavaScript type check (dual tsconfig):** `npm run js-check`
- **TypeScript tests:** `npm run ts-test` (also `ts-test:bun`, `ts-test:deno`)
- **Bench:** `npm run bench -- bench/<name>.js`
- **Lint:** `npm run lint` (Prettier check)
- **Lint fix:** `npm run lint:fix` (Prettier write)

## Project structure

```
stream-chain/
├── package.json                  # Package config; "tape6" section configures test discovery
├── src/                          # Source code
│   ├── index.js                  # /node entry: chain() factory + asStream + asWebStream + gen + re-exports
│   ├── index.d.ts                # TypeScript definitions for the /node public API
│   ├── defs.js                   # Special values (none, stop, many, finalValue, flushable, etc.) + Web/Node stream type guards
│   ├── defs.d.ts                 # TypeScript definitions for defs
│   ├── exec.js                   # Shared sync-when-possible value-or-promise executor (engine behind gen/fun/asStream/asWebStream)
│   ├── exec.d.ts
│   ├── gen.js                    # Push→pull async-generator bridge over exec (gen.next legacy trampoline kept for compat)
│   ├── gen.d.ts
│   ├── fun.js                    # Creates function pipeline from functions (sync-first; collects via exec.next; exported via /web and /core)
│   ├── fun.d.ts
│   ├── dataSource.js             # Coerces a function or iterable to an iterator-producing function (substrate-agnostic)
│   ├── dataSource.d.ts
│   ├── asStream.js               # Wraps a function as a Node Duplex with per-item backpressure
│   ├── asStream.d.ts
│   ├── asWebStream.js            # Wraps a function as a Web Streams {readable, writable} duplex pair
│   ├── asWebStream.d.ts
│   ├── typed-streams.js          # TypeScript helpers: TypedReadable, TypedWritable, TypedDuplex, TypedTransform
│   ├── typed-streams.d.ts
│   ├── node/                     # Subpath: stream-chain/node — canonical Node Streams chain (re-export of root)
│   │   ├── index.js
│   │   └── index.d.ts
│   ├── web/                      # Subpath: stream-chain/web — native Web Streams chain (no node:stream)
│   │   ├── index.js              # chain() over {readable, writable} duplex pairs
│   │   └── index.d.ts
│   ├── core/                     # Subpath: stream-chain/core — substrate-free async-iterable chain
│   │   ├── index.js              # chain() returning a callable async-generator factory
│   │   └── index.d.ts
│   ├── jsonl/                    # JSONL (line-separated JSON) support
│   │   ├── parser.js             # JSONL parser function (returns gen() pipeline)
│   │   ├── parser.d.ts
│   │   ├── parserStream.js       # JSONL parser as a Node Duplex
│   │   ├── parserStream.d.ts
│   │   ├── parserWebStream.js    # JSONL parser as a Web Streams duplex pair
│   │   ├── parserWebStream.d.ts
│   │   ├── stringerStream.js     # JSONL stringer as a Node Transform
│   │   ├── stringerStream.d.ts
│   │   ├── stringerWebStream.js  # JSONL stringer as a Web Streams TransformStream
│   │   └── stringerWebStream.d.ts
│   └── utils/                    # Utility functions
│       ├── take.js               # Take N items from stream
│       ├── takeWhile.js          # Take items while condition is true
│       ├── takeWithSkip.js       # Skip then take
│       ├── skip.js               # Skip N items
│       ├── skipWhile.js          # Skip items while condition is true
│       ├── fold.js               # Reduce/fold stream to single value
│       ├── reduce.js             # Alias for fold
│       ├── scan.js               # Running accumulator (like fold but emits each step)
│       ├── batch.js              # Group items into fixed-size arrays
│       ├── readableFrom.js       # Convert iterable to Node Readable stream
│       ├── readableWebStreamFrom.js  # Convert iterable to Web Streams ReadableStream
│       ├── reduceStream.js       # Reduce as a Node Writable stream (.accumulator)
│       ├── reduceWebStream.js    # Reduce as a Web WritableStream ({writable, result, accumulator})
│       ├── fixUtf8Stream.js      # Fix multi-byte UTF-8 splits across chunks
│       ├── lines.js              # Split byte stream into lines
│       ├── streamPuller.js       # Wrap Node Readable as a non-destructive async iterator
│       ├── webStreamPuller.js    # Wrap Web ReadableStream as a non-destructive async iterator
│       └── *.d.ts                # TypeScript definitions for each utility
├── tests/                        # Test files organized by environment (see "Tests" below)
│   ├── core/                     # Substrate-agnostic — runs in browser AND CLI (uses /web chain internally)
│   ├── web/                      # Web Streams — runs in browser AND CLI
│   ├── node/                     # Node Streams / node:* APIs — runs only in CLI
│   ├── helpers.js                # Node-stream test helpers (Readable/Writable factories) — re-exports web-helpers
│   ├── web-helpers.js            # Pure + Web Streams helpers (delay, webStreamToArray, writeAndCollect, runChain)
│   ├── data/                     # Test fixtures (referenced by tests/node/test-jsonl-*.js)
│   └── manual/                   # Manual test scripts (not part of the automated suite)
├── bench/                        # Benchmarks
├── wiki/                         # GitHub wiki documentation (git submodule)
└── .github/                      # CI workflows, Dependabot config
```

## Code style

- **ESM throughout** (`"type": "module"` in package.json). Source uses `import` syntax.
- **No transpilation** — code runs directly.
- **Prettier** for formatting (see `.prettierrc`): 100 char width, single quotes, no bracket spacing, no trailing commas, arrow parens "avoid".
- 2-space indentation.
- Semicolons are enforced by Prettier (default `semi: true`).
- All public modules declare both `export default X` and `export {X}` for the same value (default = ESM DX, named = CJS destructure + cleaner re-exports). See [fleet slice 17](https://github.com/uhop/claude-config/blob/master/topics/esm-default-export-with-named-mirror.md).
- `// @ts-self-types="./<file>.d.ts"` directive at the top of every `.js`; JSDoc lives in the paired `.d.ts`, not in `.js`.
- The package is `stream-chain`. Internal symbols use `Symbol.for('object-stream.*')`.

## Critical rules

- **Zero runtime dependencies.** Never add packages to `dependencies`. Only `devDependencies` are allowed.
- **Do not modify or delete test expectations** without understanding why they changed.
- **Do not add comments or remove comments** unless explicitly asked.
- **Keep `src/index.js` and `src/index.d.ts` in sync.** All public API is exported from `index.js` and typed in `index.d.ts`.
- **Keep `.js` and `.d.ts` files in sync** for all modules under `src/`.
- **Object mode by default.** `chain()` (the /node variant) defaults to `{writableObjectMode: true, readableObjectMode: true}`.
- **Per-item backpressure must be preserved.** `asStream` and `asWebStream` drive the shared executor (`exec.next` / `exec.flush`), whose `push` return is honored: when an enqueue backpressures it returns a Promise and the executor suspends _at that push_, resuming on drain. Keeps the queue at hwm+1 under unbounded `many()`/generator expansion, with O(1) live allocation (one resume closure per actual suspension, not per element). Do not change the executor to ignore the `push` return or to eagerly chain per element.
- **Generators yield plain values.** Generators (sync `function*`, async `async function*`) must NOT yield `defs.none`, `defs.stop`, `defs.many(...)`, or `defs.finalValue(...)` — those special markers are for regular function returns only. See [wiki/defs.md](https://github.com/uhop/stream-chain/wiki/defs#convention-generators-yield-plain-values).
- **`chain.asStream` / `chain.gen` are override hooks** — internal references go through the static-property indirection so users can monkey-patch. Don't refactor to direct imports.

## Architecture

- `chain(fns, options)` is the main entry point (default = /node). Returns a Node `Duplex` with `.streams`, `.input`, `.output` properties.
- `stream-chain/web` exposes a parallel `chain()` that returns `{readable, writable, streams, input, output}` — a native Web Streams duplex pair.
- `stream-chain/core` exposes a callable async-iterable factory — no Node streams, no Web Streams. Browser-safe and substrate-free. Input handling: `null`/`undefined` → empty; strings and other non-iterables (numbers, booleans, plain objects, …) → passed through as a single value; arrays / generators / async iterables / Maps / Sets → iterated.
- Functions in a chain are grouped together via `gen()` for efficiency (unless `noGrouping: true`).
- `exec(...fns)` (`src/exec.js`) is the shared **sync-when-possible, value-or-promise executor** — the single engine behind `gen`, `fun`, `asStream`, and `asWebStream` (it replaced the old per-wrapper `async applyFns`). It threads a value through the function-list, emits terminal values via a `push` callback, and stays synchronous until the first real promise (async stage, thenable, or backpressuring push) appears. Internal — not a public export.
- `gen(...fns)` creates an async generator pipeline — a push→pull bridge over `exec.next`. Handles all special return values from regular functions: `none`, `stop`, `many()`, `finalValue()`, flushable.
- `fun(...fns)` creates a function pipeline (sync when possible). Collects all outputs into a `Many` per input, so memory scales with output size — **not safe for unbounded pipelines**. Intentionally NOT on the default `stream-chain` / `/node` export; requires an explicit import from `stream-chain/fun.js` (also re-exported via `/web` and `/core`). The friction is deliberate.
- `asStream(fn[, options])` wraps a function as a Node `Duplex` with per-item backpressure.
- `asWebStream(fn[, options])` wraps a function as a Web Streams `{readable, writable}` pair with per-item backpressure.
- Special return values are defined in `defs.js`: `none` (skip), `stop` (terminate), `many(values)` (emit multiple), `finalValue(value)` (skip rest of chain), `flushable(fn)` (called at stream end).
- Web Streams type guards (`isReadableWebStream`, `isWritableWebStream`, `isDuplexWebStream`) live in `defs.js` and are re-exported from `index.js` and `web/index.js`.
- The `/node` chain adapts Web Stream objects to Node streams via `Readable.fromWeb()` / `Writable.fromWeb()` / `Duplex.fromWeb()` with `{objectMode: true}`. The `/web` chain handles them natively.
- JSONL support is in `src/jsonl/` — parser and stringer for line-separated JSON. Parser emits `{key, value}` per line; empty lines are dropped. Error handling: `ignoreErrors: true` drops failed lines but the counter still bumps (gappy keys; back-compat); `errorIndicator` (presence-checked option — `errorIndicator: undefined` is meaningful) substitutes a value or calls a function `(error, input, reviver) => unknown` whose `undefined` return drops without bumping the counter. Stream wrappers (`parserStream`, `parserWebStream`) forward both. Raw export: `jsonlParser` (per-line factory, no `fixUtf8Stream`/`lines` front). Function-pipeline stringer lives at `src/jsonl/stringer.js` (flushable); `stringerStream` / `stringerWebStream` keep their Transform / TransformStream shapes. Factory-bundled entries at `src/{node,web}/jsonl/{parser,stringer}.js` carry `.asStream` / `.asWebStream` methods (Web entries omit `.asStream` to stay browser-safe); the `src/{node,web}/jsonl/index.js` barrels export `{jsonlParser, jsonlStringer}` (resolvable as `stream-chain/node/jsonl` / `stream-chain/web/jsonl` via package `exports`). They exist so stream-json's deprecated JSONL users can migrate imports to stream-chain with unchanged call sites.
- File-edge JSONL components in `src/jsonl/file/` (Node-only): `parseFile(options)` returns `gen(asyncBlockReader, parser)`; `stringerToFile(path, options)` returns `gen(stringer, asyncBlockWriter)`. Drive with `pipe(...)` + `drain(...)` (from `src/utils/`) so the writer's flushable closes the file. Block-I/O primitives `asyncBlockReader` / `asyncBlockWriter` and the substrate-free helpers `pipe` / `drain` live in `src/utils/`. Round-trip is ~40% faster than the equivalent `fs streams + parserStream + stringerStream` pipeline; pure parse-and-count via for-await is slower (per-token gen-bridge cost) — see `bench/jsonl-file.js`.
- Utility functions in `src/utils/` provide common stream operations: slicing (`take`, `skip`), folding (`fold`, `scan`), batching, line splitting, UTF-8 fixing, and async-iterator wrappers (`makeStreamPuller`, `makeWebStreamPuller`).

## Writing tests

```js
import test from 'tape-six';
import chain from 'stream-chain';
import {Readable} from 'node:stream';

test('example', async t => {
  const output = [];
  const pipeline = chain([x => x * x]);

  const source = new Readable({objectMode: true, read() {}});
  source.pipe(pipeline);
  pipeline.on('data', chunk => output.push(chunk));
  pipeline.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
  });

  source.push(1);
  source.push(2);
  source.push(3);
  source.push(null);
});
```

- Test files use `tape-six`: `.js` for runtime tests, `.ts` for TypeScript typing tests, `.cjs` for CommonJS tests.
- Test file naming convention: `test-*.js` and `test-*.ts`.
- Tests are configured in `package.json` under the `"tape6"` section. Three buckets (per the user's environment-by-directory convention):
  - `tests/core/` — substrate-agnostic. Use the `runChain(transducers, input) → Promise<output>` helper from `tests/web-helpers.js`, which internally drives a `/web` chain. Runs in browser AND CLI (Web Streams are universal in Node 22+/Deno/Bun).
  - `tests/web/` — Web Streams substrate (`asWebStream`, `/web` chain, `webStreamPuller`). Runs in browser AND CLI.
  - `tests/node/` — Node Streams substrate (`asStream`, JSONL via `node:fs` + `node:zlib`, `streamPuller`, etc.). Runs only in CLI. Anything that imports `node:*` or transitively pulls `tests/helpers.js`'s `Readable`/`Writable` factories belongs here.
  - `tape6.tests` = `tests/core` + `tests/web` (both buckets — browser-runnable). `tape6.cli` = `tests/node` (added only in non-browser context per `tape-six`'s `resolveTests` rules — see `node_modules/tape-six/TESTING.md` §"Configuring test discovery").
- Test files should be directly executable: `node tests/<bucket>/test-foo.js`.

## Key conventions

- Do not add dependencies unless absolutely necessary — the library is intentionally zero-dependency.
- All public API is exported from `src/index.js` and typed in `src/index.d.ts`. Keep them in sync.
- Wiki documentation lives in the `wiki/` submodule.
- Symbols use the `object-stream` namespace: `Symbol.for('object-stream.none')`, etc.
- The library is ESM. CJS consumers use destructure: `const {chain} = require('stream-chain')`. The bare-callable `const chain = require('stream-chain')` form from 3.x is gone.
- Supported Node majors: 22, 24, 26 (latest minor of each).

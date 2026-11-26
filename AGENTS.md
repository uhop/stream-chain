# AGENTS.md — stream-chain

> `stream-chain` creates a chain of streams out of regular functions, asynchronous functions, generators, Node streams, and Web streams, with per-item backpressure. The default chain returns a Node `Duplex`; subpath variants run natively on Web Streams (`stream-chain/web`) or pure async iterables (`stream-chain/core`). Zero runtime dependencies.

For project structure, module dependencies, and the architecture overview, see [ARCHITECTURE.md](./ARCHITECTURE.md).
For usage docs and API references, see the [wiki](https://github.com/uhop/stream-chain/wiki).
For migrating from 3.x, see [Migration-V3-to-V4](https://github.com/uhop/stream-chain/wiki/Migration-V3-to-V4).

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
- **Test (browser):** `npm run test:browser` — drives headless Chromium through `tape-six-puppeteer` and auto-starts `tape6-server` on port `55555` (env-overridable; the default `3000` collides). `tape6.tests` (`tests/core/` + `tests/web/`) selects the browser-safe tests; `tape6.cli` (`tests/node/`) is skipped in a browser. Nothing downloads at install time: `.npmrc` sets `ignore-scripts=true`, which blocks the `tape-six-puppeteer` / `puppeteer` postinstalls on every npm version, and `.puppeteerrc.cjs` sets `skipDownload`. Don't swap it for `allowScripts` in `package.json`: that field needs npm 11.16+, the npm 10.9 that Node 22 bundles ignores it, and CI still tests Node 22. The browser resolves from the puppeteer cache (one-time `npm run browser:install`) or `PUPPETEER_EXECUTABLE_PATH`.
- **Test (single file):** `node tests/<bucket>/test-<name>.js` (bucket is `core`, `web`, or `node`)
- **TypeScript check:** `npm run ts-check`
- **JavaScript type check (dual tsconfig):** `npm run js-check`
- **TypeScript tests:** `npm run ts-test` (also `ts-test:bun`, `ts-test:deno`)
- **Bench:** `npm run bench -- bench/<name>.js`
- **Lint:** `npm run lint` (Prettier check)
- **Lint fix:** `npm run lint:fix` (Prettier write)

## Project structure

The full tree is in [ARCHITECTURE.md § Project layout](./ARCHITECTURE.md#project-layout). Source is in `src/` (the subpath entries in `src/node/`, `src/web/`, and `src/core/`, JSONL in `src/jsonl/`, utilities in `src/utils/`), tests in `tests/` (see [Writing tests](#writing-tests)), benchmarks in `bench/`, and the wiki submodule in `wiki/`.

## Code style

- **ESM throughout** (`"type": "module"` in package.json). Source uses `import` syntax.
- **No transpilation** — code runs directly.
- **Prettier** for formatting (see `.prettierrc`): 100 char width, single quotes, no bracket spacing, no trailing commas, arrow parens "avoid".
- 2-space indentation.
- Semicolons are enforced by Prettier (default `semi: true`).
- All public modules declare both `export default X` and `export {X}` for the same value.
- `// @ts-self-types="./<file>.d.ts"` directive at the top of every `.js`; JSDoc lives in the paired `.d.ts`, not in `.js`.
- The package is `stream-chain`. Every symbol, public or internal, is `Symbol.for('object-stream.<name>')`, never `Symbol()`: another library can then follow stream-chain's protocol by defining the same well-known symbol, without depending on stream-chain to import it. Recognize a `Stop` with `defs.isStop()`, never `instanceof`, for the same reason: a compatible library marks its own error class with `stopErrorSymbol`, which `isStop()` checks.

## Critical rules

- **Zero runtime dependencies.** Never add packages to `dependencies`. Only `devDependencies` are allowed.
- **Do not modify or delete test expectations** without understanding why they changed.
- **Comments are short _why_-markers only** — a non-trivial decision or constraint, or an algorithm reference; never narrate _what_ the code does.
- **Keep `src/index.js` and `src/index.d.ts` in sync.** All public API is exported from `index.js` and typed in `index.d.ts`.
- **Keep `.js` and `.d.ts` files in sync** for all modules under `src/`.
- **Object mode by default.** `chain()` (the /node variant) defaults to `{writableObjectMode: true, readableObjectMode: true}`.
- **Per-item backpressure must be preserved.** `asStream` and `asWebStream` drive the shared executor (`exec.next` / `exec.flush`), whose `push` return is honored: when an enqueue backpressures, it returns a Promise and the executor suspends _at that push_, resuming on drain. This keeps the queue at hwm+1 under unbounded `many()` or generator expansion, with O(1) live allocation (one resume closure per actual suspension, not per element). Don't change the executor to ignore the `push` return or to chain eagerly per element.
- **Source generators must be released on abnormal termination.** When iteration through a source generator ends abnormally — a downstream stage throwing, a consumer cancelling (for-await `break` → `CANCEL`), or `stop` — the `nextGen` driver in `exec` calls `it.return()` (awaited for an async generator) before re-throwing the **original** error, so the source's `finally {}` runs. This matches `AsyncIteratorClose` in `for await…of`: the original error wins over any cleanup error. Don't drop the abort wrapper or let it mask the original error. When the cleanup fails too, `withCleanupError` in `exec.js` decides what surfaces, the one rule for the executor and both adapters: the cleanup error alone after a `stop` (a clean end), both as an `AggregateError` after a real `Error`, and a non-`Error` sentinel unchanged. `asStream` / `asWebStream` route their teardown (`destroy()`, `readable.cancel()`, `writable.abort()`) into the same path: the push a producer is parked on is rejected with a private `CANCEL`, and a later push throws it, so the abort runs; a single-function stage returns its queued generators the same way. The `/node` `chain()` wrapper destroys its inner streams when it is destroyed before both of its sides finish, without passing the error down (inner `'error'` events are already forwarded), and leaves them alone on a clean end, since an output's writable side can outlast its readable side. A generator that is not parked on a push at teardown, and whose later values all get dropped, is stopped too: teardown marks the push with `cancelSymbol` (exported from `exec.js`), `nextGen` checks the mark before each `it.next()`, and the adapters' single-function pump loops check `destroyed` / `cancelled`. `readableFrom` and `readableWebStreamFrom` release their sources too, on `destroy()` / `cancel()`, a source failure, or `stop`: `return()` on each queued iterator, innermost first, taking the whole queue at once because a woken pump also enters `release()`. With the pump parked, or after a source failure or `stop`, they await each `return()` in turn and report cleanup failures through `withCleanupError`, so an outer `finally` can't close what an inner one still uses. With a source operation in progress (a pending `next()` or promise, or a source destroying its own stream), they call every `return()` at once and teardown doesn't wait, since `destroy()` / `cancel()` are how a consumer leaves a stalled source; failures of that cleanup are dropped.
- **Resource-owning flushable stages are released through their `abort`.** `flushable(write, final, abort)` stores `abort` under `abortSymbol`. The owners that see a pipeline end abnormally call the `abort`s in order: the `gen()` bridge (an error or a consumer `break`), `destroy` in `asStream`, and cancel, abort, and a failing write or flush in `asWebStream`; after a `stop`, only the stopper and the stages before it are aborted (next rule). Each flushable stage gets its `final` or its `abort`, once, never both: an owner keeps one `finished` set per pipeline, holding the stages whose `final` completed (`noteFinal` in `exec.js`) or whose `abort` was called. `flush()` skips the stages in it, and `abortStages` skips them and adds each one before calling its `abort`. A stage whose `final` threw, or is still running at teardown, is aborted. A failed pipeline releases every stage not finished: a failing flush after a stop (`finishStop`), and, in plain `gen()`, a failing release after a stop (`releaseStopped`), since no flush follows. The owners check for an `abort` at build time (`hasAborters`), so a pipeline without one pays nothing; a failing `abort` surfaces through `withCleanupError`. An `abort` releases and never flushes: buffered output is dropped. `asyncBlockWriter` registers its `close()`. `fun()` and the bare `exec()` driver have no teardown and call nothing.
- **A `stop` is a clean end for the stages after the stopper: they are flushed.** Every stage call a `Stop` leaves sets its index to the stage after that call (`markStop` in `exec.js`): a returned `stop` and a thrown `Stop` alike, from a function, a promise, a generator, or a flushable's `final`. So a `Stop` from an inner pipeline (a `pipe()` used as a stage) is reindexed at the outer stage. `stopIndex` reads the index; a `Stop` without one (an adapter's single function) leaves nothing after it. A stop during a flush ends the stopper's output: `flush()` resumes after the stopper and rethrows the last `Stop` at the end. `asStream` and `asWebStream` flush on their own: `finishStop` flushes those stages, aborts the stopper and the stages before it, then the readable side ends, so the flushed output still reaches the reader; after a `Stop` from their end-of-input flush, `finishStop` finds the stages after the stopper already finished. `gen()`, `fun()`, and the `exec()` driver record the index, so their caller's `none` flush covers only those stages. `pipe()` drives one value and its flush in one pass (`genBridge(stages, true)` in `exec.js`, the bridge `gen()` is built on; internal, never exported from a documented module), in the order of `finishStop`: after a `Stop` it flushes the stages after the stopper, then releases the stopper and the stages before it, so a failing release cannot cost the flushed output; then the `Stop`, or the release failure, propagates. `drain()` ends a `pipe()` run on its `Stop` and returns normally (the run carries `pipeRunSymbol` from `exec.js`); a `Stop` from any other iterable, a `gen()` run included, still reaches the caller, since a `gen()` keeps processing later inputs and its feeding loop needs the signal. After a stop, `asStream` ends its readable side at once, not when the input ends, since an endless source would never end otherwise; `tests/node/test-asStream-lifecycle.js` guards it. Plain `gen()` releases those stages when its data pass ends, since no flush may follow. The stopper and the stages before it are never flushed. The `/core` `chain()` never flushes, after a stop or a clean end alike.
- **Special values in generators.** From a generator, don't yield `defs.none` or `defs.many(...)`: express them natively (skip with `continue`, emit multiple values with separate `yield`s or `yield* anIterable`). `defs.stop` and `defs.finalValue(...)` are supported from generators: `stop` terminates the whole pipeline, and `finalValue(x)` emits `x` and skips the segment's remaining functions. After issuing either, `return`. In regular functions all four markers are return values. See [wiki/defs.md](https://github.com/uhop/stream-chain/wiki/defs#special-values-in-generators).
- **`chain.asStream` / `chain.gen` are override hooks** — internal references go through the static-property indirection so users can monkey-patch. Don't refactor to direct imports.

## Architecture

- `chain(fns, options)` is the main entry point (default = /node). Returns a Node `Duplex` with `.streams`, `.input`, `.output` properties.
- `stream-chain/web` exposes a parallel `chain()` that returns `{readable, writable, streams, input, output}`, a native Web Streams duplex pair.
- `stream-chain/core` exposes a callable async-iterable factory: no Node streams, no Web Streams. Browser-safe and substrate-free. Input handling: `null`/`undefined` → empty; strings and other non-iterables (numbers, booleans, plain objects, …) → passed through as a single value; arrays / generators / async iterables / Maps / Sets → iterated.
- Functions in a chain are grouped together with `gen()` (unless `noGrouping: true`).
- `exec(...fns)` (`src/exec.js`) is the shared **sync-when-possible, value-or-promise executor**, the single engine behind `gen`, `fun`, `asStream`, and `asWebStream`. It threads a value through the function list, emits terminal values through a `push` callback, and stays synchronous until the first real promise (async stage, thenable, or backpressuring push) appears. Internal, not a public export.
- `gen(...fns)` creates an async generator pipeline, a push→pull bridge over `exec.next`. Handles all special return values from regular functions: `none`, `stop`, `many()`, `finalValue()`, flushable.
- `fun(...fns)` creates a function pipeline (sync when possible). Collects all outputs into a `Many` per input, so memory scales with output size: **not safe for unbounded pipelines**. Deliberately not on the default `stream-chain` / `/node` export; import it from `stream-chain/fun.js` (also re-exported from `/web` and `/core`).
- `asStream(fn[, options])` wraps a function as a Node `Duplex` with per-item backpressure.
- `asWebStream(fn[, options])` wraps a function as a Web Streams `{readable, writable}` pair with per-item backpressure.
- Special return values are defined in `defs.js`: `none` (skip), `stop` (terminate; the stages after the stopper are still flushed), `many(values)` (emit multiple), `finalValue(value)` (skip rest of chain), `flushable(fn, final?, abort?)` (called at stream end; `abort` releases its resources when the pipeline ends abnormally).
- Web Streams type guards (`isReadableWebStream`, `isWritableWebStream`, `isDuplexWebStream`) live in `defs.js` and are re-exported from `index.js` and `web/index.js`.
- The `/node` chain adapts Web Stream objects to Node streams with `Readable.fromWeb()` / `Writable.fromWeb()` / `Duplex.fromWeb()` and `{objectMode: true}`. The `/web` chain handles them natively.
- JSONL support is in `src/jsonl/`: a parser and a stringer for line-separated JSON. The parser emits `{key, value}` per line and drops empty lines. Error handling: `ignoreErrors: true` drops failed lines but the counter still bumps (gappy keys; back-compat); `errorIndicator` (presence-checked: `errorIndicator: undefined` is meaningful) substitutes a value or calls a function `(error, input, reviver) => unknown` whose `undefined` return drops without bumping the counter. The stream wrappers (`parserStream`, `parserWebStream`) forward both. A byte-order mark that starts the input, bytes or strings, is dropped by `fixUtf8Stream()` and `asyncBlockReader` (`ignoreBOM: true` keeps it, forwarded by every parser entry); a later U+FEFF is kept. Both apply the rule by hand on every runtime: `StringDecoder` keeps a BOM, and Deno 2.9.8's `TextDecoder` also drops a U+FEFF that starts a later `decode()` call ([denoland/deno#37090](https://github.com/denoland/deno/issues/37090)), so don't hand the job back to `TextDecoder` while that is open. Raw export: `jsonlParser` (per-line factory, no `fixUtf8Stream`/`lines` front). The function-pipeline stringer is `src/jsonl/stringer.js` (flushable); `stringerStream` / `stringerWebStream` keep their Transform / TransformStream shapes. Factory-bundled entries at `src/{node,web}/jsonl/{parser,stringer}.js` carry `.asStream` / `.asWebStream` methods (Web entries omit `.asStream` to stay browser-safe); the `src/{node,web}/jsonl/index.js` barrels export `{jsonlParser, jsonlStringer}` (resolvable as `stream-chain/node/jsonl` / `stream-chain/web/jsonl` through package `exports`). They exist so stream-json's deprecated JSONL users can migrate imports to stream-chain with unchanged call sites.
- File-edge JSONL components in `src/jsonl/file/` (Node-only): `parseFile(options)` returns `gen(asyncBlockReader, lines, jsonlParser)` (the reader decodes, so the `fixUtf8Stream()` front of `parser()` would only drop a second U+FEFF); `stringerToFile(path, options)` returns `gen(stringer, asyncBlockWriter)`. Drive them with `pipe(...)` + `drain(...)` (from `src/utils/`) so the writer's flushable closes the file. When a pipeline ends without the flush (another stage throws, `stop`, an early break), its owner calls the writer's `close()` as the flushable's `abort`, which releases the handle without writing the buffered tail. `asyncBlockWriter(...)` and `stringerToFile(...)` results also expose `close()`, for a caller that drives the stage some other way or fails outside the pipeline. The block-I/O primitives `asyncBlockReader` / `asyncBlockWriter` and the substrate-free helpers `pipe` / `drain` live in `src/utils/`. Round-trip is ~40% faster than the equivalent `fs streams + parserStream + stringerStream` pipeline; pure parse-and-count through for-await is slower (per-token gen-bridge cost); see `bench/jsonl-file.js`.
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
- Tests are configured in `package.json` under the `"tape6"` section, in three buckets by environment:
  - `tests/core/` — substrate-agnostic. Use the `runChain(transducers, input) → Promise<output>` helper from `tests/web-helpers.js`, which drives a `/web` chain. Runs in browser AND CLI (Web Streams are universal in Node 22+/Deno/Bun).
  - `tests/web/` — Web Streams substrate (`asWebStream`, `/web` chain, `webStreamPuller`). Runs in browser AND CLI.
  - `tests/node/` — Node Streams substrate (`asStream`, JSONL through `node:fs` + `node:zlib`, `streamPuller`, etc.). Runs only in CLI. Anything that imports `node:*` or transitively pulls the `Readable`/`Writable` factories of `tests/helpers.js` belongs here.
  - `tape6.tests` = `tests/core` + `tests/web` (both buckets browser-runnable). `tape6.cli` = `tests/node` (added only in a non-browser context per the `resolveTests` rules of `tape-six`; see `node_modules/tape-six/TESTING.md` §"Configuring test discovery").
- Test files should be directly executable: `node tests/<bucket>/test-foo.js`.

## Key conventions

- Don't add dependencies unless absolutely necessary: the library is zero-dependency.
- All public API is exported from `src/index.js` and typed in `src/index.d.ts`. Keep them in sync.
- Wiki documentation lives in the `wiki/` submodule.
- Symbols use the `object-stream` namespace: `Symbol.for('object-stream.none')`, etc.
- The library is ESM. CJS consumers destructure: `const {chain} = require('stream-chain')`. The bare-callable `const chain = require('stream-chain')` form isn't supported.
- Supported Node majors: 22, 24, 26 (latest minor of each).

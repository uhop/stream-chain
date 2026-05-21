# Architecture

`stream-chain` is a library for building stream-processing pipelines from functions, generators, and existing streams. It has **zero runtime dependencies** — only dev dependencies for testing, benchmarking, and type-checking. 4.x ships three substrate variants:

- **`stream-chain` / `stream-chain/node`** — canonical Node Streams chain (`Duplex`). Default.
- **`stream-chain/web`** — native Web Streams chain (`{readable, writable}`). Browser-safe.
- **`stream-chain/core`** — substrate-free async-iterable chain. No `node:stream`, no Web Streams.

## Project layout

```
package.json                  # Package config; "tape6" section configures test discovery; "exports" map drives subpaths
src/                          # Source code
├── index.js                  # /node entry: chain() factory + asStream + asWebStream + gen + dataSource + re-exports
├── index.d.ts                # TypeScript declarations for /node
├── defs.js                   # Special values (none, stop, many, finalValue, flushable, fList) + Web Streams type guards
├── defs.d.ts
├── gen.js                    # Async generator pipeline from a list of functions
├── gen.d.ts
├── fun.js                    # Function pipeline from a list of functions (sync-first); exported via /web, /core
├── fun.d.ts
├── asStream.js               # Wraps a function as a Node Duplex with per-item backpressure
├── asStream.d.ts
├── asWebStream.js            # Wraps a function as a Web Streams {readable, writable} pair with per-item backpressure
├── asWebStream.d.ts
├── typed-streams.js          # TypedReadable, TypedWritable, TypedDuplex, TypedTransform
├── typed-streams.d.ts
├── node/                     # Subpath: stream-chain/node — thin re-export of root index
│   ├── index.js
│   └── index.d.ts
├── web/                      # Subpath: stream-chain/web — native Web Streams chain
│   ├── index.js              # chain() over duplex pairs; pipeTo wires stages together
│   └── index.d.ts
├── core/                     # Subpath: stream-chain/core — async-iterable chain
│   ├── index.js              # chain() returns a callable async-generator factory
│   └── index.d.ts
├── jsonl/                    # JSONL (line-separated JSON) support
│   ├── parser.js             # JSONL parser: returns gen() pipeline (fixUtf8 → lines → JSON.parse)
│   ├── parser.d.ts
│   ├── parserStream.js       # JSONL parser as a Duplex (parser wrapped with asStream)
│   ├── parserStream.d.ts
│   ├── stringerStream.js     # JSONL stringer: objects → newline-separated JSON strings
│   └── stringerStream.d.ts
└── utils/                    # Utility functions (most return values for use in chain())
    ├── take.js               # take(n, finalValue) — take N items, then stop
    ├── takeWhile.js          # takeWhile(fn, finalValue) — take while predicate is true
    ├── takeWithSkip.js       # takeWithSkip(n, skip, finalValue) — skip then take
    ├── skip.js               # skip(n) — skip N items
    ├── skipWhile.js          # skipWhile(fn) — skip while predicate is true
    ├── fold.js               # fold(fn, initial) — reduce stream to single value at end
    ├── reduce.js             # Alias for fold
    ├── reduceStream.js       # reduceStream(fn, initial) — reduce as Writable stream
    ├── scan.js               # scan(fn, initial) — running accumulator, emits each step
    ├── batch.js              # batch(size) — group items into fixed-size arrays
    ├── readableFrom.js       # readableFrom({iterable}) — iterable/iterator to Readable
    ├── fixUtf8Stream.js      # fixUtf8Stream() — repartition chunks for valid UTF-8
    ├── lines.js              # lines() — split byte stream into lines
    ├── streamPuller.js       # makeStreamPuller(readable) — wrap Node Readable as non-destructive async iterator
    ├── webStreamPuller.js    # makeWebStreamPuller(readable) — wrap Web ReadableStream as non-destructive async iterator
    └── *.d.ts                # TypeScript declarations for each utility
tests/                        # Test files organized by environment (tape-six)
├── core/                     # Substrate-agnostic — runs in browser AND CLI (uses /web chain internally via runChain helper)
├── web/                      # Web Streams substrate (asWebStream, /web chain, webStreamPuller) — runs in browser AND CLI
├── node/                     # Node Streams substrate (asStream, JSONL via fs+zlib, streamPuller, etc.) — runs only in CLI
├── helpers.js                # Node-stream test helpers (re-exports web-helpers)
├── web-helpers.js            # Pure + Web Streams helpers (delay, webStreamToArray, writeAndCollect, runChain)
├── data/                     # Test fixtures (used by tests/node/test-jsonl-*.js)
└── manual/                   # Manual test scripts (not part of the automated suite)
bench/                        # Benchmarks (chain-1-stage, chain-2-stage, raw-streams, gen-opt, fun-opt, …)
wiki/                         # GitHub wiki documentation (git submodule)
.github/                      # CI workflows, Dependabot config
```

## Core concepts

### How chain() works (`/node` and `/web`)

1. User calls `chain(fns, options)` with an array of functions, streams, and/or arrays.
2. The array is flattened (nested arrays are inlined, falsy values removed).
3. Unless `noGrouping: true` (`/node` only), consecutive functions are grouped together using `gen()` for efficiency and wrapped into a single stream stage via `asStream()` (`/node`) or `asWebStream()` (`/web`).
4. All resulting stages are piped together sequentially — `Duplex.pipe()` in `/node`, `ReadableStream.pipeTo()` in `/web`.
5. A wrapper is created (Node `Duplex` for `/node`, plain `{readable, writable}` object for `/web`) that delegates writes to the first stage and reads from the last stage.
6. (`/node` only) Error events from all internal stages are forwarded to the wrapper unless `skipEvents: true`. (`/web` propagates errors via `pipeTo`'s default abort-on-error semantics.)
7. The wrapper exposes `.streams` (all internal stages), `.input` (first), and `.output` (last).

### How chain() works (`/core`)

1. Same flattening + function-list inlining (via `gen()`) as `/node`.
2. Returns a callable: `(input?) => AsyncGenerator<R>`. Calling it with an async-iterable input runs each value through the composed pipeline.
3. No streams; `.streams` / `.input` / `.output` are `null` for parity with the substrate variants.

### Special return values (defs.js)

Functions in a chain can return special values to control flow:

| Value               | Symbol                | Effect                                                         |
| ------------------- | --------------------- | -------------------------------------------------------------- |
| `none`              | `object-stream.none`  | Skip — no value passed downstream                              |
| `null`/`undefined`  | —                     | Same as `none` in `asStream()`/`asWebStream()`/`chain()`       |
| `stop`              | `object-stream.stop`  | Skip and terminate the generator (gen/fun and stream wrappers) |
| `many(values)`      | `object-stream.many`  | Emit multiple values from a single input                       |
| `finalValue(value)` | `object-stream.final` | Skip remaining chain steps, emit value directly                |
| `flushable(fn)`     | `object-stream.flush` | Mark function to be called at stream end with `none`           |

**Note on `null`/`undefined`:** `gen()` and `fun()` are general-purpose compositors that pass any value through the pipeline, including `null` and `undefined`. `asStream()`, `asWebStream()`, and `chain()` treat `null` and `undefined` as `none` (skip) because streams reserve these values for end-of-stream signaling.

**Convention: generators yield plain values.** Generator functions (sync `function*` and async `async function*`) must NOT yield `none`, `stop`, `many(...)`, or `finalValue(...)`. Express those semantics with the language: skip with `continue`, terminate with `return`, emit multiple via separate `yield`s. The special markers are for regular-function returns only. See [wiki/defs.md § Convention: generators yield plain values](https://github.com/uhop/stream-chain/wiki/defs#convention-generators-yield-plain-values).

### gen() — async generator pipeline

`gen(...fns)` takes multiple functions and returns a single async generator function that:

1. Processes each input value through the function pipeline sequentially.
2. Handles all special return values (`none`, `stop`, `many`, `finalValue`).
3. Supports regular, async, generator, and async generator functions.
4. Calls flushable functions with `none` when the input is exhausted.
5. Tags the result with a function list (`fListSymbol`) so `chain()` can inline it.

### fun() — function pipeline (sync-first)

`fun(...fns)` is like `gen()` but returns a function instead of a generator. Generator results are collected into `many()` arrays. For purely synchronous pipelines it returns a synchronous result; for asynchronous pipelines it returns a `Promise`.

**Memory caveat:** `fun()` collects the entire output of a single input into one `Many` before returning. Its memory footprint scales with output-per-input — unsafe for pipelines that produce unbounded values from a single input. `gen()` is the safe default; reach for `fun()` only when output-per-input is bounded and small.

For this reason `fun()` is intentionally NOT on the default `stream-chain` / `/node` export — it requires an explicit import from `stream-chain/fun.js`. It is re-exported (and attached to `chain`) from the `/web` and `/core` subpaths where the output-size discipline is closer to the user's mental model.

### asStream() — function to Node Duplex

`asStream(fn[, options])` wraps any function (regular, async, generator, async generator) as a `Duplex` stream. Per-item backpressure: every `stream.push()` is awaited if it returned `false`, keeping the readable queue at `hwm + 1` regardless of how many output values one input chunk produces.

### asWebStream() — function to Web Streams duplex pair

`asWebStream(fn[, options])` wraps any function as a `{readable, writable}` Web Streams duplex pair. NOT a `TransformStream` — `transform()` can't suspend mid-call for per-item backpressure. Per-item backpressure: when `controller.desiredSize <= 0` after an `enqueue`, the next push returns a Promise that resolves when `pull()` fires.

### Stream-type detection (`/node` chain)

`chain()` in `/node` detects stream types to decide how to integrate them:

- **Node streams**: `isReadableNodeStream`, `isWritableNodeStream`, `isDuplexNodeStream` (local to `src/index.js`).
- **Web streams**: `isReadableWebStream`, `isWritableWebStream`, `isDuplexWebStream` (canonical in `src/defs.js`, re-exported from `src/index.js`, `src/asWebStream.js`, `src/web/index.js`).
- Web streams passed to the `/node` chain are adapted via `Readable.fromWeb()`, `Writable.fromWeb()`, `Duplex.fromWeb()` with `{objectMode: true}`.

### Async-iterator wrappers (`makeStreamPuller` / `makeWebStreamPuller`)

`makeStreamPuller(readable)` wraps a Node `Readable` as a non-destructive async iterator — `stream.iterator({destroyOnReturn: false})` under the hood. Preserves the original `'error'` value, synthesizes `Error('Premature close')` on destroy-without-end, leaves the source alive when iteration ends early.

`makeWebStreamPuller(readable)` wraps a Web `ReadableStream` similarly — `stream[Symbol.asyncIterator]({preventCancel: true})` plus a `cancel(reason)` extension method (the iterator-protocol `return()` can't carry a cancel reason cleanly).

Both intended for downstream consumers (stream-join, stream-sorting) that need original-error preservation and non-destructive break.

### JSONL support

- `parser(reviver?)` — returns a `gen()` pipeline: `fixUtf8Stream → lines → JSON.parse`.
- `parserStream(options?)` — wraps `parser()` with `asStream()`.
- `stringerStream(options?)` — Duplex stream that serializes objects to JSONL format.

### Utility functions

All utilities return functions or constructors suitable for use in `chain()`:

- **Slicing**: `take`, `takeWhile`, `takeWithSkip`, `skip`, `skipWhile`
- **Folding**: `fold` (reduce to single value at end), `scan` (emit running accumulator), `reduce` (alias for fold), `reduceStream` (Writable stream with `.accumulator`)
- **Batching**: `batch(size)` — group items into arrays
- **Stream helpers**: `readableFrom` (iterable → Readable), `fixUtf8Stream` (UTF-8 repartitioning), `lines` (byte stream → line stream)
- **Async-iterator wrappers**: `makeStreamPuller` (Node Readable), `makeWebStreamPuller` (Web ReadableStream)

## Module dependency graph

```
src/index.js (= /node) ── src/defs.js, src/gen.js, src/asStream.js, src/asWebStream.js
src/node/index.js   ── src/index.js (thin re-export)
src/web/index.js    ── src/defs.js, src/gen.js, src/fun.js, src/asWebStream.js
src/core/index.js   ── src/defs.js, src/gen.js, src/fun.js

src/asStream.js     ── src/defs.js
src/asWebStream.js  ── src/defs.js
src/gen.js          ── src/defs.js
src/fun.js          ── src/defs.js

src/jsonl/parser.js        ── src/gen.js, src/utils/fixUtf8Stream.js, src/utils/lines.js
src/jsonl/parserStream.js  ── src/jsonl/parser.js, src/asStream.js
src/jsonl/stringerStream.js (standalone Duplex)

src/utils/*         ── src/defs.js (most utilities use none, stop, many, flushable)
src/utils/streamPuller.js     ── (just wraps stream.iterator())
src/utils/webStreamPuller.js  ── (just wraps stream[Symbol.asyncIterator]())
```

## Testing

- **Framework**: tape-six (`tape6`)
- **Run all**: `npm test` (parallel workers via `tape6 --flags FO`)
- **Run single file**: `node tests/test-<name>.js`
- **Run with Bun**: `npm run test:bun`
- **Run with Deno**: `npm run test:deno`
- **Run sequential**: `npm run test:seq` (also `test:seq:bun`, `test:seq:deno`)
- **TypeScript check**: `npm run ts-check`
- **JavaScript type check (dual tsconfig)**: `npm run js-check`
- **TypeScript tests**: `npm run ts-test` (also `ts-test:bun`, `ts-test:deno`)
- **Lint**: `npm run lint` (Prettier check)
- **Lint fix**: `npm run lint:fix` (Prettier write)

## Benchmarks

Benchmarks use [nano-benchmark](https://www.npmjs.com/package/nano-benchmark). Run a benchmark by specifying its file:

```bash
npm run bench -- bench/<name>.js
```

### Key benchmark files

| File                         | What it measures                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `bench/chain-1-stage.js`     | 1-stage chain: `/node` (`asStream(gen(...))`) vs `/web` (`asWebStream(gen(...))`) on the same function pipeline. Shows substrate overhead. |
| `bench/chain-2-stage.js`     | Same as above but 2 stages. Shows per-composition overhead.                                                                                |
| `bench/raw-streams.js`       | Raw Node Duplex vs raw Web Streams duplex (`{readable, writable}`). Substrate baseline without `stream-chain` involvement.                 |
| `bench/raw-streams-burst.js` | Web-streams burst-enqueue behavior: synchronous enqueue-then-drain vs per-item drain.                                                      |
| `bench/core-chain.js`        | `/core` chain throughput — no substrate cost; isolates `gen()`'s overhead.                                                                 |
| `bench/gen-fun-stream.js`    | Compares `gen()`, `fun()`, and `chain(asStream(...))` on the same pipeline of sync functions.                                              |
| `bench/gen-fun.js`           | Head-to-head `gen()` vs `fun()` without stream overhead.                                                                                   |
| `bench/gen-opt.js`           | `gen()` function-list inlining optimization: flat vs nested-with-inlining vs nested-with-`clearFunctionList()`.                            |
| `bench/fun-opt.js`           | Same as `gen-opt.js` but for `fun()`.                                                                                                      |

All benchmarks use a pipeline of simple sync arithmetic functions (`x => x - 2`, `x => x + 1`, etc.) to isolate framework overhead from application logic.

## Import paths

```js
// Main API (default = /node; ESM)
import chain from 'stream-chain';
import {chain, none, stop, many, gen, asStream, asWebStream, dataSource} from 'stream-chain';

// CJS — destructure required (no bare-callable fallback in 4.x)
const {chain} = require('stream-chain');

// Substrate variants
import chain from 'stream-chain/node'; // same as the default
import chain from 'stream-chain/web'; // native Web Streams chain
import chain from 'stream-chain/core'; // substrate-free async-iterable chain

// Individual modules
import gen from 'stream-chain/gen.js';
import fun from 'stream-chain/fun.js';
import asStream from 'stream-chain/asStream.js';
import asWebStream from 'stream-chain/asWebStream.js';
import {none, stop, many, finalValue, flushable, isReadableWebStream} from 'stream-chain/defs.js';

// Utilities
import take from 'stream-chain/utils/take.js';
import fold from 'stream-chain/utils/fold.js';
import batch from 'stream-chain/utils/batch.js';
import makeStreamPuller from 'stream-chain/utils/streamPuller.js';
import makeWebStreamPuller from 'stream-chain/utils/webStreamPuller.js';

// JSONL
import parser from 'stream-chain/jsonl/parser.js';
import parserStream from 'stream-chain/jsonl/parserStream.js';
import stringerStream from 'stream-chain/jsonl/stringerStream.js';

// TypeScript helpers
import {TypedTransform} from 'stream-chain/typed-streams.js';
```

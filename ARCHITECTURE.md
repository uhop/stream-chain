# Architecture

`stream-chain` is a library for building stream processing pipelines from functions, generators, and existing streams. It has **zero runtime dependencies** — only dev dependencies for testing, benchmarking, and type-checking.

## Project layout

```
package.json              # Package config; "tape6" section configures test discovery
src/                      # Source code
├── index.js              # Main entry point: chain() factory, dataSource(), re-exports
├── index.d.ts            # TypeScript declarations for the full public API
├── defs.js               # Special values: none, stop, many, finalValue, flushable, fList
├── defs.d.ts             # TypeScript declarations for defs
├── gen.js                # Async generator pipeline from a list of functions
├── gen.d.ts              # TypeScript declarations for gen
├── fun.js                # Async function pipeline from a list of functions
├── fun.d.ts              # TypeScript declarations for fun
├── asStream.js           # Wraps any function as a Duplex stream
├── asStream.d.ts         # TypeScript declarations for asStream
├── typed-streams.js      # TypedReadable, TypedWritable, TypedDuplex, TypedTransform
├── typed-streams.d.ts    # TypeScript declarations for typed-streams
├── jsonl/                # JSONL (line-separated JSON) support
│   ├── parser.js         # JSONL parser: returns gen() pipeline (fixUtf8 → lines → JSON.parse)
│   ├── parser.d.ts       # TypeScript declarations for parser
│   ├── parserStream.js   # JSONL parser as a Duplex stream (parser wrapped with asStream)
│   ├── parserStream.d.ts # TypeScript declarations for parserStream
│   ├── stringerStream.js # JSONL stringer: objects → newline-separated JSON strings
│   └── stringerStream.d.ts
└── utils/                # Utility functions (all return functions for use in chain())
    ├── take.js           # take(n, finalValue) — take N items, then stop
    ├── takeWhile.js      # takeWhile(fn, finalValue) — take while predicate is true
    ├── takeWithSkip.js   # takeWithSkip(n, skip, finalValue) — skip then take
    ├── skip.js           # skip(n) — skip N items
    ├── skipWhile.js      # skipWhile(fn) — skip while predicate is true
    ├── fold.js           # fold(fn, initial) — reduce stream to single value at end
    ├── reduce.js         # Alias for fold
    ├── reduceStream.js   # reduceStream(fn, initial) — reduce as Writable stream
    ├── scan.js           # scan(fn, initial) — running accumulator, emits each step
    ├── batch.js          # batch(size) — group items into fixed-size arrays
    ├── readableFrom.js   # readableFrom({iterable}) — iterable/iterator to Readable
    ├── fixUtf8Stream.js  # fixUtf8Stream() — repartition chunks for valid UTF-8
    ├── lines.js          # lines() — split byte stream into lines
    └── *.d.ts            # TypeScript declarations for each utility
tests/                    # Test files (test-*.mjs, test-*.mts, test-*.cjs, using tape-six)
bench/                    # Benchmarks
wiki/                     # GitHub wiki documentation (git submodule)
.github/                  # CI workflows, Dependabot config
```

## Core concepts

### How chain() works

1. User calls `chain(fns, options)` with an array of functions, streams, and/or arrays.
2. The array is flattened (nested arrays are inlined, falsy values removed).
3. Unless `noGrouping: true`, consecutive functions are grouped together using `gen()` for efficiency and wrapped into a single Duplex stream via `asStream()`.
4. All resulting streams are piped together sequentially.
5. A `Duplex` wrapper is created that delegates writes to the first stream and reads from the last stream, handling backpressure correctly.
6. Error events from all internal streams are forwarded to the wrapper (unless `skipEvents: true`).
7. The wrapper exposes `.streams` (all internal streams), `.input` (first), and `.output` (last).

### Special return values (defs.js)

Functions in a chain can return special values to control flow:

| Value               | Symbol                | Effect                                                         |
| ------------------- | --------------------- | -------------------------------------------------------------- |
| `none`              | `object-stream.none`  | Skip — no value passed downstream                              |
| `null`/`undefined`  | —                     | Same as `none` in `asStream()`/`chain()` (see note below)      |
| `stop`              | `object-stream.stop`  | Skip and terminate the generator (gen/fun only)                |
| `many(values)`      | `object-stream.many`  | Emit multiple values from a single input                       |
| `finalValue(value)` | `object-stream.final` | Skip remaining chain steps, emit value directly (gen/fun only) |
| `flushable(fn)`     | `object-stream.flush` | Mark function to be called at stream end with `none`           |

**Note on `null`/`undefined`:** `gen()` and `fun()` are general-purpose compositors that pass any value through the pipeline, including `null` and `undefined`. `asStream()` and `chain()` treat `null` and `undefined` as `none` (skip) because Node.js streams reserve these values for end-of-stream signaling.

### gen() — async generator pipeline

`gen(...fns)` takes multiple functions and returns a single async generator function that:

1. Processes each input value through the function pipeline sequentially.
2. Handles all special return values (`none`, `stop`, `many`, `finalValue`).
3. Supports regular, async, generator, and async generator functions.
4. Calls flushable functions with `none` when the input is exhausted.
5. Tags the result with a function list (`fListSymbol`) so `chain()` can inline it.

### fun() — async function pipeline

`fun(...fns)` is like `gen()` but returns an async function instead of a generator. Generator results are collected into `many()` arrays.

### asStream() — function to Duplex

`asStream(fn)` wraps any function (regular, async, generator, async generator) as a `Duplex` stream. It handles all special return values and backpressure.

### Stream detection

`chain()` detects stream types to decide how to integrate them:

- **Node streams**: `isReadableNodeStream`, `isWritableNodeStream`, `isDuplexNodeStream`
- **Web streams**: `isReadableWebStream`, `isWritableWebStream`, `isDuplexWebStream`
- Web streams are adapted to Node streams via `Readable.fromWeb()`, `Writable.fromWeb()`, `Duplex.fromWeb()`.

### JSONL support

- `parser(reviver?)` — returns a `gen()` pipeline: `fixUtf8Stream → lines → JSON.parse`.
- `parserStream(options?)` — wraps `parser()` with `asStream()`.
- `stringerStream(options?)` — Duplex stream that serializes objects to JSONL format.

### Utility functions

All utilities return functions suitable for use in `chain()`:

- **Slicing**: `take`, `takeWhile`, `takeWithSkip`, `skip`, `skipWhile`
- **Folding**: `fold` (reduce to single value at end), `scan` (emit running accumulator), `reduce` (alias for fold), `reduceStream` (Writable stream with `.accumulator`)
- **Batching**: `batch(size)` — group items into arrays
- **Stream helpers**: `readableFrom` (iterable → Readable), `fixUtf8Stream` (UTF-8 repartitioning), `lines` (byte stream → line stream)

## Module dependency graph

```
src/index.js ── src/defs.js
     │               ↑
     ├── src/gen.js ──┘
     │       ↑
     ├── src/fun.js
     │
     ├── src/asStream.js ── src/defs.js
     │       ↑
     ├── src/jsonl/parser.js ── src/gen.js, src/utils/fixUtf8Stream.js, src/utils/lines.js
     ├── src/jsonl/parserStream.js ── src/jsonl/parser.js, src/asStream.js
     └── src/jsonl/stringerStream.js (standalone Duplex)

src/utils/* ── src/defs.js (most utilities use none, stop, many, flushable)
```

## Testing

- **Framework**: tape-six (`tape6`)
- **Run all**: `npm test` (parallel workers via `tape6 --flags FO`)
- **Run single file**: `node tests/test-<name>.mjs`
- **Run with Bun**: `npm run test:bun`
- **Run with Deno**: `npm run test:deno`
- **Run sequential**: `npm run test:seq` (also `test:seq:bun`, `test:seq:deno`)
- **TypeScript check**: `npm run ts-check`
- **TypeScript tests**: `npm run ts-test` (also `ts-test:bun`, `ts-test:deno`)
- **Lint**: `npm run lint` (Prettier check)
- **Lint fix**: `npm run lint:fix` (Prettier write)

## Import paths

```js
// Main API
import chain from 'stream-chain';
import {chain, none, stop, many, gen, asStream} from 'stream-chain';
const chain = require('stream-chain');

// Individual modules
import gen from 'stream-chain/gen.js';
import fun from 'stream-chain/fun.js';
import asStream from 'stream-chain/asStream.js';
import {none, stop, many, finalValue, flushable} from 'stream-chain/defs.js';

// Utilities
import take from 'stream-chain/utils/take.js';
import fold from 'stream-chain/utils/fold.js';
import batch from 'stream-chain/utils/batch.js';

// JSONL
import parser from 'stream-chain/jsonl/parser.js';
import parserStream from 'stream-chain/jsonl/parserStream.js';
import stringerStream from 'stream-chain/jsonl/stringerStream.js';

// TypeScript helpers
import {TypedTransform} from 'stream-chain/typed-streams.js';
```

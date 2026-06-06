# stream-chain [![NPM version][npm-img]][npm-url] [![Node.js CI][ci-img]][ci-url]

[npm-img]: https://img.shields.io/npm/v/stream-chain.svg
[npm-url]: https://npmjs.org/package/stream-chain
[ci-img]: https://github.com/uhop/stream-chain/actions/workflows/tests.yml/badge.svg
[ci-url]: https://github.com/uhop/stream-chain/actions/workflows/tests.yml

`stream-chain` processes streams of **objects** &mdash; records, not raw text or bytes. It is especially designed for huge streams: multi-gigabyte database dumps, append-only logs, message-queue and other live feeds generated continuously and far too large to hold in memory. You handle one record at a time while the library keeps memory flat, propagating [backpressure](https://nodejs.org/en/learn/modules/backpressuring-in-streams) from end to end.

Each stage of the pipeline is an ordinary function. `stream-chain` wires your functions &mdash; alongside any Node or Web streams you already use &mdash; into a single [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) stream, so the whole pipeline behaves like one stream you can compose further.

Why it might be for you:

- **Simple.** A stage is an ordinary function: one input in, one value out, or `chain.none` to drop it. The model goes further &mdash; a stage can emit any number of values per input, from zero to many. A generator function does this naturally by `yield`ing; a plain function can return `chain.many([...])` instead, but that holds every value in memory, so generators are the leaner choice for fan-out.
- **Flexible.** Mix sync functions, `async` functions, generators, async generators, and real streams in one chain &mdash; on whichever substrate you want: Node streams (the default), native Web Streams (`/web`), or substrate-free async iterables (`/core`).
- **Performance-minded.** Throughput gets deliberate attention here &mdash; the hot paths are measured and tuned (a sync fast path, automatic stage grouping, fused file edges), the kind of care pipeline code often doesn't get. Real numbers depend on your hardware and workload, so [benchmark](https://github.com/uhop/stream-chain/wiki/benchmarks) on your own.
- **Solid.** Lightweight, zero-dependency, bundled TypeScript typings, exercised by a broad test suite across Node, Bun, and Deno.

## Example

Read a huge JSONL dump, transform each record, write the result back out &mdash; record by record, in constant memory:

```js
import chain from 'stream-chain';
import parseFile from 'stream-chain/jsonl/file/parser.js';
import stringerToFile from 'stream-chain/jsonl/file/stringer.js';

const pipeline = chain([
  parseFile(), // read line-by-line -> {key, value} per record
  ({value}) => (value.active ? value : chain.none), // drop inactive records
  async user => ({...user, plan: await lookupPlan(user.id)}), // enrich asynchronously
  stringerToFile('active-users.jsonl') // write results back out
]);

pipeline.on('finish', () => console.log('done'));
pipeline.end('users.jsonl'); // a 10 TB file is fine
```

The middle stages are plain functions; `stream-chain` handles the streaming, backpressure, and file handles. The source and sink don't have to be JSONL &mdash; any object stream works: a database cursor, an HTTP response, [stream-json](https://www.npmjs.com/package/stream-json) assembling tokens into objects, your own generator. JSONL just happens to be the most common on-disk format for object streams, so it ships in the box. See [Intro by examples](https://github.com/uhop/stream-chain/wiki/Intro) for more.

## Installation

```bash
npm i --save stream-chain
```

## What's in the box

- **[chain()](<https://github.com/uhop/stream-chain/wiki/chain()>)** &mdash; the factory: turns an array of functions, arrays, and streams into one `Duplex` pipeline.
- **Transducers:**
  - [gen()](https://github.com/uhop/stream-chain/wiki/gen) &mdash; an async generator built from a list of functions: each stage can emit zero-to-many values per input, yielded lazily so memory stays flat no matter how much a stage fans out. It is the substrate-free core under `chain()`, and the safe default for unbounded pipelines.
  - [fun()](https://github.com/uhop/stream-chain/wiki/fun) &mdash; an async function from a list of functions; collects outputs per input (explicit import).
- **Adapters:**
  - [asStream()](https://github.com/uhop/stream-chain/wiki/asStream) &mdash; wraps a function as a Node `Duplex`.
  - [asWebStream()](https://github.com/uhop/stream-chain/wiki/asWebStream) &mdash; wraps a function as a Web Streams pair, with per-item backpressure.
- **Helpers** &mdash; slicing (`take`, `skip`, &hellip;), reduce (`fold`, `scan`, &hellip;), stream adapters (`readableFrom`, stream pullers), and more. See [utils](https://github.com/uhop/stream-chain/wiki/utils).
- **JSONL** &mdash; streaming [JSON Lines](https://jsonlines.org/) I/O for object streams: a substrate-free `parser()` / `stringer()`, Node and Web wrappers, fused local-file edges (`parseFile()` / `stringerToFile()`), and per-line error handling via `errorIndicator`. See [jsonl](https://github.com/uhop/stream-chain/wiki/jsonl).
- **Subpaths** &mdash; `stream-chain` / `stream-chain/node` (default Node streams), `stream-chain/web` (native Web Streams, browser-safe), `stream-chain/core` (substrate-free async iterables).

Full documentation is in the **[wiki](https://github.com/uhop/stream-chain/wiki)** &mdash; browse the [index](https://github.com/uhop/stream-chain/wiki/Home), or [search it](https://uhop.github.io/wiki-search/app/?wiki=uhop/stream-chain) by name.

## License

BSD-3-Clause

## Release History

- 4.2.2 _Bugfix: eliminated file handle leak, cleaned up exports._
- 4.2.1 _Factory-bundled JSONL entries &mdash; `stream-chain/node/jsonl` & `stream-chain/web/jsonl` carry `.asStream` / `.asWebStream`. Bugfix: removed `checkedParse()`, mistakenly exposed in 4.2.0._
- 4.2.0 _JSONL file-edge components (perf): `parseFile()`, `stringerToFile()` + `errorIndicator` option. Bugfix: now `/core` chain passes strings as a single value._
- 4.1.1 _Performance: faster synchronous pipelines._
- 4.1.0 _Web Streams parity: new `readableWebStreamFrom()`, `reduceWebStream()`, `parserWebStream()`, `stringerWebStream()` + `dataSource()` + minor bugfix._
- 4.0.2 _`fixUtf8Stream()` now works on browsers._
- 4.0.1 _Minor bugfixes. No API changes._
- 4.0.0 _Major: moved to ESM. New subpath split: `/node` (default), `/web` (native Web Streams), `/core` (substrate-free). New `asWebStream()` adapter with per-item backpressure. See the [Migration guide](https://github.com/uhop/stream-chain/wiki/Migration-V3-to-V4)._
- 3.6.3 _TS inference updates: improvements and found bugs. Updated deps._
- 3.6.2 _Improved TS typings: `ChainOutput<W, R>` propagates `R` to events and methods (thx [Scover](https://github.com/5cover)). Updated deps._
- 3.6.1 _Technical release: updated deps._
- 3.6.0 _Performance: sync-first `fun()` (~2.5&times; faster for sync pipelines, now returns `Many | Promise<Many>`). Sync fast path in `gen()` (~1.6&times; faster). Documented `null`/`undefined` handling differences. Wiki: renamed V2 files for Windows compatibility._
- 3.5.1 _Fixed `finish` event not firing after `stop`. Web stream detection uses duck-typing instead of `instanceof` (supports non-standard web streams) (thx [Alex Yang](https://github.com/himself65)). Performance: unified fast path in `asStream()`._
- 3.5.0 _Variadic `combineMany()` and `combineManyMut()`. Fixed `readableFrom()` unhandled rejection bug. Improved TS typings, docs, and `package.json` metadata._

The full release notes are in the wiki: [Release notes](https://github.com/uhop/stream-chain/wiki/Release-notes).

# AGENTS.md — stream-chain

> `stream-chain` creates a chain of streams out of regular functions, asynchronous functions, generators, and existing streams, while properly handling backpressure. The result is a Duplex stream. It is a lightweight, zero-dependency micro-package.

For project structure, module dependencies, and the architecture overview see [ARCHITECTURE.md](./ARCHITECTURE.md).
For detailed usage docs and API references see the [wiki](https://github.com/uhop/stream-chain/wiki).

## Setup

This project uses a git submodule for the wiki:

```bash
git clone --recursive git@github.com:uhop/stream-chain.git
cd stream-chain
npm install
```

## Commands

- **Install:** `npm install`
- **Test:** `npm test` (runs `tape6 --flags FO`)
- **Test (Bun):** `npm run test:bun`
- **Test (single file):** `node tests/test-<name>.mjs`
- **TypeScript check:** `npm run ts-check`
- **TypeScript demo:** `npm run ts-demo`

## Project structure

```
stream-chain/
├── package.json          # Package config; "tape6" section configures test discovery
├── src/                  # Source code
│   ├── index.js          # Main entry point: chain() factory + re-exports
│   ├── index.d.ts        # TypeScript definitions for the full public API
│   ├── defs.js           # Special values (none, stop, many, finalValue, flushable, etc.)
│   ├── defs.d.ts         # TypeScript definitions for defs
│   ├── gen.js            # Creates async generator pipeline from functions
│   ├── gen.d.ts          # TypeScript definitions for gen
│   ├── fun.js            # Creates async function pipeline from functions
│   ├── fun.d.ts          # TypeScript definitions for fun
│   ├── asStream.js       # Converts a function into a Duplex stream
│   ├── asStream.d.ts     # TypeScript definitions for asStream
│   ├── typed-streams.js  # TypeScript helpers: TypedReadable, TypedWritable, TypedDuplex, TypedTransform
│   ├── typed-streams.d.ts
│   ├── jsonl/            # JSONL (line-separated JSON) support
│   │   ├── parser.js     # JSONL parser function (returns gen() pipeline)
│   │   ├── parserStream.js   # JSONL parser as a stream
│   │   └── stringerStream.js # JSONL stringer as a stream
│   └── utils/            # Utility functions
│       ├── take.js       # Take N items from stream
│       ├── takeWhile.js  # Take items while condition is true
│       ├── takeWithSkip.js # Skip then take
│       ├── skip.js       # Skip N items
│       ├── skipWhile.js  # Skip items while condition is true
│       ├── fold.js       # Reduce/fold stream to single value
│       ├── reduce.js     # Alias for fold
│       ├── reduceStream.js # Reduce as a Writable stream
│       ├── scan.js       # Running accumulator (like fold but emits each step)
│       ├── batch.js      # Group items into fixed-size arrays
│       ├── readableFrom.js # Convert iterable to Readable stream
│       ├── fixUtf8Stream.js # Fix multi-byte UTF-8 splits across chunks
│       └── lines.js      # Split byte stream into lines
├── tests/                # Test files (test-*.mjs)
├── ts-check/             # TypeScript type-check files
├── ts-test/              # TypeScript demo/test files
├── bench/                # Benchmarks
├── wiki/                 # GitHub wiki documentation (git submodule)
└── .github/              # CI workflows, Dependabot config
```

## Code style

- **CommonJS** throughout (`"type": "commonjs"` in package.json).
- **No transpilation** — code runs directly.
- **Prettier** for formatting (see `.prettierrc`): 100 char width, single quotes, no bracket spacing, no trailing commas, arrow parens "avoid".
- 2-space indentation.
- Semicolons are enforced by Prettier (default `semi: true`).
- Imports use `require()` syntax in source, `import` in tests (`.mjs`).
- The package is `stream-chain`. Internal symbols use `Symbol.for('object-stream.*')`.

## Critical rules

- **Zero runtime dependencies.** Never add packages to `dependencies`. Only `devDependencies` are allowed.
- **Do not modify or delete test expectations** without understanding why they changed.
- **Do not add comments or remove comments** unless explicitly asked.
- **Keep `src/index.js` and `src/index.d.ts` in sync.** All public API is exported from `index.js` and typed in `index.d.ts`.
- **Keep `.js` and `.d.ts` files in sync** for all modules under `src/`.
- **Object mode by default.** `chain()` defaults to `{writableObjectMode: true, readableObjectMode: true}`.
- **Backpressure must be handled correctly.** This is a core concern of the library.

## Architecture

- `chain(fns, options)` is the main entry point. It accepts an array of functions, streams, or arrays (which are flattened). Returns a `Duplex` stream with `.streams`, `.input`, `.output` properties.
- Functions in the chain are grouped together using `gen()` for efficiency (unless `noGrouping: true`).
- `gen(...fns)` creates an async generator pipeline from a list of functions. It handles all special return values (`none`, `stop`, `many()`, `finalValue()`, flushable functions).
- `fun(...fns)` is like `gen()` but returns an async function instead of a generator.
- `asStream(fn)` wraps any function as a `Duplex` stream.
- Special return values are defined in `defs.js`: `none` (skip), `stop` (terminate), `many(values)` (emit multiple), `finalValue(value)` (skip rest of chain), `flushable(fn)` (called at stream end).
- Web streams (`ReadableStream`, `WritableStream`, duplex `{readable, writable}`) are automatically adapted to Node streams.
- JSONL support is in `src/jsonl/` — parser and stringer for line-separated JSON.
- Utility functions in `src/utils/` provide common stream operations: slicing (`take`, `skip`), folding (`fold`, `scan`), batching, line splitting, UTF-8 fixing.

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

- Test files are ESM (`.mjs`) and use `tape-six`.
- Test file naming convention: `test-*.mjs`.
- Tests are configured in `package.json` under the `"tape6"` section.
- Test files should be directly executable: `node tests/test-foo.mjs`.

## Key conventions

- Do not add dependencies unless absolutely necessary — the library is intentionally zero-dependency.
- All public API is exported from `src/index.js` and typed in `src/index.d.ts`. Keep them in sync.
- Wiki documentation lives in the `wiki/` submodule.
- Symbols use the `object-stream` namespace: `Symbol.for('object-stream.none')`, etc.
- The library supports both CommonJS (`require`) and ESM (`import`) consumers.

# Underlying ideas for stream-chain

## Origin

The original idea came from the need to process large files without loading them into memory. Writing custom stream processors turned out to be a common pattern, so I created a library to simplify it.

### The chain() function

The main idea: a function that takes a list of transformations and returns a linear pipeline:

```js
const pipeline = chain([
  x => x * 2,
  x => x + 1,
  fn1,
  fn2,
  gen1,
  gen2,
  duplexStream,
  transformStream
  // ...
]);
```

`chain()` accepts any data-transforming item:

- functions (sync or async)
- generators (sync or async)
- duplex or transform streams

### Initial design decisions

- Work with Node streams.
- Support sync and async functions.
- Support sync and async generators (subject to Node version at the time).
- Form a pipeline by piping streams together; each non-stream item is wrapped into a stream.

#### Performance problems with streams

Every stream adds fixed overhead regardless of how fast the transformation is. With millions or billions of items, small per-item delays compound. The pipeline must be shortened by combining multiple functions into a single stream whenever possible.

#### Functional pipelines

Streams are slow compared to plain function calls and generators. To exploit this, consecutive functions can be grouped into a single functional sub-chain:

```js
const pipeline = chain([
  fun(
    x => x * 2,
    x => x + 1
  ),
  duplexStream,
  fun(fn1, fn2, gen1, gen2),
  transformStream
]);
```

This reduces stream overhead for pure-function sub-chains, but requires manual grouping.

#### Producing multiple values

Two related problems: producing multiple items from a single input (e.g. splitting a string into words) and skipping items (e.g. filtering out even numbers). This led to special return values:

- `none` &mdash; skip this item (like `continue` in a loop)
- `many()` &mdash; emit a variable number of items (0 to many)
- `stop` &mdash; skip and terminate the pipeline (like `break` in a loop)

Internally `many()` wraps an array. For large expansions, allocating the full array defeats the purpose of streaming.

#### Using generators for streaming

Generators produce data on demand and consume it lazily &mdash; much more memory-efficient than arrays. They can emit any number of items, even infinite streams, solving the `many()` problem above.

However, generators are less efficient than plain functions. Async generators, while a natural fit for async processing, have the most overhead among all functional options.

## Version 3.x

Core ideas:

- A pipeline is an array of processing units applied sequentially.
- Each unit can be a function (sync/async), a generator (sync/async), a stream (Node or Web), or another pipeline.
- Functional sub-pipelines group consecutive functions without stream overhead:
  - `fun()` &mdash; takes a list of functions, returns a function (sync-first: returns sync results for sync pipelines, `Promise` for async). Handles `none`, `stop`, `many()`, and `finalValue()` returns.
  - `gen()` &mdash; takes a list of functions, returns an async generator. It handles `none`, `many()`, and other special values internally, but never produces them &mdash; a generator naturally yields zero, one, or many values.
- `asStream()` wraps any function as a Duplex stream.

### Optimization: function lists

Using `gen()` or `fun()` output as an input to another `gen()` or `fun()` works but is inefficient (nested async generator overhead). Instead, their argument lists are stored and can be inlined by outer compositions:

```js
const f1 = gen(fn1, fn2);
const f2 = gen(fn3, f1, fn4);

// f2 now contains fn3, fn1, fn2, fn4
// it is equivalent to:
const f3 = gen(fn3, fn1, fn2, fn4);
```

The same can be done with arrays:

```js
const f2 = gen(fn3, [fn1, fn2], fn4);

// f2 now contains fn3, fn1, fn2, fn4
// it is equivalent to:
const f3 = gen(fn3, fn1, fn2, fn4);
```

Using function list provisions effectively converts the 1st case to the 2nd case (arrays).
Embedded arrays (and other function lists) are flattened during composition at any depth.

This enables efficient composition: pipeline fragments are reusable components that can be combined without nesting overhead.

### Optimization: automatic grouping

When a pipeline mixes streams and functions, `chain()` finds consecutive functions and groups them into a single `gen()` call, which is then wrapped with `asStream()`. This reduces the number of stream boundaries.

### Incorporating Web streams

Node provides adapters between Node streams and Web streams. `chain()` applies them automatically.

## Potential improvements

The generalized async-generator approach is robust but creates overhead:

- Deferring to the next event-loop tick on every item.
- Allocating a generator object per item.
- Creating a promise per async operation.

Much of this is unnecessary when the pipeline contains only synchronous functions. While `await syncFn()` is legal, it forces a microtask tick. Similarly, wrapping a sync function in an async generator allocates objects that are never needed. The goal is to detect sync-only paths and skip the async machinery.

### Existing case

Benchmarks in `../sj-test/` compare `stream-json` 1.9.1 (parser as a stream) vs 2.0.0 (parser as a generator) using 100 MB and 1 GB JSON files. A user reported that 2.0.0 is slower. The root cause: wrapping the generator-based parser with `asStream()` adds per-item async overhead that the native-stream parser avoids.

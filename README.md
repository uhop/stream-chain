# stream-chain

[![Build status][travis-image]][travis-url]
[![Dependencies][deps-image]][deps-url]
[![devDependencies][dev-deps-image]][dev-deps-url]
[![NPM version][npm-image]][npm-url]

`stream-chain` creates a chain of object mode transform streams out of regular functions, asynchronous functions, generator functions, and existing [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) and [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) object mode streams, while properly handling [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/). It eliminates a boilerplate helping to concentrate on functionality without losing the performance.

Originally `stream-chain` was used internally with [stream-fork](https://www.npmjs.com/package/stream-fork) and [stream-json](https://www.npmjs.com/package/stream-json) to create flexible data processing pipelines.

`stream-chain` is a lightweight, no-dependencies micro-package. It is distributed under New BSD license.

## Intro

```js
const Chain = require('stream-chain');

const fs = require('fs');
const zlib = require('zlib');
const {Transform} = require('stream');

// the chain will work on a stream of number objects
const chain = new Chain([
  // transforms a value
  x => x * x,
  // returns several values
  x => [x - 1, x, x + 1],
  // waits for an asynchronous operation
  async x => await getTotalFromDatabaseByKey(x),
  // returns multiple values with a generator
  function* (x) {
    for (let i = x; i > 0; --i) {
      yield i;
    }
    return 0;
  },
  // filters out even values
  x => x % 2 ? x : null,
  // uses an arbitrary transform stream
  new Transform({
    writableObjectMode: true,
    transform(x, _, callback) {
      // transform to text
      callback(null, x.toString());
    }
  }),
  // compress
  zlib.createGzip(),
  // save to a file
  fs.createWriteStream('output.txt.gz')
]);
// log errors
chain.on('error', error => console.log(error));
// use the chain
dataSource.pipe(chain.input);
```

Making processing pipelines appears to be easy: just chain functions one after another, and we are done. Real life pipelines filter objects out and/or produce more objects out of a few ones. On top of that we have to deal with asynchronous operations, while processing or producing data: networking, databases, files, user responses, and so on. Unequal number of values per stage, and unequal throughput of stages introduced problems like [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/), which requires algorithms implemented by [streams](https://nodejs.org/api/stream.html).

While a lot of API improvements were made to make streams easy to use, in reality, a lot of boilerplate is required when creaing a pipeline. `stream-chain` eliminates most of it.

## Installation

```
npm i --save stream-chain
```

## Documentation

`Chain`, which is returned by `require('stream-chain')`, is based on [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter). It chains its dependents in a single pipeline optionally binding common stream events.

Many details about this package can be discovered by looking at test files located in `tests/` and in the source code (`main.js`).

### Constructor: `new Chain(fns[, skipEvents])`

The constructor accepts following arguments:

* `fns` is an array of functions or stream instances.
  * If a value is a function, a `Transform` stream is created, which calls this function with two parameters: `chunk` (an object), and an optional `encoding`. See [Node's documentation](https://nodejs.org/api/stream.html#stream_transform_transform_chunk_encoding_callback) for more details on those parameters. The function will be called in context of the created stream.
    * If it is a regular function, it can return:
      * Regular value:
        * Array of values to pass several or zero values to the next stream as they are.
        * Single value.
          * If it is `undefined` or `null`, no value shall be passed.
          * Otherwise, the value will be passed to the next stream.
      * Special value:
        * If it is an instance of [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) or "thenable" (an object with a method called `then()`), it will be waited for. Its result should be a regular value.
        * If it is an instance of a generator or "nextable" (an object with a method called `next()`), it will be iterated according to the [generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) protocol. The results should be regular values.
      * Any thrown exception will be catched and passed to a callback function effectively generating an error event.
  * If it is an asynchronous function, it can return a regular value.
    * In essence, it is covered under "special values" as a function that returns a promise.
  * If it is a generator function, each yield or return should produce a regular value.
    * In essence, it is covered under "special values" as a function that returns a generator object.
  * If a value is a valid stream, it is included as is in the pipeline.
    * The very first stream can be [Readable](https://nodejs.org/api/stream.html#stream_readable_streams).
    * The very last stream can be [Writable](https://nodejs.org/api/stream.html#stream_writable_streams).
    * [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) or [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) can go anywhere.
      * Both `Transform` and `Duplex` are always `Readable` and `Writable`.
* `skipEvents` is an optional flag. If it is falsy (the default), `'error'` events from all streams are forwarded to the created instance, `'data'` and `'end'` events are forwarded from the last stream of a pipeline. If it is truthy, no event forwarding is made.
  * It is useful for handling non-standard events. In this case the forwarding of events can be done either externally or in constructor of a derived class.

```js
const chain = new Chain([x => x * x, x => [x - 1, x, x + 1]]);
chain.on('error', error => console.error(error));
dataSource.pipe(chain.input);
```

An instance can be used to attach handlers for stream events.

### Properties

Following public properties are available:

* `streams` is an array of streams created by a constructor. Its values either `Transform` streams that use corresponding functions from a constructor parameter, or user-provided streams. All streams are piped sequentially starting from the beginning.
* `input` is the beginning of the pipeline. Effectively it is the first item of `streams`.
* `output` is the end of the pipeline. Effectively it is the last item of `streams`.

`input` and `output` are helpers that used to combine the procesing pipeline with other streams, which usually provide I/O for the pipeline.

```js
const chain = new Chain([
  x => x * x,
  x => [x - 1, x, x + 1],
  new Transform({
    writableObjectMode: true,
    transform(chunk, _, callback) {
      callback(null, chunk.toString());
    }
  })
]);
chain.output
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('output.txt.gz'));
dataSource.pipe(chain.input);
```

## Release History

- 1.0.3 *Improved documentation.*
- 1.0.2 *Better README.*
- 1.0.1 *Fixed the README.*
- 1.0.0 *The initial release.*

[npm-image]:      https://img.shields.io/npm/v/stream-chain.svg
[npm-url]:        https://npmjs.org/package/stream-chain
[deps-image]:     https://img.shields.io/david/uhop/stream-chain.svg
[deps-url]:       https://david-dm.org/uhop/stream-chain
[dev-deps-image]: https://img.shields.io/david/dev/uhop/stream-chain.svg
[dev-deps-url]:   https://david-dm.org/uhop/stream-chain?type=dev
[travis-image]:   https://img.shields.io/travis/uhop/stream-chain.svg
[travis-url]:     https://travis-ci.org/uhop/stream-chain

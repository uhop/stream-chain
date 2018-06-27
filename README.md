# stream-chain

[![Build status][travis-image]][travis-url]
[![Dependencies][deps-image]][deps-url]
[![devDependencies][dev-deps-image]][dev-deps-url]
[![NPM version][npm-image]][npm-url]
[![TypeScript definitions on DefinitelyTyped][definitelytyped-image]](definitelytyped-url)


`stream-chain` creates a chain of streams out of regular functions, asynchronous functions, generator functions, and existing streams, while properly handling [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/). The resulting chain is represented as a [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) stream, which can be combined with other streams the usual way. It eliminates a boilerplate helping to concentrate on functionality without losing the performance especially make it easy to build object mode data processing pipelines.

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
  zlib.createGzip()
]);
// log errors
chain.on('error', error => console.log(error));
// use the chain, and save the result to a file
dataSource.pipe(chain).pipe(fs.createWriteStream('output.txt.gz'));
```

Making processing pipelines appears to be easy: just chain functions one after another, and we are done. Real life pipelines filter objects out and/or produce more objects out of a few ones. On top of that we have to deal with asynchronous operations, while processing or producing data: networking, databases, files, user responses, and so on. Unequal number of values per stage, and unequal throughput of stages introduced problems like [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/), which requires algorithms implemented by [streams](https://nodejs.org/api/stream.html).

While a lot of API improvements were made to make streams easy to use, in reality, a lot of boilerplate is required when creaing a pipeline. `stream-chain` eliminates most of it.

## Installation

```bash
npm i --save stream-chain
# or: yarn add stream-chain
```

## Documentation

`Chain`, which is returned by `require('stream-chain')`, is based on [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex). It chains its dependents in a single pipeline optionally binding `error` events.

Many details about this package can be discovered by looking at test files located in `tests/` and in the source code (`main.js`).

### Constructor: `new Chain(fns[, options])`

The constructor accepts following arguments:

* `fns` is an array of functions or stream instances.
  * If a value is a function, a [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) stream is created, which calls this function with two parameters: `chunk` (an object), and an optional `encoding`. See [Node's documentation](https://nodejs.org/api/stream.html#stream_transform_transform_chunk_encoding_callback) for more details on those parameters. The function will be called in context of the created stream.
    * If it is a regular function, it can return:
      * Regular value:
        * Array of values to pass several or zero values to the next stream as they are.
          ```js
          // produces no values:
          x => []
          // produces two values:
          x => [x, x + 1]
          // produces one array value:
          x => [[x, x + 1]]
          ```
        * Single value.
          * If it is `undefined` or `null`, no value shall be passed.
          * Otherwise, the value will be passed to the next stream.
          ```js
          // produces no values:
          x => null
          x => undefined
          // produces one value:
          x => x
          ```
      * Special value:
        * If it is an instance of [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) or "thenable" (an object with a method called `then()`), it will be waited for. Its result should be a regular value.
          ```js
          // delays by 0.5s:
          x => new Promise(resolve => setTimeout(() => resolve(x), 500))
          ```
        * If it is an instance of a generator or "nextable" (an object with a method called `next()`), it will be iterated according to the [generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) protocol. The results should be regular values.
          ```js
          // produces multiple values:
          class Nextable {
            constructor(x) { this.x = x; this.i = -1; }
            next() { return {done: this.i <= 1, value: this.x + this.i++}; }
          }
          x => new Nextable(x)
          ```
      * Any thrown exception will be catched and passed to a callback function effectively generating an error event.
        ```js
        // fails
        x => { throw new Error('Bad!'); }
        ```
  * If it is an asynchronous function, it can return a regular value.
    * In essence, it is covered under "special values" as a function that returns a promise.
    ```js
    // delays by 0.5s:
    async x => {
      await new Promise(resolve => setTimeout(() => resolve(), 500));
      return x;
    }
    ```
  * If it is a generator function, each yield or return should produce a regular value.
    * In essence, it is covered under "special values" as a function that returns a generator object.
    ```js
    // produces multiple values:
    function* (x) {
      for (let i = -1; i <= 1; ++i) {
        if (i) yield x + i;
      }
      return x;
    }
    ```
  * If a value is a valid stream, it is included as is in the pipeline.
    * [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform).
    * [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex).
    * The very first stream can be [Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable).
      * In this case a `Chain` instance ignores all possible writes to the front, and ends when the first stream ends.
    * The very last stream can be [Writable](https://nodejs.org/api/stream.html#stream_class_stream_writable).
      * In this case a `Chain` instance does not produce any output, and finishes when the last stream finishes.
      * Because `'data'` event is not used in this case, the instance resumes itself automatically. Read about it in Node's documentation:
        * [Two modes](https://nodejs.org/api/stream.html#stream_two_modes).
        * [readable.resume()](https://nodejs.org/api/stream.html#stream_readable_resume).
* `options` is an optional object detailed in the [Node's documentation](https://nodejs.org/api/stream.html#stream_new_stream_duplex_options).
  * If `options` is not specified, or falsy, it is assumed to be:
    ```js
    {writableObjectMode: true, readableObjectMode: true}
    ```
  * Always make sure that `writableObjectMode` is the same as the corresponding object mode of the first stream, and `readableObjectMode` is the same as the corresponding object mode of the last stream.
    * Eventually both these modes can be deduced, but Node does not define the standard way to determine it, so currently it cannot be done reliably.
  * Additionally following custom properties are recognized:
    * `skipEvents` is an optional flag. If it is falsy (the default), `'error'` events from all streams are forwarded to the created instance. If it is truthy, no event forwarding is made. A user can always do so externally or in a constructor of derived classes.

An instance can be used to attach handlers for stream events.

```js
const chain = new Chain([x => x * x, x => [x - 1, x, x + 1]]);
chain.on('error', error => console.error(error));
dataSource.pipe(chain);
```

### Properties

Following public properties are available:

* `streams` is an array of streams created by a constructor. Its values either [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) streams that use corresponding functions from a constructor parameter, or user-provided streams. All streams are piped sequentially starting from the beginning.
* `input` is the beginning of the pipeline. Effectively it is the first item of `streams`.
* `output` is the end of the pipeline. Effectively it is the last item of `streams`.

Generally, a `Chain` instance should be used to represent a chain:

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
dataSource
  .pipe(chain);
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('output.txt.gz'));
```

But in some cases `input` and `output` provide a better control over how a data processing pipeline should be organized:

```js
chain.output
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('output.txt.gz'));
dataSource.pipe(chain.input);
```

Please select what style you want to use, and never mix them together with the same object.

### Static methods

Following static methods are available:

* `chain(fns[, options)` is a helper factory function, which has the same arguments as the constructor and returns a `Chain` instance.
  ```js
  const {chain} = require('stream-chain');

  // simple
  dataSource
    .pipe(chain([x => x * x, x => [x - 1, x, x + 1]]));

  // all inclusive
  chain([
    dataSource,
    x => x * x,
    x => [x - 1, x, x + 1],
    zlib.createGzip(),
    fs.createWriteStream('output.txt.gz')
  ])
  ```

## Release History

- 2.0.3 *Added TypeScript typings and the badge.*
- 2.0.2 *Workaround for Node 6: use `'finish'` event instead of `_final()`.*
- 2.0.1 *Improved documentation.*
- 2.0.0 *Upgraded to use Duplex instead of EventEmitter as the base.*
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
[definitelytyped-image]: https://img.shields.io/badge/DefinitelyTyped-.d.ts-blue.svg
[definitelytyped-url]:   https://definitelytyped.org

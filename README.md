# stream-chain [![NPM version][npm-img]][npm-url]

[npm-img]:      https://img.shields.io/npm/v/stream-chain.svg
[npm-url]:      https://npmjs.org/package/stream-chain

`stream-chain` creates a chain of streams out of regular functions, asynchronous functions, generator functions, existing Node streams, and Web streams, while properly handling [backpressure](https://nodejs.org/en/learn/modules/backpressuring-in-streams). The resulting chain is represented as a [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) stream, which can be combined with other streams the usual way. It eliminates a boilerplate helping to concentrate on functionality without losing the performance especially make it easy to build object mode data processing pipelines.

Originally `stream-chain` was used internally with [stream-fork](https://www.npmjs.com/package/stream-fork) and [stream-json](https://www.npmjs.com/package/stream-json) to create flexible data processing pipelines.

`stream-chain` is a lightweight, no-dependencies micro-package with TS typings. It is distributed under New BSD license.

## Intro

```js
import chain from 'stream-chain';
// or: const chain = require('stream-chain');

import fs from 'node:fs';
import zlib from 'node:zlib';
import {Transform} from 'node:stream';

// this chain object will work on a stream of numbers
const pipeline = chain([
  // transforms a value
  x => x * x,

  // returns several values
  x => chain.many([x - 1, x, x + 1]),

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
    objectMode: true,
    transform(x, _, callback) {
      callback(null, x + 1);
    }
  }),

  // transform to strings
  x => '' + x,

  // compress
  zlib.createGzip()
]);

// the chain object is a regular stream
// it can be used with normal stream methods

// log errors
pipeline.on('error', error => console.log(error));

// use the chain object, and save the result to a file
dataSource.pipe(pipeline).pipe(fs.createWriteStream('output.txt.gz'));
```

Making processing pipelines appears to be easy: just chain functions one after another, and we are done. Real life pipelines filter objects out and/or produce more objects out of a few ones. On top of that we have to deal with asynchronous operations, while processing or producing data: networking, databases, files, user responses, and so on. Unequal number of values per stage, and unequal throughput of stages introduced problems like [backpressure](https://nodejs.org/en/learn/modules/backpressuring-in-streams), which requires algorithms implemented by [streams](https://nodejs.org/api/stream.html).

While a lot of API improvements were made to make streams easy to use, in reality, a lot of boilerplate is required when creating a pipeline. `stream-chain` eliminates most of it.

## Installation

```bash
npm i --save stream-chain
# or: yarn add stream-chain
```

## Documentation

All documentation can be found in the [wiki](https://github.com/uhop/stream-chain/wiki). It document in details the main function and various utilities and helpers that can simplify stream programming. Additionally it includes a support for JSONL (line-separated JSON files).

An object that is returned by `chain()` is based on [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex). It chains its dependents in a single pipeline optionally binding `error` events.

Many details about this package can be discovered by looking at test files located in `tests/` and in the source code (`src/`).

### `chain(fns[, options])`

The factory function accepts the following arguments:

* `fns` is an array of functions, arrays or stream instances.
  * If a value is a function, it is a candidate for a [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) stream (see below for more details), which calls this function with two parameters: `chunk` (an object), and an optional `encoding`. See [Node's documentation](https://nodejs.org/api/stream.html#stream_transform_transform_chunk_encoding_callback) for more details on those parameters.
    * If it is a regular function, it can return:
      * Regular value:
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
          x => new Promise(
            resolve => setTimeout(() => resolve(x), 500))
          ```

        * If it is an instance of a generator or "nextable" (an object with a method called `next()`), it will be iterated according to the [generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) protocol. The results should be regular values.

          ```js
          // produces multiple values:
          class Nextable {
            constructor(x) {
              this.x = x;
              this.i = -1;
            }
            next() {
              return {
                done:  this.i <= 1,
                value: this.x + this.i++
              };
            }
          }
          x => new Nextable(x)
          ```

          `next()` can return a `Promise` according to the [asynchronous generator](https://zaiste.net/nodejs_10_asynchronous_iteration_async_generators/) protocol.
      * Any thrown exception will be caught and passed to a callback function effectively generating an error event.

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

  * If it is a generator function, each yield should produce a regular value.
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

  * If it is an asynchronous generator function, each yield should produce a regular value.
    * In essence, it is covered under "special values" as a function that returns a generator object.

    ```js
    // produces multiple values:
    async function* (x) {
      for (let i = -1; i <= 1; ++i) {
        if (i) {
          await new Promise(resolve => setTimeout(() => resolve(), 50));
          yield x + i;
        }
      }
      return x;
    }
    ```

  * If a value is an array, its items are assumed to be functions, streams or other such arrays. The array is flattened, all individual items are included in a chain sequentially.
    * It is a provision to create lightweight bundles from pipeline items.
  * If a value is a valid stream, it is included as is in the pipeline.
    * [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform).
    * [Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex).
    * The very first stream can be [Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable).
      * In this case the pipeline ignores all possible writes to the front, and ends when the first stream ends.
    * The very last stream can be [Writable](https://nodejs.org/api/stream.html#stream_class_stream_writable).
      * In this case the pipeline does not produce any output, and finishes when the last stream finishes.
      * Because `'data'` event is not used in this case, the instance resumes itself automatically. Read about it in Node's documentation:
        * [Two reading modes](https://nodejs.org/api/stream.html#two-reading-modes).
        * [Three states](https://nodejs.org/api/stream.html#three-states).
        * [readable.resume()](https://nodejs.org/api/stream.html#stream_readable_resume).
  * *(Since 3.1.0)* If a value is a web stream object (like `ReadableStream` or `WritableStream`), it is adapted to a corresponding Node stream and included in the pipeline.
    * Note that the support of web streams is still experimental in Node.
* `options` is an optional object detailed in the [Node's documentation](https://nodejs.org/api/stream.html#stream_new_stream_duplex_options).
  * The default options is this object:

    ```js
    {writableObjectMode: true, readableObjectMode: true}
    ```

    If `options` is specified it is copied over the default options.
  * Always make sure that `writableObjectMode` is the same as the corresponding object mode of the first stream, and `readableObjectMode` is the same as the corresponding object mode of the last stream.
    * Eventually both these modes can be deduced, but Node does not define the standard way to determine it, so currently it cannot be done reliably.
  * Additionally the following custom properties are recognized:
    * `skipEvents` is an optional boolean flag. If it is falsy (the default), `'error'` events from all streams are forwarded to the created instance. If it is truthy, no event forwarding is made. A user can always do so externally or in a constructor of derived classes.
    * `noGrouping` is an optional boolean flag. If it is falsy (the default), all subsequent functions are grouped together using the `gen()` utility for improved performance. If it is specified and truthy, all functions will be wrapped as streams individually. This mode is compatible with how the 2.x version works.

An instance can be used to attach handlers for stream events.

```js
const pipeline = chain([x => x * x, x => [x - 1, x, x + 1]]);
pipeline.on('error', error => console.error(error));
dataSource.pipe(pipeline);
```

## License

BSD-3-Clause

## Release History

* 3.3.0 *Added a way to ignore JSON parsing errors silently.*
* 3.2.0 *Added TS typings and `clearFunctionList()`.*
* 3.1.0 *Added a seamless support for web streams.*
* 3.0.1 *First release of 3.0. See [wiki](https://github.com/uhop/stream-chain/wiki) for details.*
* 3.0.0 *New major version. Unreleased.*
* 2.2.5 *Relaxed the definition of a stream (thx [Rich Hodgkins](https://github.com/rhodgkins)).*
* 2.2.4 *Bugfix: wrong `const`-ness in the async generator branch (thx [Patrick Pang](https://github.com/patrickpang)).*
* 2.2.3 *Technical release. No need to upgrade.*
* 2.2.2 *Technical release. No need to upgrade.*
* 2.2.1 *Technical release: new symbols namespace, explicit license (thx [Keen Yee Liau](https://github.com/kyliau)), added Greenkeeper.*
* 2.2.0 *Added utilities: `take`, `takeWhile`, `skip`, `skipWhile`, `fold`, `scan`, `Reduce`, `comp`.*
* 2.1.0 *Added simple transducers, dropped Node 6.*
* 2.0.3 *Added TypeScript typings and the badge.*
* 2.0.2 *Workaround for Node 6: use `'finish'` event instead of `_final()`.*
* 2.0.1 *Improved documentation.*
* 2.0.0 *Upgraded to use Duplex instead of EventEmitter as the base.*
* 1.0.3 *Improved documentation.*
* 1.0.2 *Better README.*
* 1.0.1 *Fixed the README.*
* 1.0.0 *The initial release.*

# stream-chain

[![Build status][travis-image]][travis-url]
[![Dependencies][deps-image]][deps-url]
[![devDependencies][dev-deps-image]][dev-deps-url]
[![NPM version][npm-image]][npm-url]

`stream-chain` is a simple helper to create a chain of object-mode transform streams out of regular functions, asynchronous functions, generator functions, and existing Transform and Duplex object-mode streams.

It is distributed under New BSD license.

## Intro

```js
const Chain = require('stream-chain');

const chain = new Chain([
  x => [x - 1, x, x + 1],
  x => x * x,
  async x => getFromDatabaseByKey(x),
  function* (x) {
    for (let i = x; i > 0; --i) {
      yield i;
    }
    return 0;
  }
]);
chain.on('data', data => console.log(data));
dataSource.pipe(chain.input);
```

## Installation

```
npm i stream-chain
```

## Documentation

The main module provides a class based on [EventEmitter](https://nodejs.org/dist/latest-v10.x/docs/api/events.html#events_class_eventemitter). It chains its arguments in a single pipeline optionally binding common stream events.

The constructor accepts two parameters:

* `fns` is an array of functions or instances of [Duplex](https://nodejs.org/dist/latest-v10.x/docs/api/stream.html#stream_class_stream_duplex) or [Transform](https://nodejs.org/dist/latest-v10.x/docs/api/stream.html#stream_class_stream_transform) streams.
  * If a value is a function, a `Transform` stream is created, which calls this function with two parameters: `chunk` (an object), and an optional `encoding`. See [documentation](https://nodejs.org/dist/latest-v10.x/docs/api/stream.html#stream_transform_transform_chunk_encoding_callback) for more details on those parameters. The function will be called in the content of created stream.
    * If it is a regular function, it can return an array of values to pass to the next stream, a single value, `undefined` or `null`. Two latter values indicate that no value should be passed.
    * If it is a generator function, it can yield and/or return all necessary values. Each yield/return value will be treated like a returned value from a regular function.
    * If it is an asynchronous function, it will be waited to be resolved, and the resulting value will be treated like a returned value from a regular function.
    * Any thrown exception will be catched and passed to a callback function effectively generating an error event.
  * If a value is a valid stream, it is included as is in the pipeline.
* `skipEvents` is an optional Boolean parameter. If it is `false` (the default), `'error'` events from all streams are forwarded to the created instance, `'data'` and `'end'` events are forwarded from the last stream of a pipeline. If it is `true`, no event forwarding is made.
  * This parameter is useful for handling non-standard events. In this case the forwarding of events can be done either manually, or in a constructor of a derived class.

## Release History

- 1.0.0 *the initial release.*

[npm-image]:      https://img.shields.io/npm/v/stream-chain.svg
[npm-url]:        https://npmjs.org/package/stream-chain
[deps-image]:     https://img.shields.io/david/uhop/stream-chain.svg
[deps-url]:       https://david-dm.org/uhop/stream-chain
[dev-deps-image]: https://img.shields.io/david/dev/uhop/stream-chain.svg
[dev-deps-url]:   https://david-dm.org/uhop/stream-chain?type=dev
[travis-image]:   https://img.shields.io/travis/uhop/stream-chain.svg
[travis-url]:     https://travis-ci.org/uhop/stream-chain

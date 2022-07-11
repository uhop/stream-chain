'use strict';

import test from 'tape-six';

import {Transform} from 'stream';
import {streamToArray, delay} from './helpers.mjs';
import chain from '../src/index.js';
import fromIterable from '../src/utils/readableFrom.js';

test.asPromise('simple: smoke test', (t, resolve) => {
  const c = chain([x => x * x]),
    output1 = [],
    output2 = [];

  fromIterable([1, 2, 3]).pipe(c).pipe(streamToArray(output1));

  c.on('data', value => output2.push(value));
  c.on('end', () => {
    t.deepEqual(output1, [1, 4, 9]);
    t.deepEqual(output2, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('simple: generator', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      function* (x) {
        yield x * x;
        yield x * x * x;
        yield 2 * x;
      },
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 1, 2, 4, 8, 4, 9, 27, 6]);
    resolve();
  });
});

test.asPromise('simple: async function', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), delay(x => x + 1), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [2, 3, 4]);
    resolve();
  });
});

test.asPromise('simple: async function', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      x => chain.many([x * x, x * x * x, 2 * x]),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 1, 2, 4, 8, 4, 9, 27, 6]);
    resolve();
  });
});

test.asPromise('simple: chain', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), x => x * x, x => 2 * x + 1, streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('simple: stream', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      new Transform({
        objectMode: true,
        transform(x, _, callback) {
          callback(null, x * x);
        }
      }),
      x => 2 * x + 1,
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('simple: factory', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      function* (x) {
        yield x * x;
        yield x * x * x;
        yield 2 * x;
      },
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 1, 2, 4, 8, 4, 9, 27, 6]);
    resolve();
  });
});

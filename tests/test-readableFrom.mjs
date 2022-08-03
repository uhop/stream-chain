'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain from '../src/index.js';

import readableFrom from '../src/utils/readableFrom.js';

test.asPromise('readableFrom: smoke test', (t, resolve) => {
  const output = [],
    c = chain([readableFrom([1, 2, 3]), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('readableFrom: function', (t, resolve) => {
  const output = [],
    c = chain([readableFrom(() => 0), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [0]);
    resolve();
  });
});

test.asPromise('readableFrom: async function', (t, resolve) => {
  const output = [],
    c = chain([readableFrom(delay(() => 0)), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [0]);
    resolve();
  });
});

test.asPromise('readableFrom: generator', (t, resolve) => {
  const output = [],
    c = chain([
      readableFrom(function* () {
        yield 0;
        yield 1;
      }),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [0, 1]);
    resolve();
  });
});

test.asPromise('readableFrom: async generator', (t, resolve) => {
  const output = [],
    c = chain([
      readableFrom(async function* () {
        yield delay(() => 0)();
        yield delay(() => 1)();
      }),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [0, 1]);
    resolve();
  });
});

test.asPromise('readableFrom: nextable', (t, resolve) => {
  const output = [],
    c = chain([
      readableFrom(
        (function* () {
          yield 0;
          yield 1;
        })()
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [0, 1]);
    resolve();
  });
});

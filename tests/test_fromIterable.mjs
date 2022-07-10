'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain from '../src/index.js';

import fromIterable from '../src/utils/fromIterable.js';

test.asPromise('fromIterable: smoke test', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('fromIterable: function', (t, resolve) => {
  const output = [],
    c = chain([fromIterable(() => 0), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [0]);
    resolve();
  });
});

test.asPromise('fromIterable: async function', (t, resolve) => {
  const output = [],
    c = chain([fromIterable(delay(() => 0)), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [0]);
    resolve();
  });
});

test.asPromise('fromIterable: generator', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable(function* () {
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

test.asPromise('fromIterable: async generator', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable(async function* () {
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

test.asPromise('fromIterable: nextable', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable(
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

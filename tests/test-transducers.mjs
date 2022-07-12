'use strict';

import test from 'tape-six';

import {streamToArray} from './helpers.mjs';
import chain, {gen, none, finalValue} from '../src/index.js';
import fromIterable from '../src/utils/readableFrom.js';

test.asPromise('transducers: smoke test', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
        x => x * x,
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('transducers: final', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
        x => x * x,
        x => finalValue(x),
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('transducers: nothing', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
        x => x * x,
        () => none,
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, []);
    resolve();
  });
});

test.asPromise('transducers: empty', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), x => x * x, gen(), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('transducers: one', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), x => x * x, gen(x => 2 * x + 1), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('transducers: array', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), [x => x * x, x => 2 * x + 1], streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('transducers: embedded arrays', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), [x => x * x, [x => 2 * x + 1, []]], streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

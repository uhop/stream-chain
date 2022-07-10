'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain, {stop} from '../src/index.js';
import fromIterable from '../src/utils/fromIterable.js';

import take from '../src/utils/take.js';
import takeWhile from '../src/utils/takeWhile.js';
import takeWithSkip from '../src/utils/takeWithSkip.js';

test.asPromise('take: smoke test', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3, 4, 5]), take(2), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2]);
    resolve();
  });
});

test.asPromise('simple: with skip', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3, 4, 5]), takeWithSkip(2, 2), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 4]);
    resolve();
  });
});

test.asPromise('simple: while', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3, 4, 5]), takeWhile(x => x != 3), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2]);
    resolve();
  });
});

test.asPromise('simple: while async', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3, 4, 5]),
      takeWhile(delay(x => x != 3)),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2]);
    resolve();
  });
});

test.asPromise('simple: stop', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3, 4, 5]), take(2, stop), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2]);
    resolve();
  });
});

test.asPromise('simple: stop with skip', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3, 4, 5]), takeWithSkip(2, 2, stop), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 4]);
    resolve();
  });
});

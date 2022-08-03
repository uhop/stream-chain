'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain from '../src/index.js';
import fromIterable from '../src/utils/readableFrom.js';

import skip from '../src/utils/skip.js';
import skipWhile from '../src/utils/skipWhile.js';

test.asPromise('skip: smoke test', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3, 4, 5]), skip(2), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 4, 5]);
    resolve();
  });
});

test.asPromise('skip: while', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3, 4, 5]), skipWhile(x => x != 3), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [3, 4, 5]);
    resolve();
  });
});

test.asPromise('skip: while async', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3, 4, 5]),
      skipWhile(delay(x => x != 3)),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 4, 5]);
    resolve();
  });
});

'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain from '../src/index.js';
import readableFrom from '../src/utils/readableFrom.js';

import fold from '../src/utils/fold.js';
import scan from '../src/utils/scan.js';
import reduce from '../src/utils/reduce.js';
import reduceStream from '../src/utils/reduceStream.js';

test.asPromise('fold: smoke test', (t, resolve) => {
  const output = [],
    c = chain([readableFrom([1, 2, 3]), fold((acc, x) => acc + x, 0), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [6]);
    resolve();
  });
});

test.asPromise('fold: async', (t, resolve) => {
  const output = [],
    c = chain([
      readableFrom([1, 2, 3]),
      fold(
        delay((acc, x) => acc + x),
        0
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [6]);
    resolve();
  });
});

test.asPromise('fold: scan', (t, resolve) => {
  const output = [],
    c = chain([readableFrom([1, 2, 3]), scan((acc, x) => acc + x, 0), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 3, 6]);
    resolve();
  });
});

test.asPromise('fold: scan async', (t, resolve) => {
  const output = [],
    c = chain([
      readableFrom([1, 2, 3]),
      scan(
        delay((acc, x) => acc + x),
        0
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 3, 6]);
    resolve();
  });
});

test.asPromise('fold: reduce', (t, resolve) => {
  const output = [],
    c = chain([readableFrom([1, 2, 3]), fold((acc, x) => acc + x, 0), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [6]);
    resolve();
  });
});

test.asPromise('fold: reduce async', (t, resolve) => {
  const output = [],
    c = chain([
      readableFrom([1, 2, 3]),
      reduce(
        delay((acc, x) => acc + x),
        0
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [6]);
    resolve();
  });
});

test.asPromise('fold: reduce stream', (t, resolve) => {
  const r = reduceStream((acc, x) => acc + x, 0);

  readableFrom([1, 2, 3]).pipe(r);

  r.on('finish', () => {
    t.deepEqual(r.accumulator, 6);
    resolve();
  });
});

test.asPromise('fold: reduce stream async', (t, resolve) => {
  const r = reduceStream({reducer: delay((acc, x) => acc + x), initial: 0});

  readableFrom([1, 2, 3]).pipe(r);

  r.on('finish', () => {
    t.deepEqual(r.accumulator, 6);
    resolve();
  });
});

'use strict';

import test from 'tape-six';

import {delay} from '../web-helpers.js';
import readableFrom from '../../src/utils/readableFrom.js';
import reduceStream from '../../src/utils/reduceStream.js';

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

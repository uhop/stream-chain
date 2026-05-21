'use strict';

import test from 'tape-six';

import {delay, runChain} from '../web-helpers.js';

import fold from '../../src/utils/fold.js';
import scan from '../../src/utils/scan.js';
import reduce from '../../src/utils/reduce.js';

test.asPromise('fold: smoke test', async (t, resolve) => {
  const out = await runChain([fold((acc, x) => acc + x, 0)], [1, 2, 3]);
  t.deepEqual(out, [6]);
  resolve();
});

test.asPromise('fold: async', async (t, resolve) => {
  const out = await runChain(
    [
      fold(
        delay((acc, x) => acc + x),
        0
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [6]);
  resolve();
});

test.asPromise('fold: scan', async (t, resolve) => {
  const out = await runChain([scan((acc, x) => acc + x, 0)], [1, 2, 3]);
  t.deepEqual(out, [1, 3, 6]);
  resolve();
});

test.asPromise('fold: scan async', async (t, resolve) => {
  const out = await runChain(
    [
      scan(
        delay((acc, x) => acc + x),
        0
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [1, 3, 6]);
  resolve();
});

test.asPromise('fold: reduce', async (t, resolve) => {
  const out = await runChain([reduce((acc, x) => acc + x, 0)], [1, 2, 3]);
  t.deepEqual(out, [6]);
  resolve();
});

test.asPromise('fold: reduce async', async (t, resolve) => {
  const out = await runChain(
    [
      reduce(
        delay((acc, x) => acc + x),
        0
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [6]);
  resolve();
});

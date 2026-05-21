'use strict';

import test from 'tape-six';

import {delay, runChain} from '../web-helpers.js';

import skip from '../../src/utils/skip.js';
import skipWhile from '../../src/utils/skipWhile.js';

test.asPromise('skip: smoke test', async (t, resolve) => {
  const out = await runChain([skip(2)], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [3, 4, 5]);
  resolve();
});

test.asPromise('skip: while', async (t, resolve) => {
  const out = await runChain([skipWhile(x => x != 3)], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [3, 4, 5]);
  resolve();
});

test.asPromise('skip: while async', async (t, resolve) => {
  const out = await runChain([skipWhile(delay(x => x != 3))], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [3, 4, 5]);
  resolve();
});
